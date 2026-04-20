import { useState, useMemo, useEffect } from 'react'
import { useTasks } from './context/TaskContext'
import ListView from './components/ListView'
import KanbanView from './components/KanbanView'
import CalendarView from './components/CalendarView'
import TaskModal from './components/TaskModal'
import AssigneeModal from './components/AssigneeModal'
import EventModal from './components/EventModal'

const VIEWS = ['List', 'Kanban', 'Calendar']
const ITEMS_PER_PAGE = 15

export default function App() {
  const [view, setView] = useState('List')
  const [modalOpen, setModalOpen] = useState(false)
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)
  
  // Filters
  const [filterEvent, setFilterEvent] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  const { tasks, assignees, loading, error, events: managedEvents } = useTasks()

  const events = useMemo(() => {
    if (managedEvents && managedEvents.length > 0) {
      return managedEvents.map(e => e.name).sort()
    }
    const unique = [...new Set(tasks.map(t => t.event).filter(Boolean))].sort()
    return unique
  }, [tasks, managedEvents])

  // Combined Filtering Logic
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchEvent = !filterEvent || t.event === filterEvent
      const matchAssignee = !filterAssignee || t.assignee === filterAssignee
      const matchSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchEvent && matchAssignee && matchSearch
    })
  }, [tasks, filterEvent, filterAssignee, searchTerm])

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedTasks = useMemo(() => {
    // Only paginate in List view
    if (view !== 'List') return filtered
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage, view])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEvent, filterAssignee, searchTerm])

  function openAdd() { setEditTask(null); setModalOpen(true) }
  function openEdit(task) { setEditTask(task); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditTask(null) }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-600 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm gap-4">
        <h1 className="text-xl font-semibold text-white tracking-tight shrink-0">Yrock Bustos & Baliuag | Task Manager</h1>
        
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="rounded px-3 py-1.5 text-sm bg-blue-700/50 text-white placeholder-blue-200 border border-blue-500 focus:outline-none focus:ring-2 focus:ring-white/50 w-48"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-blue-200 hover:text-white">✕</button>
            )}
          </div>

          {/* Event filter */}
          <select
            value={filterEvent}
            onChange={e => setFilterEvent(e.target.value)}
            className="rounded px-3 py-1.5 text-sm text-slate-700 bg-white border-0 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <option value="">All events</option>
            {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>

          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="rounded px-3 py-1.5 text-sm text-slate-700 bg-white border-0 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <option value="">All assignees</option>
            {assignees.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>

          <nav className="flex gap-1 border-l border-blue-500 pl-3">
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
              onClick={() => setEventModalOpen(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors border border-blue-500"
              title="Manage Events"
            >
              Events
            </button>
            <button
              onClick={() => setAssigneeModalOpen(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors border border-blue-500"
              title="Manage People"
            >
              People
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

      {/* Filter Status Bar */}
      {(filterEvent || filterAssignee || searchTerm) && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-blue-600 font-medium uppercase tracking-wider">Active Filters:</span>
          {filterEvent && <span className="text-xs bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-200">Event: {filterEvent}</span>}
          {filterAssignee && <span className="text-xs bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-200">Person: {filterAssignee}</span>}
          {searchTerm && <span className="text-xs bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-200">Search: "{searchTerm}"</span>}
          <span className="text-xs text-slate-400">— Found {filtered.length} tasks</span>
          <button 
            onClick={() => { setFilterEvent(''); setFilterAssignee(''); setSearchTerm('') }} 
            className="ml-auto text-[10px] text-blue-500 hover:text-blue-700 uppercase font-bold tracking-wider"
          >
            Clear All
          </button>
        </div>
      )}

      <main className="p-6">
        {loading && <p className="text-slate-500 text-sm">Loading tasks…</p>}
        {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        {!loading && !error && (
          <div className="flex flex-col gap-6">
            {view === 'List' && (
              <>
                <ListView tasks={paginatedTasks} onEdit={openEdit} />
                
                {/* Pagination UI */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">
                      Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> results
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50 font-medium text-slate-600"
                      >
                        Previous
                      </button>
                      <div className="flex items-center px-4 text-sm font-semibold text-slate-700">
                        Page {currentPage} of {totalPages}
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50 font-medium text-slate-600"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {view === 'Kanban' && <KanbanView tasks={filtered} onEdit={openEdit} />}
            {view === 'Calendar' && <CalendarView tasks={filtered} onEdit={openEdit} />}
          </div>
        )}
      </main>

      {modalOpen && <TaskModal task={editTask} onClose={closeModal} />}
      {assigneeModalOpen && <AssigneeModal onClose={() => setAssigneeModalOpen(false)} />}
      {eventModalOpen && <EventModal onClose={() => setEventModalOpen(false)} />}
    </div>
  )
}
