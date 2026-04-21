import { useState } from 'react'
import { useTasks } from '../context/TaskContext'
import AssigneeModal from './AssigneeModal'
import EventModal from './EventModal'

const STATUSES = ['todo', 'in_progress', 'done', 'blocked']
const PRIORITIES = ['high', 'medium', 'low']
const REMINDERS = ['none', '1d', '2h', '30m', 'ondue']
const RECURRING = ['none', 'daily', 'weekly', 'monthly']

export default function TaskModal({ task, onClose }) {
  const { addTask, updateTask, assignees, events } = useTasks()
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
    recurring: task?.recurring ?? 'none',
    remarks: task?.remarks ?? '',
    gdrive_link: task?.gdrive_link ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [showAddAssignee, setShowAddAssignee] = useState(false)
  const [showAddEvent, setShowAddEvent] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleAssigneeChange(e) {
    const id = e.target.value
    if (!id) {
      setForm(f => ({ ...f, assignee: '', assignee_tg: '' }))
      return
    }
    const person = assignees.find(a => String(a.id) === id)
    if (person) {
      setForm(f => ({ ...f, assignee: person.name, assignee_tg: person.telegram_id }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required'); return }
    try {
      setSaving(true)
      if (isEdit) {
        await updateTask(task.id, { 
          ...form, 
          reminder_sent: (form.reminder !== task.reminder || form.due_date !== task.due_date) ? 'FALSE' : task.reminder_sent 
        })
      } else {
        await addTask(form)
      }
      onClose()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  const currentAssignee = assignees.find(a => a.name === form.assignee) ?? assignees.find(a => String(a.telegram_id) === String(form.assignee_tg))

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
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

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Event / Group</span>
                <button 
                  type="button"
                  onClick={() => setShowAddEvent(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider"
                >
                  + Add New
                </button>
              </div>
              <select
                value={form.event}
                onChange={e => set('event', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">No Event</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.name}>{ev.name}</option>
                ))}
              </select>
            </div>

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
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
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

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Recurrence</span>
              <select
                value={form.recurring}
                onChange={e => set('recurring', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {RECURRING.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Assign To</span>
                <button 
                  type="button"
                  onClick={() => setShowAddAssignee(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider"
                >
                  + Add New
                </button>
              </div>
              <select
                value={currentAssignee?.id ?? ''}
                onChange={handleAssigneeChange}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Unassigned</option>
                {assignees.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Remarks</span>
              <textarea
                value={form.remarks}
                onChange={e => set('remarks', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 h-20 resize-none"
                placeholder="Additional notes..."
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">GDrive Link</span>
              <input
                value={form.gdrive_link}
                onChange={e => set('gdrive_link', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="https://drive.google.com/..."
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
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showAddAssignee && <AssigneeModal onClose={() => setShowAddAssignee(false)} />}
      {showAddEvent && <EventModal onClose={() => setShowAddEvent(false)} />}
    </>
  )
}
