import { useState } from 'react'
import { addDays, addWeeks, addMonths, format, parseISO } from 'date-fns'
import { useTasks } from '../context/TaskContext'
import AssigneeModal from './AssigneeModal'
import EventModal from './EventModal'
import MinistryModal from './MinistryModal'

// ── Grouped assignee picker ───────────────────────────────────────────────────
function AssigneePicker({ assignees, ministries, selected, onChange, onAddNew }) {
  function isSelected(id) { return !!selected.find(s => s.id === id) }

  function toggle(entry) {
    onChange(prev => {
      const exists = prev.find(s => s.id === entry.id)
      return exists ? prev.filter(s => s.id !== entry.id) : [...prev, entry]
    })
  }

  // Group people by ministry name, ungrouped at bottom
  const grouped = ministries.map(m => ({
    ministry: m,
    people: assignees.filter(a => a.ministry === m.name),
  })).filter(g => g.people.length > 0)
  const ungrouped = assignees.filter(a => !a.ministry || !ministries.find(m => m.name === a.ministry))

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Assign To</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => {
            const all = [
              ...ministries.map(m => ({ id: m.id, name: m.name, _type: 'ministry' })),
              ...assignees.map(a => ({ ...a, _type: 'person' })),
            ]
            onChange(all)
          }} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider">
            All
          </button>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase tracking-wider">
              Clear
            </button>
          )}
          <button type="button" onClick={onAddNew}
            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider">
            + Add
          </button>
        </div>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map(a => (
            <span key={a.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                ${a._type === 'ministry'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'}`}>
              {a._type === 'ministry' && <span className="opacity-60">🏛</span>}
              {a.name}
              <button type="button" onClick={() => onChange(p => p.filter(s => s.id !== a.id))}
                className="opacity-50 hover:opacity-100 leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="border border-slate-300 rounded max-h-48 overflow-y-auto">
        {assignees.length === 0 && ministries.length === 0 && (
          <p className="text-xs text-slate-400 px-3 py-2">No people yet — add one above</p>
        )}

        {/* Ministry-level rows */}
        {ministries.length > 0 && (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
              Ministries
            </div>
            {ministries.map(m => {
              const entry = { id: m.id, name: m.name, _type: 'ministry' }
              const sel = isSelected(m.id)
              return (
                <button key={m.id} type="button" onClick={() => toggle(entry)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${sel ? 'bg-purple-50' : ''}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                    ${sel ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                    {sel ? '✓' : ''}
                  </span>
                  <span className={`${sel ? 'text-purple-700 font-medium' : 'text-slate-700'}`}>🏛 {m.name}</span>
                </button>
              )
            })}
          </>
        )}

        {/* People grouped by ministry */}
        {grouped.map(({ ministry: m, people }) => (
          <div key={m.id}>
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-y border-slate-100">
              {m.name}
            </div>
            {people.map(a => {
              const entry = { ...a, _type: 'person' }
              const sel = isSelected(a.id)
              return (
                <button key={a.id} type="button" onClick={() => toggle(entry)}
                  className={`w-full text-left px-3 py-1.5 pl-5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${sel ? 'bg-blue-50' : ''}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                    ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                    {sel ? '✓' : ''}
                  </span>
                  <span className={sel ? 'text-blue-700 font-medium' : 'text-slate-700'}>{a.name}</span>
                  {a.telegram_id && <span className="ml-auto text-[10px] text-slate-400">TG</span>}
                </button>
              )
            })}
          </div>
        ))}

        {/* Ungrouped people */}
        {ungrouped.length > 0 && (
          <>
            {(grouped.length > 0 || ministries.length > 0) && (
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-y border-slate-100">
                Other
              </div>
            )}
            {ungrouped.map(a => {
              const entry = { ...a, _type: 'person' }
              const sel = isSelected(a.id)
              return (
                <button key={a.id} type="button" onClick={() => toggle(entry)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${sel ? 'bg-blue-50' : ''}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                    ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                    {sel ? '✓' : ''}
                  </span>
                  <span className={sel ? 'text-blue-700 font-medium' : 'text-slate-700'}>{a.name}</span>
                  {a.telegram_id && <span className="ml-auto text-[10px] text-slate-400">TG</span>}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

const STATUSES = ['todo', 'in_progress', 'done', 'blocked']
const PRIORITIES = ['high', 'medium', 'low']
const REMINDERS = ['none', '1d', '2h', '30m', 'ondue']
const RECURRING = ['none', 'ongoing', 'daily', 'weekly', 'monthly']

function parseNames(str) {
  return str ? str.split(',').map(s => s.trim()).filter(Boolean) : []
}

export default function TaskModal({ task, onClose }) {
  const { addTask, updateTask, assignees, events, ministries } = useTasks()
  const isEdit = !!task

  const [form, setForm] = useState({
    name: task?.name ?? '',
    event: task?.event ?? '',
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    due_date: task?.due_date ?? '',
    reminder: task?.reminder ?? 'none',
    recurring: task?.recurring ?? 'none',
    remarks: task?.remarks ?? '',
    gdrive_link: task?.gdrive_link ?? '',
  })

  // Unified assignee state — holds both people and ministry-level entries
  // Shape: { id, name, _type: 'person' | 'ministry' }
  const [selectedAssignees, setSelectedAssignees] = useState(() => {
    if (!task?.assignee) return []
    return parseNames(task.assignee).map(name => {
      const person = assignees.find(a => a.name === name)
      if (person) return { ...person, _type: 'person' }
      const ministry = ministries.find(m => m.name === name)
      if (ministry) return { ...ministry, _type: 'ministry' }
      return { id: name, name, _type: 'person' }
    })
  })

  // Multi-ministry state
  const [selectedMinistries, setSelectedMinistries] = useState(() => {
    if (!task?.ministry) return []
    return parseNames(task.ministry).map(name => {
      const found = ministries.find(m => m.name === name)
      return found ?? { id: name, name }
    })
  })

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [showAddAssignee, setShowAddAssignee] = useState(false)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showAddMinistry, setShowAddMinistry] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function toggleMinistry(m) {
    setSelectedMinistries(prev => {
      const exists = prev.find(x => x.id === m.id)
      return exists ? prev.filter(x => x.id !== m.id) : [...prev, m]
    })
  }

  function removeMinistry(id) {
    setSelectedMinistries(prev => prev.filter(x => x.id !== id))
  }

  function calcNextDue(dueDateStr, recurring) {
    if (!dueDateStr) return null
    try {
      const d = parseISO(dueDateStr)
      if (recurring === 'daily')   return format(addDays(d, 1), 'yyyy-MM-dd')
      if (recurring === 'weekly')  return format(addWeeks(d, 1), 'yyyy-MM-dd')
      if (recurring === 'monthly') return format(addMonths(d, 1), 'yyyy-MM-dd')
    } catch { return null }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required'); return }
    const assigneeStr = selectedAssignees.map(a => a.name).join(', ')
    const assigneeTgStr = selectedAssignees.map(a => a.telegram_id).filter(Boolean).join(', ')
    const ministryStr = selectedMinistries.map(m => m.name).join(', ')

    let payload = { ...form, assignee: assigneeStr, assignee_tg: assigneeTgStr, ministry: ministryStr }

    // If marking a recurring task as done → bump date + reset to todo
    const isRecurring = payload.recurring && !['none', 'ongoing', ''].includes(payload.recurring)
    if (payload.status === 'done' && isRecurring) {
      const nextDue = calcNextDue(payload.due_date, payload.recurring)
      if (nextDue) {
        payload = { ...payload, status: 'todo', due_date: nextDue, reminder_sent: 'FALSE' }
        setErr(`✓ Recurring task reset — next due: ${nextDue}`)
      }
    }

    try {
      setSaving(true)
      if (isEdit) {
        await updateTask(task.id, {
          ...payload,
          reminder_sent: payload.reminder_sent ?? ((form.reminder !== task.reminder || form.due_date !== task.due_date) ? 'FALSE' : task.reminder_sent)
        })
      } else {
        await addTask(payload)
      }
      onClose()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Event / Group</span>
                  <button
                    type="button"
                    onClick={() => setShowAddEvent(true)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider"
                  >
                    + Add
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

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Ministry</span>
                  <button
                    type="button"
                    onClick={() => setShowAddMinistry(true)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider"
                  >
                    + Add
                  </button>
                </div>

                {/* Selected ministry chips */}
                {selectedMinistries.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {selectedMinistries.map(m => (
                      <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {m.name}
                        <button type="button" onClick={() => removeMinistry(m.id)} className="text-purple-400 hover:text-purple-700 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Ministry toggle list */}
                <div className="border border-slate-300 rounded max-h-28 overflow-y-auto">
                  {ministries.length === 0 && (
                    <p className="text-xs text-slate-400 px-3 py-2">No ministries yet — add one above</p>
                  )}
                  {ministries.map(m => {
                    const selected = !!selectedMinistries.find(s => s.id === m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMinistry(m)}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${selected ? 'bg-purple-50' : ''}`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                          ${selected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                          {selected ? '✓' : ''}
                        </span>
                        <span className={selected ? 'text-purple-700 font-medium' : 'text-slate-700'}>{m.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
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
                {RECURRING.map(r => (
                  <option key={r} value={r}>
                    {r === 'none' ? 'None' : r === 'ongoing' ? '∞ Ongoing (never done)' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <AssigneePicker
              assignees={assignees}
              ministries={ministries}
              selected={selectedAssignees}
              onChange={setSelectedAssignees}
              onAddNew={() => setShowAddAssignee(true)}
            />

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
      {showAddMinistry && <MinistryModal onClose={() => setShowAddMinistry(false)} />}
    </>
  )
}
