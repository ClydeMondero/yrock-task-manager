import { useState, useRef, useMemo } from 'react'
import { isPast, parseISO, differenceInDays } from 'date-fns'
import { StatusBadge, PriorityBadge } from './Badges'
import ScreenshotButton from './ScreenshotButton'

const GROUP_OPTIONS = [
  { value: 'assignee', label: 'By Assignee' },
  { value: 'ministry', label: 'By Ministry' },
  { value: 'event', label: 'By Event' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending only' },
  { value: 'overdue', label: 'Overdue only' },
  { value: 'all', label: 'All statuses' },
]

const PENDING_STATUSES = ['todo', 'in_progress', 'blocked']

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false
  try { return isPast(parseISO(task.due_date)) } catch { return false }
}

function daysUntilDue(task) {
  if (!task.due_date) return null
  try { return differenceInDays(parseISO(task.due_date), new Date()) } catch { return null }
}

function dueBadge(task) {
  if (task.status === 'done') return null
  const days = daysUntilDue(task)
  if (days === null) return null
  if (days < 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Due today</span>
  if (days <= 3) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Due in {days}d</span>
  return null
}

function groupTasks(tasks, groupBy) {
  const groups = {}

  tasks.forEach(task => {
    let keys = []

    if (groupBy === 'assignee') {
      const names = task.assignee
        ? task.assignee.split(',').map(s => s.trim()).filter(Boolean)
        : ['Unassigned']
      keys = names
    } else if (groupBy === 'ministry') {
      keys = [task.ministry || 'No Ministry']
    } else {
      keys = [task.event || 'No Event']
    }

    keys.forEach(key => {
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })
  })

  return Object.entries(groups).sort(([a], [b]) => {
    // Put "Unassigned / No X" at end
    const aIsNone = a.startsWith('No ') || a === 'Unassigned'
    const bIsNone = b.startsWith('No ') || b === 'Unassigned'
    if (aIsNone && !bIsNone) return 1
    if (!aIsNone && bIsNone) return -1
    return a.localeCompare(b)
  })
}

function TaskRow({ task }) {
  const overdue = isOverdue(task)
  const badge = dueBadge(task)

  return (
    <tr className={`border-b border-slate-100 text-sm ${overdue ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
      <td className="py-2 px-3">
        <div className="flex items-center gap-2 flex-wrap">
          {overdue && <span className="text-red-500 font-bold">!</span>}
          <span className={`font-medium ${overdue ? 'text-red-800' : 'text-slate-800'}`}>{task.name}</span>
          {badge}
        </div>
        {(task.event || task.ministry) && (
          <div className="flex gap-1 mt-0.5">
            {task.ministry && <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 rounded">{task.ministry}</span>}
            {task.event && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 rounded">{task.event}</span>}
          </div>
        )}
      </td>
      <td className="py-2 px-3 whitespace-nowrap">
        <PriorityBadge priority={task.priority} />
      </td>
      <td className="py-2 px-3">
        <StatusBadge status={task.status} />
      </td>
      <td className={`py-2 px-3 text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
        {task.due_date || '—'}
      </td>
      <td className="py-2 px-3 text-xs text-slate-500 max-w-[180px]">
        <div className="truncate" title={task.remarks}>{task.remarks || '—'}</div>
      </td>
    </tr>
  )
}

function GroupCard({ groupName, tasks, groupBy, reportRef }) {
  const cardRef = useRef(null)
  const overdueCount = tasks.filter(isOverdue).length
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div ref={cardRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            {groupName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{groupName}</p>
            <p className="text-xs text-slate-500">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              {overdueCount > 0 && <span className="text-red-500 ml-2">· {overdueCount} overdue</span>}
              {doneCount > 0 && <span className="text-emerald-600 ml-2">· {doneCount} done</span>}
            </p>
          </div>
        </div>
        <ScreenshotButton targetRef={cardRef} label={groupName} />
      </div>

      {/* Task table */}
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 border-b border-slate-100">
          <tr>
            <th className="text-left py-2 px-3 font-medium">Task</th>
            <th className="text-left py-2 px-3 font-medium">Priority</th>
            <th className="text-left py-2 px-3 font-medium">Status</th>
            <th className="text-left py-2 px-3 font-medium">Due Date</th>
            <th className="text-left py-2 px-3 font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => <TaskRow key={task.id + groupName} task={task} />)}
        </tbody>
      </table>
    </div>
  )
}

export default function ReportView({ tasks }) {
  const [groupBy, setGroupBy] = useState('assignee')
  const [statusFilter, setStatusFilter] = useState('pending')
  const reportRef = useRef(null)

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'pending') return tasks.filter(t => PENDING_STATUSES.includes(t.status))
    if (statusFilter === 'overdue') return tasks.filter(isOverdue)
    return tasks
  }, [tasks, statusFilter])

  const groups = useMemo(() => groupTasks(filteredTasks, groupBy), [filteredTasks, groupBy])

  const totalOverdue = tasks.filter(isOverdue).length
  const totalPending = tasks.filter(t => PENDING_STATUSES.includes(t.status)).length
  const totalDone = tasks.filter(t => t.status === 'done').length
  const donePercent = tasks.length ? Math.round((totalDone / tasks.length) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Group by:</span>
          {GROUP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors
                ${groupBy === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Show:</span>
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors
                ${statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <ScreenshotButton targetRef={reportRef} label="Report" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Tasks', value: tasks.length, cls: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Pending', value: totalPending, cls: 'text-sky-700', bg: 'bg-sky-50' },
          { label: 'Overdue', value: totalOverdue, cls: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Completed', value: `${totalDone} (${donePercent}%)`, cls: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-slate-200 px-4 py-3`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Groups */}
      <div ref={reportRef} className="flex flex-col gap-4 bg-slate-50 rounded-xl p-3">
        {groups.length === 0 && (
          <div className="text-center py-12 text-slate-400">No tasks match the current filter.</div>
        )}
        {groups.map(([name, groupTasks]) => (
          <GroupCard
            key={name}
            groupName={name}
            tasks={groupTasks}
            groupBy={groupBy}
            reportRef={reportRef}
          />
        ))}
      </div>
    </div>
  )
}
