import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

const STATUSES = ['todo', 'in_progress', 'done', 'blocked']
const PRIORITIES = ['high', 'medium', 'low']
const REMINDERS = ['none', '1d', '2h', '30m', 'ondue']

export default function TaskModal({ task, onClose, events = [] }) {
  const { addTask, updateTask } = useTasks()
  const isEdit = !!task

  const [form, setForm] = useState({
    name: task?.name ?? '',
    event: task?.event ?? '',
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    due_date: task?.due_date ?? '',
    assignee: task?.assignee ?? '',
    assignee_tg: task?.assignee_tg ?? '',
    reminder: task?.reminder ?? 'none',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required'); return }
    try {
      setSaving(true)
      if (isEdit) {
        await updateTask(task.id, { ...form, reminder_sent: form.reminder !== task.reminder ? 'FALSE' : task.reminder_sent })
      } else {
        await addTask(form)
      }
      onClose()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">
          {err && <p className="text-red-500 text-sm">{err}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Name *</span>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Task name"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Event / Group</span>
            <input
              list="event-options"
              value={form.event}
              onChange={e => set('event', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Anniversary, Product Launch"
            />
            <datalist id="event-options">
              {events.map(ev => <option key={ev} value={ev} />)}
            </datalist>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Priority</span>
              <select
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Due Date</span>
              <input
                type="date"
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Reminder</span>
              <select
                value={form.reminder}
                onChange={e => set('reminder', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {REMINDERS.map(r => <option key={r} value={r}>{r === 'none' ? 'None' : r === 'ondue' ? 'On due date' : `${r} before`}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Assignee Name</span>
              <input
                value={form.assignee}
                onChange={e => set('assignee', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="John"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Telegram Chat ID</span>
              <input
                value={form.assignee_tg}
                onChange={e => set('assignee_tg', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="123456789"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
