import { useState, useMemo, useEffect } from 'react'
import { useTasks } from './context/TaskContext'
import ListView from './components/ListView'
import KanbanView from './components/KanbanView'
import CalendarView from './components/CalendarView'
import ReportView from './components/ReportView'
import TaskModal from './components/TaskModal'
import AssigneeModal from './components/AssigneeModal'
import EventModal from './components/EventModal'
import MinistryModal from './components/MinistryModal'

const VIEWS = ['List', 'Kanban', 'Calendar', 'Report']
const ITEMS_PER_PAGE = 15

export default function App() {
  const [view, setView] = useState('List')
  const [modalOpen, setModalOpen] = useState(false)
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [ministryModalOpen, setMinistryModalOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)

  const [filterEvent, setFilterEvent] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterMinistry, setFilterMinistry] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { tasks, assignees, events: managedEvents, ministries, loading, error } = useTasks()

  const events = useMemo(() => {
    if (managedEvents && managedEvents.length > 0) return managedEvents.map(e => e.name).sort()
    return [...new Set(tasks.map(t => t.event).filter(Boolean))].sort()
  }, [tasks, managedEvents])

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchEvent = !filterEvent || t.event === filterEvent
      const matchMinistry = !filterMinistry || t.ministry === filterMinistry
      const matchAssignee = !filterAssignee || (t.assignee ?? '').split(',').map(s => s.trim()).includes(filterAssignee)
      const matchStatus = !filterStatus || t.status === filterStatus
      const matchSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchEvent && matchMinistry && matchAssignee && matchStatus && matchSearch
    })
  }, [tasks, filterEvent, filterMinistry, filterAssignee, filterStatus, searchTerm])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedTasks = useMemo(() => {
    if (view !== 'List') return filtered
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage, view])

  useEffect(() => { setCurrentPage(1) }, [filterEvent, filterMinistry, filterAssignee, filterStatus, searchTerm])

  function openAdd() { setEditTask(null); setModalOpen(true) }
  function openEdit(task) { setEditTask(task); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditTask(null) }

  const hasFilters = filterEvent || filterMinistry || filterAssignee || filterStatus || searchTerm

  function clearFilters() {
    setFilterEvent('')
    setFilterMinistry('')
    setFilterAssignee('')
    setFilterStatus('')
    setSearchTerm('')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Row 1: Brand + primary action ── */}
      <div className="bg-blue-600 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-base leading-tight">YROCK Task Manager</h1>
          <p className="text-blue-200 text-xs">Bustos &amp; Baliuag</p>
        </div>
        {view !== 'Report' && (
          <button
            onClick={openAdd}
            className="bg-white hover:bg-blue-50 text-blue-600 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* ── Row 2: View tabs + Manage buttons ── */}
      <div className="bg-blue-700 px-6 flex items-center justify-between">
        {/* View tabs */}
        <nav className="flex">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2
                ${view === v
                  ? 'border-white text-white'
                  : 'border-transparent text-blue-200 hover:text-white hover:border-blue-400'}`}
            >
              {v}
            </button>
          ))}
        </nav>

        {/* Manage buttons */}
        <div className="flex items-center gap-1 py-1.5">
          <span className="text-blue-400 text-xs mr-1 hidden sm:inline">Manage:</span>
          {[
            { label: 'People', action: () => setAssigneeModalOpen(true) },
            { label: 'Events', action: () => setEventModalOpen(true) },
            { label: 'Ministries', action: () => setMinistryModalOpen(true) },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="text-xs text-blue-200 hover:text-white hover:bg-blue-600 px-2.5 py-1 rounded transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 3: Filter bar ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="rounded-lg px-3 py-1.5 pr-7 text-sm bg-slate-100 text-slate-700 placeholder-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Event filter */}
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Events</option>
          {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>

        {/* Ministry filter */}
        <select
          value={filterMinistry}
          onChange={e => setFilterMinistry(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Ministries</option>
          {ministries.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>

        {/* Assignee filter */}
        <select
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All People</option>
          {assignees.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Statuses</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>

        {hasFilters && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2 flex-wrap">
              {filterEvent && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Event: {filterEvent}</span>}
              {filterMinistry && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Ministry: {filterMinistry}</span>}
              {filterAssignee && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Person: {filterAssignee}</span>}
              {filterStatus && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full capitalize">{filterStatus.replace('_', ' ')}</span>}
              {searchTerm && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">"{searchTerm}"</span>}
              <span className="text-xs text-slate-400">{filtered.length} tasks</span>
              <button
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-red-500 font-medium underline underline-offset-2"
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Main content ── */}
      <main className="p-6">
        {loading && <p className="text-slate-500 text-sm">Loading tasks…</p>}
        {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        {!loading && !error && (
          <div className="flex flex-col gap-6">
            {view === 'List' && (
              <>
                <ListView tasks={paginatedTasks} onEdit={openEdit} />

                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>
                      {' '}–{' '}
                      <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span>
                      {' '}of{' '}
                      <span className="font-medium">{filtered.length}</span>
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50 font-medium text-slate-600"
                      >
                        Previous
                      </button>
                      <span className="flex items-center px-3 text-sm font-semibold text-slate-700">
                        {currentPage} / {totalPages}
                      </span>
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
            {view === 'Report' && <ReportView tasks={filtered} />}
          </div>
        )}
      </main>

      {modalOpen && <TaskModal task={editTask} onClose={closeModal} />}
      {assigneeModalOpen && <AssigneeModal onClose={() => setAssigneeModalOpen(false)} />}
      {eventModalOpen && <EventModal onClose={() => setEventModalOpen(false)} />}
      {ministryModalOpen && <MinistryModal onClose={() => setMinistryModalOpen(false)} />}
    </div>
  )
}
