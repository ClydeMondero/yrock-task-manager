import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

export default function EventModal({ onClose }) {
  const { addEvent } = useTasks()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [recurring, setRecurring] = useState('none')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const DAYS = [
    { label: 'None (Whole Period)', value: 'none' },
    { label: 'Every Sunday', value: '0' },
    { label: 'Every Monday', value: '1' },
    { label: 'Every Tuesday', value: '2' },
    { label: 'Every Wednesday', value: '3' },
    { label: 'Every Thursday', value: '4' },
    { label: 'Every Friday', value: '5' },
    { label: 'Every Saturday', value: '6' },
    { label: '--- Monthly ---', value: 'none', disabled: true },
    { label: '1st Sunday of Month', value: 'first_0' },
    { label: '1st Monday of Month', value: 'first_1' },
    { label: '1st Tuesday of Month', value: 'first_2' },
    { label: '1st Wednesday of Month', value: 'first_3' },
    { label: '1st Thursday of Month', value: 'first_4' },
    { label: '1st Friday of Month', value: 'first_5' },
    { label: '1st Saturday of Month', value: 'first_6' },
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name is required'); return }
    try {
      setSaving(true)
      await addEvent({ 
        name, 
        start_date: startDate, 
        end_date: endDate,
        recurring
      })
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

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Start Date (Optional)</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">End Date (Optional)</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
          </div>
          <p className="text-[10px] text-slate-400 -mt-2 italic">Leave dates blank for infinite/permanent events.</p>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Recurring Day</span>
            <select
              value={recurring}
              onChange={e => setRecurring(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
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
