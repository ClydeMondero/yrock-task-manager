import { useState } from 'react'
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, format, isSameMonth, isToday, parseISO, isSameDay,
} from 'date-fns'
import { StatusBadge } from './Badges'

export default function CalendarView({ tasks, onEdit }) {
  const [current, setCurrent] = useState(new Date())

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function tasksOnDay(day) {
    return tasks.filter(t => {
      if (!t.due_date) return false
      try { return isSameDay(parseISO(t.due_date), day) } catch { return false }
    })
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <button
          onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-2 rounded hover:bg-slate-100 text-slate-600"
        >
          ←
        </button>
        <h2 className="font-semibold text-slate-800">{format(current, 'MMMM yyyy')}</h2>
        <button
          onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-2 rounded hover:bg-slate-100 text-slate-600"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayTasks = tasksOnDay(day)
          const inMonth = isSameMonth(day, current)
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className={`min-h-24 border-b border-r border-slate-100 p-1.5
                ${!inMonth ? 'bg-slate-50' : 'bg-white'}
                ${today ? 'bg-blue-50' : ''}`}
            >
              <span className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full
                ${today ? 'bg-blue-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => onEdit(task)}
                    className="text-left w-full text-xs truncate px-1 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                    title={task.name}
                  >
                    {task.name}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-xs text-slate-400 px-1">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
