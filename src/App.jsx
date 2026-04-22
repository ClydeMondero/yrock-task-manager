import { useState, useMemo, useEffect, useRef } from 'react'
import { useTasks } from './context/TaskContext'
import ListView from './components/ListView'
import KanbanView from './components/KanbanView'
import CalendarView from './components/CalendarView'
import ReportView from './components/ReportView'
import ProgramFlowView from './components/ProgramFlowView'
import TaskModal from './components/TaskModal'
import AssigneeModal from './components/AssigneeModal'
import EventModal from './components/EventModal'
import MinistryModal from './components/MinistryModal'
import AIAssistant from './components/AIAssistant'

const VIEWS = ['List', 'Kanban', 'Calendar', 'Report', 'Program']
const ITEMS_PER_PAGE = 15

// ── Multi-select dropdown filter ─────────────────────────────────────────────
function MultiSelectFilter({ label, options, selected, onChange, colorCls = 'bg-blue-600' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(value) {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
  }

  function clear(e) {
    e.stopPropagation()
    onChange([])
  }

  const count = selected.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border transition-colors
          ${count > 0
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}
      >
        <span>{label}</span>
        {count > 0 && (
          <>
            <span className={`text-xs font-bold text-white px-1.5 py-0.5 rounded-full leading-none ${colorCls}`}>
              {count}
            </span>
            <span
              onClick={clear}
              className="text-blue-400 hover:text-blue-700 leading-none text-base"
              title="Clear"
            >
              ×
            </span>
          </>
        )}
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-40 bg-white border border-slate-200 rounded-xl shadow-lg min-w-44 py-1 max-h-64 overflow-y-auto">
          {options.length === 0 && (
            <p className="text-xs text-slate-400 px-3 py-2">No options</p>
          )}
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.name
            const isSelected = selected.includes(val)
            return (
              <button
                key={val}
                onClick={() => toggle(val)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors
                  ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px]
                  ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                  {isSelected ? '✓' : ''}
                </span>
                {val}
              </button>
            )
          })}
          {selected.length > 0 && (
            <>
              <div className="border-t border-slate-100 mt-1 pt-1" />
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('List')
  const [modalOpen, setModalOpen] = useState(false)
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [ministryModalOpen, setMinistryModalOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)

  const [filterEvent, setFilterEvent] = useState('')
  const [filterMinistries, setFilterMinistries] = useState([])   // array
  const [filterAssignees, setFilterAssignees] = useState([])     // array
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

      // Ministry: task's comma-separated list must overlap with selected set
      const taskMinistries = (t.ministry ?? '').split(',').map(s => s.trim()).filter(Boolean)
      const matchMinistry = filterMinistries.length === 0
        || filterMinistries.some(m => taskMinistries.includes(m))

      // Assignee: task's comma-separated list must overlap with selected set
      const taskAssignees = (t.assignee ?? '').split(',').map(s => s.trim()).filter(Boolean)
      const matchAssignee = filterAssignees.length === 0
        || filterAssignees.some(a => taskAssignees.includes(a))

      const matchStatus = !filterStatus || t.status === filterStatus
      const matchSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())

      return matchEvent && matchMinistry && matchAssignee && matchStatus && matchSearch
    })
  }, [tasks, filterEvent, filterMinistries, filterAssignees, filterStatus, searchTerm])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedTasks = useMemo(() => {
    if (view !== 'List') return filtered
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage, view])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterEvent, filterMinistries, filterAssignees, filterStatus, searchTerm])

  function openAdd() { setEditTask(null); setModalOpen(true) }
  function openEdit(task) { setEditTask(task); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditTask(null) }

  const hasFilters = filterEvent || filterMinistries.length || filterAssignees.length || filterStatus || searchTerm

  function clearFilters() {
    setFilterEvent('')
    setFilterMinistries([])
    setFilterAssignees([])
    setFilterStatus('')
    setSearchTerm('')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Row 1: Brand + primary action ── */}
      <div className="bg-blue-600 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-base leading-tight">YROCK Ops Hub</h1>
          <p className="text-blue-200 text-xs">Bustos &amp; Baliuag</p>
        </div>
        {view !== 'Report' && view !== 'Program' && (
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
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 flex-wrap">

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

        {/* Event — single select (events are not multi-valued on tasks) */}
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Events</option>
          {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>

        {/* Ministry — multi-select */}
        <MultiSelectFilter
          label="Ministries"
          options={ministries}
          selected={filterMinistries}
          onChange={setFilterMinistries}
          colorCls="bg-purple-600"
        />

        {/* People — multi-select */}
        <MultiSelectFilter
          label="People"
          options={assignees}
          selected={filterAssignees}
          onChange={setFilterAssignees}
          colorCls="bg-green-600"
        />

        {/* Status — single select */}
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

        {/* Active filter chips + clear */}
        {hasFilters && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterEvent && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  Event: {filterEvent}
                  <button onClick={() => setFilterEvent('')} className="text-blue-400 hover:text-blue-700">×</button>
                </span>
              )}
              {filterMinistries.map(m => (
                <span key={m} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  {m}
                  <button onClick={() => setFilterMinistries(prev => prev.filter(x => x !== m))} className="text-purple-400 hover:text-purple-700">×</button>
                </span>
              ))}
              {filterAssignees.map(a => (
                <span key={a} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  {a}
                  <button onClick={() => setFilterAssignees(prev => prev.filter(x => x !== a))} className="text-green-400 hover:text-green-700">×</button>
                </span>
              ))}
              {filterStatus && (
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1 capitalize">
                  {filterStatus.replace('_', ' ')}
                  <button onClick={() => setFilterStatus('')} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}
              {searchTerm && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="text-amber-400 hover:text-amber-700">×</button>
                </span>
              )}
              <span className="text-xs text-slate-400">{filtered.length} tasks</span>
              <button
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-red-500 font-medium underline underline-offset-2 ml-1"
              >
                Clear all
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
            {view === 'Calendar' && <CalendarView tasks={filtered} events={managedEvents} onEdit={openEdit} />}
            {view === 'Report'  && <ReportView tasks={filtered} />}
            {view === 'Program' && <ProgramFlowView />}
          </div>
        )}
      </main>

      {modalOpen && <TaskModal task={editTask} onClose={closeModal} />}
      {assigneeModalOpen && <AssigneeModal onClose={() => setAssigneeModalOpen(false)} />}
      {eventModalOpen && <EventModal onClose={() => setEventModalOpen(false)} />}
      {ministryModalOpen && <MinistryModal onClose={() => setMinistryModalOpen(false)} />}

      <AIAssistant />
    </div>
  )
}
