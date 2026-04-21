import { useState, useRef } from 'react'
import ScreenshotButton from './ScreenshotButton'
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, format, isSameMonth, isToday, parseISO, isSameDay, isWithinInterval
} from 'date-fns'
import { StatusBadge } from './Badges'

export default function CalendarView({ tasks, events, onEdit }) {
  const [current, setCurrent] = useState(new Date())
  const calRef = useRef(null)

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

  function eventsOnDay(day) {
    return (events || []).filter(e => {
      const hasStart = !!e.start_date
      const hasEnd = !!e.end_date
      
      // 1. Handle Date Constraints
      if (hasStart && hasEnd) {
        // Range: Check if day is within [start, end]
        try {
          const start = parseISO(e.start_date)
          const end = parseISO(e.end_date)
          const dayInRange = isWithinInterval(day, { 
            start: start < end ? start : end, 
            end: end > start ? end : start 
          })
          if (!dayInRange) return false
        } catch { return false }
      } else if (hasStart || hasEnd) {
        // Single Date: Use start_date (or end_date if start is missing) as the specific day
        try {
          const target = parseISO(e.start_date || e.end_date)
          if (!isSameDay(day, target)) return false
        } catch { return false }
      }

      // 2. Handle Recurring Patterns
      // If we are here, the day has passed any specific date constraints (or there were none)
      if (e.recurring && e.recurring !== 'none') {
        const isFirst = e.recurring.startsWith('first_')
        const targetDay = isFirst ? e.recurring.split('_')[1] : e.recurring
        
        const matchesDay = day.getDay().toString() === targetDay
        if (!matchesDay) return false
        
        if (isFirst) {
          return day.getDate() <= 7
        }
        return true
      }

      // If no recurring pattern is set, and it passed date checks (or is infinite), show it.
      return true
    })
  }

  return (
    <div ref={calRef} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <button
          onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-2 rounded hover:bg-slate-100 text-slate-600"
        >
          ←
        </button>
        <h2 className="font-semibold text-slate-800">{format(current, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-2">
          <ScreenshotButton targetRef={calRef} label="Calendar" />
          <button
            onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="p-2 rounded hover:bg-slate-100 text-slate-600"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayTasks = tasksOnDay(day)
          const dayEvents = eventsOnDay(day)
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
                {/* Events display */}
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="text-[10px] leading-tight px-1 py-0.5 border border-dashed border-slate-300 bg-slate-50 text-slate-600 rounded truncate mb-0.5"
                    title={`Event: ${event.name}`}
                  >
                    {event.name}
                  </div>
                ))}

                {/* Tasks display */}
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
