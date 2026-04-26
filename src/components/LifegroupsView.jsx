import { useState, useEffect } from 'react'
import { useTasks } from '../context/TaskContext'
import LGGroupPanel from './LGGroupPanel'
import LGGroupModal from './LGGroupModal'
import LGAdminView from './LGAdminView'

// ── SHA-256 helper (browser-native) ──────────────────────────────────────────
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Admin password — change via VITE_LG_ADMIN_PASSWORD env var or keep default
const ADMIN_PASSWORD = import.meta.env.VITE_LG_ADMIN_PASSWORD ?? 'lifegroup@yrock'

const SESSION_PREFIX = 'lg_unlocked_'
const SESSION_ADMIN  = 'lg_admin_unlocked'

// ── Password gate modal ───────────────────────────────────────────────────────
function PasswordGate({ title, subtitle, onSuccess, onCancel }) {
  const [input,   setInput]   = useState('')
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  async function verify(e) {
    e.preventDefault()
    if (!input) { setErr('Enter password'); return }
    setLoading(true)
    setErr('')
    const hash = await sha256hex(input)
    const ok   = await onSuccess(hash)
    if (!ok) {
      setErr('Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl mx-auto mb-3">🔒</div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <form onSubmit={verify} className="px-6 pb-6 flex flex-col gap-3">
          {err && <p className="text-red-500 text-sm text-center">{err}</p>}
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter password"
              className="border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-center tracking-widest w-full"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors">
            {loading ? 'Verifying…' : 'Unlock'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="text-xs text-slate-400 hover:text-slate-600 text-center">
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function LifegroupsView() {
  const { lgGroups, deleteLGGroup } = useTasks()

  // Which view: group ID | 'admin'
  const [activeView,  setActiveView]  = useState(null)
  const [groupModal,  setGroupModal]  = useState(null)   // null | 'add' | group obj

  // Auth state — also backed by sessionStorage so page refresh doesn't re-ask
  const [unlockedIds, setUnlockedIds] = useState(() => {
    const ids = new Set()
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith(SESSION_PREFIX)) ids.add(k.slice(SESSION_PREFIX.length))
    })
    return ids
  })
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_ADMIN) === '1'
  )

  // Pending gate: which group/view is waiting for auth
  const [pendingGate,  setPendingGate]  = useState(null)   // null | 'admin' | groupId

  // Auto-select first group on first load
  useEffect(() => {
    if (activeView === null && lgGroups.length > 0) {
      setActiveView(lgGroups[0].id)
    }
  }, [lgGroups])

  function isUnlocked(groupId) {
    return !lgGroups.find(g => g.id === groupId)?.password_hash
      || unlockedIds.has(groupId)
  }

  function handleTabClick(id) {
    if (id === 'admin') {
      if (adminUnlocked) { setActiveView('admin'); return }
      setPendingGate('admin')
      return
    }
    if (isUnlocked(id)) { setActiveView(id); return }
    setPendingGate(id)
  }

  // Called by PasswordGate — returns true if password is correct
  async function verifyPassword(inputHash) {
    if (pendingGate === 'admin') {
      const expected = await sha256hex(ADMIN_PASSWORD)
      if (inputHash !== expected) return false
      sessionStorage.setItem(SESSION_ADMIN, '1')
      setAdminUnlocked(true)
      setActiveView('admin')
      setPendingGate(null)
      return true
    }
    // Group
    const group = lgGroups.find(g => g.id === pendingGate)
    if (!group?.password_hash) return false
    if (inputHash !== group.password_hash) return false
    sessionStorage.setItem(SESSION_PREFIX + pendingGate, '1')
    setUnlockedIds(prev => new Set([...prev, pendingGate]))
    setActiveView(pendingGate)
    setPendingGate(null)
    return true
  }

  function lockGroup(id) {
    sessionStorage.removeItem(SESSION_PREFIX + id)
    setUnlockedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (activeView === id) setActiveView(lgGroups[0]?.id ?? null)
  }

  async function handleDeleteGroup(id) {
    if (!window.confirm('Delete this lifegroup? Member and meeting records will remain in the sheet.')) return
    await deleteLGGroup(id)
    sessionStorage.removeItem(SESSION_PREFIX + id)
    setUnlockedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (activeView === id) setActiveView(lgGroups.find(g => g.id !== id)?.id ?? null)
  }

  const activeGroup = lgGroups.find(g => g.id === activeView) ?? null

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div>
          <h1 className="font-bold text-slate-800">Lifegroups</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track weekly meetings and member activity</p>
        </div>
        <button onClick={() => setGroupModal('add')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          + New Lifegroup
        </button>
      </div>

      {lgGroups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center gap-4 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">🌿</div>
          <div>
            <p className="font-semibold text-slate-700">No Lifegroups yet</p>
            <p className="text-sm text-slate-400 mt-1">Create a lifegroup to start tracking member attendance</p>
          </div>
          <button onClick={() => setGroupModal('add')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            Create First Lifegroup
          </button>
        </div>
      ) : (
        <>
          {/* Tabs row — horizontally scrollable */}
          <div className="flex gap-2 overflow-x-auto pb-1 items-center" style={{ scrollbarWidth: 'thin' }}>
            {/* Admin tab — always first */}
            <button onClick={() => handleTabClick('admin')}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center gap-1.5
                ${activeView === 'admin'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'}`}>
              {!adminUnlocked && <span className="text-[11px]">🔒</span>}
              📊 Admin Overview
            </button>

            {/* Divider */}
            <div className="flex-shrink-0 w-px h-6 bg-slate-200 mx-1" />

            {lgGroups.map(g => {
              const locked = !!g.password_hash && !unlockedIds.has(g.id)
              const active = activeView === g.id
              return (
                <button key={g.id} onClick={() => handleTabClick(g.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center gap-1.5
                    ${active
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'}`}>
                  {locked && <span className="text-[11px]">🔒</span>}
                  {g.name}
                  {g.leader && (
                    <span className={`text-[11px] ${active ? 'text-emerald-200' : 'text-slate-400'}`}>
                      · {g.leader}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Content */}
          {activeView === 'admin' && adminUnlocked && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">All Lifegroups — Activity Overview</p>
                <button onClick={() => {
                  sessionStorage.removeItem(SESSION_ADMIN)
                  setAdminUnlocked(false)
                  setActiveView(lgGroups[0]?.id ?? null)
                }}
                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded border border-slate-200 hover:border-red-200 transition-colors">
                  🔒 Lock Admin
                </button>
              </div>
              <LGAdminView />
            </div>
          )}

          {activeView !== 'admin' && activeGroup && isUnlocked(activeGroup.id) && (
            <div className="flex flex-col gap-2">
              {/* Lock button for this group */}
              {activeGroup.password_hash && (
                <div className="flex justify-end">
                  <button onClick={() => lockGroup(activeGroup.id)}
                    className="text-xs text-slate-400 hover:text-amber-600 px-2 py-1 rounded border border-slate-200 hover:border-amber-300 transition-colors">
                    🔒 Lock this Lifegroup
                  </button>
                </div>
              )}
              <LGGroupPanel
                group={activeGroup}
                onEditGroup={() => setGroupModal(activeGroup)}
                onDeleteGroup={() => handleDeleteGroup(activeGroup.id)}
              />
            </div>
          )}
        </>
      )}

      {/* Group modal */}
      {groupModal && (
        <LGGroupModal
          group={groupModal === 'add' ? null : groupModal}
          onClose={() => setGroupModal(null)}
        />
      )}

      {/* Password gate */}
      {pendingGate && (
        <PasswordGate
          title={
            pendingGate === 'admin'
              ? 'Admin Access'
              : `Unlock: ${lgGroups.find(g => g.id === pendingGate)?.name ?? ''}`
          }
          subtitle={
            pendingGate === 'admin'
              ? 'Enter admin password to view all lifegroups'
              : 'Enter your lifegroup password'
          }
          onSuccess={verifyPassword}
          onCancel={() => setPendingGate(null)}
        />
      )}
    </div>
  )
}
