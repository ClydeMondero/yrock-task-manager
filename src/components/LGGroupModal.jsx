import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function LGGroupModal({ group = null, onClose }) {
  const { addLGGroup, updateLGGroup } = useTasks()
  const isEdit = !!group?.id

  const [form,       setForm]       = useState({ name: group?.name ?? '', leader: group?.leader ?? '' })
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [changePw,   setChangePw]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required'); return }

    // Password validation
    const needsNewPw = !isEdit || changePw
    if (needsNewPw) {
      if (!password)              { setErr('Password is required'); return }
      if (password.length < 4)    { setErr('Password must be at least 4 characters'); return }
      if (password !== confirm)   { setErr('Passwords do not match'); return }
    }

    setSaving(true)
    try {
      let payload = { ...form }
      if (needsNewPw) {
        payload.password_hash = await sha256hex(password)
      }
      if (isEdit) await updateLGGroup(group.id, payload)
      else        await addLGGroup(payload)
      onClose()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Lifegroup' : 'New Lifegroup'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">
          {err && <p className="text-red-500 text-sm">{err}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Lifegroup Name *</span>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
              className={inputCls} placeholder="e.g. Alpha LG, Joshua Group" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Leader</span>
            <input value={form.leader} onChange={e => set('leader', e.target.value)}
              className={inputCls} placeholder="e.g. Clyde" />
          </label>

          {/* Password section */}
          <div className="flex flex-col gap-3">
            {isEdit && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={changePw} onChange={e => setChangePw(e.target.checked)}
                  className="accent-emerald-600" />
                <span className="text-xs font-medium text-slate-600">Change password</span>
              </label>
            )}

            {(!isEdit || changePw) && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    {isEdit ? 'New Password *' : 'Leader Password *'}
                  </span>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      className="border border-slate-300 rounded px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full"
                      placeholder="Min. 4 characters" autoComplete="new-password" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none"
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? '🙈' : '👁'}
                    </button>
                  </div>
                  {!isEdit && (
                    <p className="text-[10px] text-slate-400">Leaders use this to access their lifegroup.</p>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">Confirm Password *</span>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                      className="border border-slate-300 rounded px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full"
                      placeholder="Re-enter password" autoComplete="new-password" />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                      {showConfirm ? '🙈' : '👁'}
                    </button>
                  </div>
                </label>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create Lifegroup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
