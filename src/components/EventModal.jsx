import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

export default function EventModal({ onClose }) {
  const { addEvent } = useTasks()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name is required'); return }
    try {
      setSaving(true)
      await addEvent({ name })
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
          <h2 className="font-semibold text-slate-800">Add New Event / Group</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">
          {err && <p className="text-red-500 text-sm">{err}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Event Name *</span>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Media Anniversary"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
