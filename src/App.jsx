import { useState, useMemo } from 'react'
import { useTasks } from './context/TaskContext'
import ListView from './components/ListView'
import KanbanView from './components/KanbanView'
import CalendarView from './components/CalendarView'
import TaskModal from './components/TaskModal'
import AssigneeModal from './components/AssigneeModal'

const VIEWS = ['List', 'Kanban', 'Calendar']

export default function App() {
  const [view, setView] = useState('List')
  const [modalOpen, setModalOpen] = useState(false)
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [filterEvent, setFilterEvent] = useState('')
  const { tasks, loading, error } = useTasks()

  const events = useMemo(() => {
    const unique = [...new Set(tasks.map(t => t.event).filter(Boolean))].sort()
    return unique
  }, [tasks])

  const filtered = useMemo(() =>
    filterEvent ? tasks.filter(t => t.event === filterEvent) : tasks
  , [tasks, filterEvent])

  function openAdd() { setEditTask(null); setModalOpen(true) }
  function openEdit(task) { setEditTask(task); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditTask(null) }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-600 px-6 py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-semibold text-white tracking-tight">Yrock Bustos & Baliuag | Task Manager</h1>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Event filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterEvent}
              onChange={e => setFilterEvent(e.target.value)}
              className="rounded px-3 py-1.5 text-sm text-slate-700 bg-white border-0 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="">All events</option>
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>

          <nav className="flex gap-1">
            {VIEWS.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors
                  ${view === v ? 'bg-white text-blue-600' : 'text-blue-100 hover:bg-blue-500'}`}
              >
                {v}
              </button>
            ))}
          </nav>
          
          <div className="flex gap-2">
            <button
              onClick={() => setAssigneeModalOpen(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors border border-blue-500"
            >
              Assignees
            </button>
            <button
              onClick={openAdd}
              className="bg-white hover:bg-blue-50 text-blue-600 text-sm font-medium px-4 py-1.5 rounded transition-colors"
            >
              + Add Task
            </button>
          </div>
        </div>
      </header>

      {filterEvent && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-2">
          <span className="text-xs text-blue-600 font-medium">Event:</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{filterEvent}</span>
          <span className="text-xs text-blue-400">— {filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => setFilterEvent('')} className="ml-auto text-[10px] text-blue-400 hover:text-blue-600 uppercase font-bold tracking-wider">Clear Filter</button>
        </div>
      )}

      <main className="p-6">
        {loading && <p className="text-slate-500 text-sm">Loading tasks…</p>}
        {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        {!loading && !error && (
          <>
            {view === 'List' && <ListView tasks={filtered} onEdit={openEdit} />}
            {view === 'Kanban' && <KanbanView tasks={filtered} onEdit={openEdit} />}
            {view === 'Calendar' && <CalendarView tasks={filtered} onEdit={openEdit} />}
          </>
        )}
      </main>

      {modalOpen && <TaskModal task={editTask} onClose={closeModal} events={events} />}
      {assigneeModalOpen && <AssigneeModal onClose={() => setAssigneeModalOpen(false)} />}
    </div>
  )
}
