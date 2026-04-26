import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

export default function LGMemberModal({ lifegroupId, member = null, onClose }) {
  const { addLGMember, updateLGMember } = useTasks()
  const isEdit = !!member?.id
  const [form, setForm] = useState({
    name:    member?.name    ?? '',
    contact: member?.contact ?? '',
    notes:   member?.notes   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    try {
      if (isEdit) await updateLGMember(member.id, form)
      else        await addLGMember({ ...form, lifegroup_id: lifegroupId })
      onClose()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Member' : 'Add Member'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Full Name *</span>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="e.g. Juan dela Cruz" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Contact</span>
            <input value={form.contact} onChange={e => set('contact', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Phone, Telegram, etc." />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Optional" />
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
