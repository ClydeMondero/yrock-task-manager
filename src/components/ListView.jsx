import { useState } from 'react'
import { useTasks } from '../context/TaskContext'
import { isPast, parseISO } from 'date-fns'
import { StatusBadge, PriorityBadge } from './Badges'

const COLS = [
  { key: 'name', label: 'Name' },
  { key: 'event', label: 'Event' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'reminder', label: 'Reminder' },
]

export default function ListView({ tasks, onEdit }) {
  const { deleteTask } = useTasks()
  const [sortKey, setSortKey] = useState('due_date')
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...tasks].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  function isOverdue(task) {
    if (!task.due_date || task.status === 'done') return false
    try { return isPast(parseISO(task.due_date)) } catch { return false }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {COLS.map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="text-left px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(task => (
            <tr
              key={task.id}
              className={`border-b border-slate-100 hover:bg-slate-50 transition-colors
                ${isOverdue(task) ? 'bg-red-50 hover:bg-red-100' : ''}`}
            >
              <td className="px-4 py-3 font-medium text-slate-800">
                {isOverdue(task) && <span className="text-red-500 mr-1">!</span>}
                {task.name}
              </td>
              <td className="px-4 py-3">
                {task.event
                  ? <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">{task.event}</span>
                  : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
              <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
              <td className={`px-4 py-3 ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                {task.due_date || '—'}
              </td>
              <td className="px-4 py-3 text-slate-600">{task.assignee || '—'}</td>
              <td className="px-4 py-3 text-slate-500 capitalize">{task.reminder || 'none'}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => onEdit(task)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No tasks yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
