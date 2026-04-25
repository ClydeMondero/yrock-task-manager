import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { format, parseISO, addDays, addWeeks, addMonths } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import * as sheets from '../lib/sheets'
import { useTasks } from '../context/TaskContext'
import ScreenshotButton from './ScreenshotButton'
import SmartImportModal from './SmartImportModal'

// ── Constants ────────────────────────────────────────────────────────────────
const PX_PER_MIN = 2        // 1 hour = 120px
const START_HOUR = 6        // 6 AM
const END_HOUR   = 23       // 11 PM
const SNAP_MINS  = 5        // snap to 5-minute grid

const COLORS = ['blue', 'green', 'purple', 'red', 'orange', 'pink', 'yellow', 'slate']

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-100',   accent: 'border-l-blue-500',   text: 'text-blue-900',   handle: 'bg-blue-400',   dot: 'bg-blue-500'   },
  green:  { bg: 'bg-green-100',  accent: 'border-l-green-500',  text: 'text-green-900',  handle: 'bg-green-400',  dot: 'bg-green-500'  },
  purple: { bg: 'bg-purple-100', accent: 'border-l-purple-500', text: 'text-purple-900', handle: 'bg-purple-400', dot: 'bg-purple-500' },
  red:    { bg: 'bg-red-100',    accent: 'border-l-red-500',    text: 'text-red-900',    handle: 'bg-red-400',    dot: 'bg-red-500'    },
  orange: { bg: 'bg-orange-100', accent: 'border-l-orange-500', text: 'text-orange-900', handle: 'bg-orange-400', dot: 'bg-orange-500' },
  pink:   { bg: 'bg-pink-100',   accent: 'border-l-pink-500',   text: 'text-pink-900',   handle: 'bg-pink-400',   dot: 'bg-pink-500'   },
  yellow: { bg: 'bg-yellow-100', accent: 'border-l-yellow-400', text: 'text-yellow-900', handle: 'bg-yellow-400', dot: 'bg-yellow-400' },
  slate:  { bg: 'bg-slate-100',  accent: 'border-l-slate-400',  text: 'text-slate-900',  handle: 'bg-slate-400',  dot: 'bg-slate-500'  },
}

// ── Time helpers ─────────────────────────────────────────────────────────────
function toMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
function toTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function snap(mins) { return Math.round(mins / SNAP_MINS) * SNAP_MINS }
function fmt(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`
}

// ── Event date generator ─────────────────────────────────────────────────────
// recurring values:
//   0–6  → weekly on that day-of-week (0=Sun … 6=Sat)
//   'weekly'  → every 7 days from start_date
//   'monthly' → every month from start_date
//   'daily'   → every day
//   'none'/empty → single date (or daily range if end_date present)
const CAP_DATE = addWeeks(new Date(), 104) // 2-year cap for infinite recurring

function getEventDates(ev) {
  if (!ev?.start_date) return []
  const start = parseISO(ev.start_date)
  const end   = ev.end_date ? parseISO(ev.end_date) : null
  const rec   = ev.recurring ?? ''

  // ── Numeric 0-6: weekly on that day-of-week ──────────────────────────────
  const dowNum = parseInt(rec, 10)
  if (!isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
    const stop = end ?? CAP_DATE
    const dates = []
    let d = new Date(start)
    // Advance to first occurrence of desired weekday on or after start
    while (d.getDay() !== dowNum) d = addDays(d, 1)
    while (d <= stop) { dates.push(format(d, 'yyyy-MM-dd')); d = addWeeks(d, 1) }
    return dates
  }

  const recStr = String(rec).toLowerCase().trim()

  if (recStr === 'weekly') {
    const stop = end ?? CAP_DATE
    const dates = []
    let d = start
    while (d <= stop) { dates.push(format(d, 'yyyy-MM-dd')); d = addWeeks(d, 1) }
    return dates
  }
  if (recStr === 'monthly') {
    const stop = end ?? CAP_DATE
    const dates = []
    let d = start
    while (d <= stop) { dates.push(format(d, 'yyyy-MM-dd')); d = addMonths(d, 1) }
    return dates
  }
  if (recStr === 'daily') {
    const stop = end ?? addWeeks(start, 4)
    const dates = []
    let d = start
    while (d <= stop) { dates.push(format(d, 'yyyy-MM-dd')); d = addDays(d, 1) }
    return dates
  }

  // none / empty: if end_date present → every day in range; else single date
  if (end) {
    const dates = []
    let d = start
    while (d <= end) { dates.push(format(d, 'yyyy-MM-dd')); d = addDays(d, 1) }
    return dates
  }
  return [format(start, 'yyyy-MM-dd')]
}

function fmtDateLabel(iso) {
  try {
    return format(parseISO(iso), 'EEE, MMM d, yyyy')
  } catch { return iso }
}

// ── Single block ─────────────────────────────────────────────────────────────
function Block({ block, onUpdate, onDelete, onEdit }) {
  const [liveStart, setLiveStart] = useState(block.start_time)
  const [liveEnd,   setLiveEnd]   = useState(block.end_time)

  useEffect(() => { setLiveStart(block.start_time) }, [block.start_time])
  useEffect(() => { setLiveEnd(block.end_time) },     [block.end_time])

  const top    = (toMins(liveStart) - START_HOUR * 60) * PX_PER_MIN
  const height = Math.max((toMins(liveEnd) - toMins(liveStart)) * PX_PER_MIN, SNAP_MINS * PX_PER_MIN * 3)
  const c      = COLOR_MAP[block.color] ?? COLOR_MAP.blue

  // ── Move drag ──────────────────────────────────────────────────────────────
  function onMoveDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    const y0       = e.clientY
    const s0       = toMins(block.start_time)
    const dur      = toMins(block.end_time) - s0
    let didMove    = false

    function move(e) {
      const delta = snap(( e.clientY - y0) / PX_PER_MIN)
      if (Math.abs(e.clientY - y0) > 4) didMove = true
      const ns = Math.max(START_HOUR * 60, Math.min(s0 + delta, END_HOUR * 60 - dur))
      setLiveStart(toTime(ns))
      setLiveEnd(toTime(ns + dur))
    }
    function up(e) {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      if (!didMove) { onEdit(block); return }
      const delta = snap((e.clientY - y0) / PX_PER_MIN)
      const ns = Math.max(START_HOUR * 60, Math.min(s0 + delta, END_HOUR * 60 - dur))
      onUpdate(block.id, { start_time: toTime(ns), end_time: toTime(ns + dur) })
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  // ── Resize drag ────────────────────────────────────────────────────────────
  function onResizeDown(e) {
    e.preventDefault()
    e.stopPropagation()
    const y0  = e.clientY
    const e0  = toMins(block.end_time)
    const min = toMins(block.start_time) + 15

    function move(e) {
      const ne = Math.max(min, Math.min(snap(e0 + (e.clientY - y0) / PX_PER_MIN), END_HOUR * 60))
      setLiveEnd(toTime(ne))
    }
    function up(e) {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      const ne = Math.max(min, Math.min(snap(e0 + (e.clientY - y0) / PX_PER_MIN), END_HOUR * 60))
      onUpdate(block.id, { end_time: toTime(ne) })
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <div
      style={{ position: 'absolute', top, left: 4, right: 4, height, zIndex: 10 }}
      className={`${c.bg} ${c.text} border-l-4 ${c.accent} rounded-r-lg shadow-sm select-none cursor-grab active:cursor-grabbing group overflow-hidden`}
      onMouseDown={onMoveDown}
    >
      {/* Content */}
      <div className="px-2 pt-1 pb-4 h-full overflow-hidden">
        {/* Title + time on one line when block is short */}
        {height < 45 ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[10px] font-semibold leading-tight truncate flex-1">{block.title}</p>
            <p className="text-[10px] opacity-50 whitespace-nowrap flex-shrink-0">{fmt(liveStart)}</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold leading-tight truncate">{block.title}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{fmt(liveStart)} – {fmt(liveEnd)}</p>
          </>
        )}

        {/* Assignee chips — horizontal row, wraps if tall enough */}
        {block.assignee && height >= 30 && (() => {
          const names = block.assignee.split(/\s*[\/,]\s*/).map(s => s.trim()).filter(Boolean)
          const isShort = height < 60
          return (
            <div className={`mt-0.5 flex flex-wrap gap-0.5 ${isShort ? '' : 'mt-1'}`}>
              {names.map(name => (
                <span key={name}
                  className="inline-block px-1 py-0.5 rounded text-[9px] font-medium leading-tight opacity-80"
                  style={{ background: 'rgba(0,0,0,0.12)' }}>
                  {name}
                </span>
              ))}
            </div>
          )
        })()}

        {block.notes && height > 80 && (
          <p className="text-[10px] opacity-50 truncate mt-0.5 italic">{block.notes}</p>
        )}
      </div>

      {/* Delete × */}
      <button
        onMouseDown={e => { e.stopPropagation(); onDelete(block.id) }}
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/10 hover:bg-red-500 hover:text-white text-[10px] hidden group-hover:flex items-center justify-center leading-none"
      >
        ×
      </button>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeDown}
        className={`absolute bottom-0 left-0 right-0 h-2.5 cursor-s-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${c.handle} rounded-b`}
      >
        <div className="w-6 h-0.5 bg-white/60 rounded-full" />
      </div>
    </div>
  )
}

// Parse "CHI / ALL" or "CHI, ALL" → ['CHI', 'ALL']
function parseAssigneeStr(str) {
  if (!str) return []
  return str.split(/\s*[\/,]\s*/).map(s => s.trim()).filter(Boolean)
}

// ── Block add/edit modal ──────────────────────────────────────────────────────
function BlockModal({ block, events, eventDatesMap, assignees, ministries, onSave, onClose }) {
  const isEdit = !!block.id
  const [form, setForm] = useState({
    title:      block.title      ?? '',
    event:      block.event      ?? '',
    date:       block.date       ?? format(new Date(), 'yyyy-MM-dd'),
    start_time: block.start_time ?? '09:00',
    end_time:   block.end_time   ?? '10:00',
    color:      block.color      ?? 'blue',
    notes:      block.notes      ?? '',
  })

  // Multi-assignee: parse existing " / " or ", " separated string
  const [selAssignees, setSelAssignees] = useState(() => parseAssigneeStr(block.assignee))

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Valid dates for the currently selected event (empty = free pick)
  const validDates = form.event ? (eventDatesMap[form.event] ?? []) : []

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setEvent(evName) {
    const dates = eventDatesMap[evName] ?? []
    setForm(f => ({
      ...f,
      event: evName,
      date: dates.length && !dates.includes(f.date) ? dates[0] : f.date,
    }))
  }

  // All known names: ministries + assignees people
  const allNames = [
    ...ministries.map(m => ({ name: m.name, ministry: null, _isMinistry: true })),
    ...assignees.map(a => ({ name: a.name, ministry: a.ministry, _isMinistry: false })),
  ]

  function toggleName(name) {
    setSelAssignees(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function selectAll() {
    const all = allNames.map(a => a.name)
    setSelAssignees(all)
  }

  function clearAll() { setSelAssignees([]) }

  // Group people by ministry
  const grouped = ministries.map(m => ({
    ministry: m.name,
    people: assignees.filter(a => a.ministry === m.name),
  })).filter(g => g.people.length > 0)
  const ungrouped = assignees.filter(a => !a.ministry || !ministries.find(m => m.name === a.ministry))

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setErr('Title is required'); return }
    if (toMins(form.end_time) <= toMins(form.start_time)) { setErr('End time must be after start time'); return }
    setSaving(true)
    const assignee = selAssignees.join(' / ')
    try {
      await onSave(isEdit ? { ...block, ...form, assignee } : { ...form, assignee })
    } catch (e) { setErr(e.message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Block' : 'New Block'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <form onSubmit={submit} className="px-6 py-4 flex flex-col gap-3">
          {err && <p className="text-red-500 text-sm">{err}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Title *</span>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Worship" autoFocus />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Event</span>
              <select value={form.event} onChange={e => setEvent(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">None</option>
                {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Date</span>
              {validDates.length > 0 ? (
                <select value={form.date} onChange={e => set('date', e.target.value)}
                  className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {validDates.map(d => (
                    <option key={d} value={d}>{fmtDateLabel(d)}</option>
                  ))}
                </select>
              ) : (
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              )}
              {validDates.length > 0 && (
                <span className="text-[10px] text-slate-400">{validDates.length} session{validDates.length !== 1 ? 's' : ''} for this event</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Start</span>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">End</span>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </label>
          </div>

          {/* ── Assignee multi-select ── */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Assignees</span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider">
                  Select All
                </button>
                {selAssignees.length > 0 && (
                  <button type="button" onClick={clearAll}
                    className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase tracking-wider">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Chips */}
            {selAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {selAssignees.map(name => (
                  <span key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {name}
                    <button type="button" onClick={() => toggleName(name)}
                      className="text-blue-400 hover:text-blue-700 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="border border-slate-300 rounded max-h-44 overflow-y-auto">

              {/* Ministry-level */}
              {ministries.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    Ministries
                  </div>
                  {ministries.map(m => {
                    const sel = selAssignees.includes(m.name)
                    return (
                      <button key={m.id} type="button" onClick={() => toggleName(m.name)}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-slate-50 ${sel ? 'bg-purple-50' : ''}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                          ${sel ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                          {sel ? '✓' : ''}
                        </span>
                        <span className={sel ? 'text-purple-700 font-medium' : 'text-slate-700'}>🏛 {m.name}</span>
                      </button>
                    )
                  })}
                </>
              )}

              {/* People grouped by ministry */}
              {grouped.map(({ ministry: mName, people }) => (
                <div key={mName}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-y border-slate-100">
                    {mName}
                  </div>
                  {people.map(a => {
                    const sel = selAssignees.includes(a.name)
                    return (
                      <button key={a.id} type="button" onClick={() => toggleName(a.name)}
                        className={`w-full text-left px-3 py-1.5 pl-5 text-sm flex items-center gap-2 hover:bg-slate-50 ${sel ? 'bg-blue-50' : ''}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                          ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                          {sel ? '✓' : ''}
                        </span>
                        <span className={sel ? 'text-blue-700 font-medium' : 'text-slate-700'}>{a.name}</span>
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
                    const sel = selAssignees.includes(a.name)
                    return (
                      <button key={a.id} type="button" onClick={() => toggleName(a.name)}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-slate-50 ${sel ? 'bg-blue-50' : ''}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px]
                          ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                          {sel ? '✓' : ''}
                        </span>
                        <span className={sel ? 'text-blue-700 font-medium' : 'text-slate-700'}>{a.name}</span>
                      </button>
                    )
                  })}
                </>
              )}

              {allNames.length === 0 && (
                <p className="text-xs text-slate-400 px-3 py-2">No people yet — add via Manage → People</p>
              )}
            </div>
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Color</span>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className={`w-6 h-6 rounded-full ${COLOR_MAP[c].dot} transition-transform ${form.color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-125' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Optional notes…" />
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
const TOTAL_H = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN

export default function ProgramFlowView() {
  const { events: managedEvents, assignees, ministries, addMinistry } = useTasks()
  const events = useMemo(() => managedEvents.map(e => e.name).sort(), [managedEvents])

  // Map: event name → sorted valid dates
  const eventDatesMap = useMemo(() => {
    const map = {}
    managedEvents.forEach(ev => {
      const dates = getEventDates(ev)
      if (dates.length) map[ev.name] = dates
    })
    return map
  }, [managedEvents])

  const [blocks,        setBlocks]        = useState([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedDate,  setSelectedDate]  = useState(format(new Date(), 'yyyy-MM-dd'))
  const [editBlock,     setEditBlock]     = useState(null)
  const [copied,        setCopied]        = useState(false)
  const [showImport,    setShowImport]    = useState(false)

  // Valid dates for the currently selected event (main timeline picker)
  const mainValidDates = selectedEvent ? (eventDatesMap[selectedEvent] ?? []) : []

  const printRef      = useRef(null)
  const bgRef         = useRef(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchBlocks = useCallback(async () => {
    setLoadingBlocks(true)
    try { setBlocks(await sheets.getProgramFlow()) }
    catch (e) { console.error(e) }
    finally { setLoadingBlocks(false) }
  }, [])

  useEffect(() => { fetchBlocks() }, [fetchBlocks])

  // ── Filtered view ─────────────────────────────────────────────────────────
  const visible = useMemo(() => blocks.filter(b => {
    const me = !selectedEvent || b.event === selectedEvent
    const md = !selectedDate  || b.date  === selectedDate
    return me && md
  }), [blocks, selectedEvent, selectedDate])

  const sortedVisible = useMemo(() => 
    [...visible].sort((a, b) => a.start_time.localeCompare(b.start_time)),
  [visible])

  const copyToClipboard = useCallback(() => {
    if (sortedVisible.length === 0) return
    const header = `${selectedEvent || 'Program Flow'} - ${fmtDateLabel(selectedDate)}\n\n`
    const text = sortedVisible.map(b => {
      const dur = toMins(b.end_time) - toMins(b.start_time)
      return `${fmt(b.start_time)} – ${fmt(b.end_time)} (${dur}m) | ${b.title}${b.assignee ? ` | ${b.assignee}` : ''}`
    }).join('\n')

    navigator.clipboard.writeText(header + text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [sortedVisible, selectedEvent, selectedDate])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleUpdate(id, fields) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...fields } : b))
    try { await sheets.updateBlock(id, fields) }
    catch { fetchBlocks() }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this block?')) return
    setBlocks(prev => prev.filter(b => b.id !== id))
    try { await sheets.deleteBlock(id) }
    catch { fetchBlocks() }
  }

  // ── Auto-create unknown assignee names as ministries, then open modal ────
  async function openEditBlock(block) {
    const names = parseAssigneeStr(block.assignee ?? '')
    const knownNames = [
      ...ministries.map(m => m.name.toLowerCase()),
      ...assignees.map(a => a.name.toLowerCase()),
    ]
    const unknowns = names.filter(n => n && !knownNames.includes(n.toLowerCase()))
    for (const name of unknowns) {
      try { await addMinistry({ name: name.toUpperCase() }) } catch {}
    }
    setEditBlock(block)
  }

  async function handleSave(formData) {
    if (formData.id) {
      setBlocks(prev => prev.map(b => b.id === formData.id ? { ...b, ...formData } : b))
      await sheets.updateBlock(formData.id, formData)
    } else {
      const nb = { ...formData, id: uuidv4(), event: formData.event || selectedEvent, date: formData.date || selectedDate }
      setBlocks(prev => [...prev, nb])
      await sheets.addBlock(nb)
    }
    setEditBlock(null)
  }

  // ── Batch import from SmartImportModal (upsert) ───────────────────────────
  async function handleSmartImport(importedBlocks, eventName, date) {
    for (const b of importedBlocks) {
      const { _existingId, _id, ...fields } = b
      const blockData = { ...fields, event: eventName, date }

      if (_existingId) {
        // UPDATE existing block
        const updated = { ...blockData, id: _existingId }
        setBlocks(prev => prev.map(bl => bl.id === _existingId ? { ...bl, ...updated } : bl))
        try { await sheets.updateBlock(_existingId, updated) }
        catch (e) { console.error('Smart import: failed to update', fields.title, e) }
      } else {
        // CREATE new block
        const nb = { ...blockData, id: uuidv4() }
        setBlocks(prev => [...prev, nb])
        try { await sheets.addBlock(nb) }
        catch (e) { console.error('Smart import: failed to create', fields.title, e) }
      }
    }
  }

  // ── Click empty area → create block ───────────────────────────────────────
  function onBgClick(e) {
    if (e.target !== bgRef.current) return
    const rect = bgRef.current.getBoundingClientRect()
    const y    = e.clientY - rect.top + (bgRef.current.parentElement.scrollTop || 0)
    const mins = snap(y / PX_PER_MIN) + START_HOUR * 60
    setEditBlock({ event: selectedEvent, date: selectedDate, start_time: toTime(mins), end_time: toTime(Math.min(mins + 60, END_HOUR * 60)), color: 'blue' })
  }

  // ── Current time indicator ─────────────────────────────────────────────────
  const nowTop = useMemo(() => {
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60
    return mins * PX_PER_MIN
  }, [])
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex flex-col gap-4">

      {/* ── Controls ── */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3">
        <select value={selectedEvent} onChange={e => {
            const ev = e.target.value
            setSelectedEvent(ev)
            // Snap date to first valid date if current isn't in list
            const dates = ev ? (eventDatesMap[ev] ?? []) : []
            if (dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0])
          }}
          className="rounded-lg px-3 py-1.5 text-sm bg-slate-100 text-slate-600 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Events</option>
          {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>

        {mainValidDates.length > 0 ? (
          <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm bg-slate-100 text-slate-600 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {mainValidDates.map(d => (
              <option key={d} value={d}>{fmtDateLabel(d)}</option>
            ))}
          </select>
        ) : (
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm bg-slate-100 text-slate-600 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        )}

        <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
          Today
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <ScreenshotButton targetRef={printRef} label="Program" />

          <button
            onClick={copyToClipboard}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 shadow-sm active:scale-95 ${
              copied 
                ? 'bg-emerald-500 text-white border-emerald-400' 
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            )}
            <span>{copied ? 'Copied!' : 'Copy Text'}</span>
          </button>
        </div>

        <button
          onClick={() => setShowImport(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Smart Import
        </button>

        <button
          onClick={() => setEditBlock({ event: selectedEvent, date: selectedDate, start_time: '09:00', end_time: '10:00', color: 'blue' })}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + Add Block
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="font-semibold text-slate-800 text-sm">
              {selectedEvent || 'All Events'}
            </h2>
            <p className="text-xs text-slate-400">
              {selectedDate} · {visible.length} block{visible.length !== 1 ? 's' : ''} · Click empty space to add
            </p>
          </div>
          {loadingBlocks && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
        </div>

        {/* Scrollable timeline */}
        <div className="overflow-y-auto" style={{ maxHeight: '72vh' }}>
          <div className="flex">

            {/* Hour labels */}
            <div className="flex-shrink-0 w-14 bg-white border-r border-slate-100 relative select-none" style={{ height: TOTAL_H }}>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                const h   = START_HOUR + i
                const top = i * 60 * PX_PER_MIN
                return (
                  <div key={h} style={{ position: 'absolute', top: top - 7 }} className="w-full px-2 text-right">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Grid + blocks */}
            <div className="flex-1 relative" style={{ height: TOTAL_H }}>

              {/* Hour lines */}
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div key={i} style={{ position: 'absolute', top: i * 60 * PX_PER_MIN, left: 0, right: 0, zIndex: 0 }}
                  className="border-t border-slate-100" />
              ))}
              {/* Half-hour lines */}
              {Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => (
                <div key={i} style={{ position: 'absolute', top: i * 30 * PX_PER_MIN, left: 0, right: 0, zIndex: 0 }}
                  className="border-t border-slate-50" />
              ))}

              {/* Current time line */}
              {isToday && nowTop > 0 && nowTop < TOTAL_H && (
                <div style={{ position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 20 }}
                  className="flex items-center gap-1 pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                  <div className="flex-1 h-px bg-red-400" />
                </div>
              )}

              {/* Clickable background layer */}
              <div ref={bgRef} onClick={onBgClick}
                style={{ position: 'absolute', inset: 0, zIndex: 1 }} className="cursor-crosshair" />

              {/* Blocks */}
              {visible.map(block => (
                <Block
                  key={block.id}
                  block={block}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onEdit={openEditBlock}
                />
              ))}

              {/* Empty state */}
              {visible.length === 0 && !loadingBlocks && (
                <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, zIndex: 2 }}
                  className="flex flex-col items-center gap-2 pointer-events-none">
                  <p className="text-slate-300 text-sm font-medium">No blocks yet</p>
                  <p className="text-slate-300 text-xs">Click anywhere on the timeline to add one</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Off-screen print layout (captured by ScreenshotButton) ── */}
      <div style={{ position: 'absolute', left: -9999, top: 0, pointerEvents: 'none' }}>
        <div ref={printRef} style={{
          width: 640, background: '#ffffff', fontFamily: 'sans-serif',
        }}>
          {/* Header */}
          <div style={{ padding: '16px 20px 10px', borderBottom: '2px solid #1e3a5f', background: '#1e3a5f' }}>
            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>
              {selectedEvent || 'Program Flow'}
            </div>
            <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 2 }}>
              {fmtDateLabel(selectedDate)}
            </div>
          </div>

          {sortedVisible.length === 0 ? (
            <div style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
              No blocks for this date.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['TIME', 'DURATION', 'SEGMENT', 'VOLUNTEERS / IN-CHARGE'].map(h => (
                    <th key={h} style={{
                      padding: '7px 10px', textAlign: 'left', fontSize: 10,
                      fontWeight: 700, color: '#475569', letterSpacing: '0.05em',
                      borderBottom: '1px solid #e2e8f0',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedVisible.map((block, i) => {
                  const dur = toMins(block.end_time) - toMins(block.start_time)
                  const accentColors = {
                    blue: '#3b82f6', green: '#22c55e', purple: '#a855f7',
                    red: '#ef4444', orange: '#f97316', pink: '#ec4899',
                    yellow: '#eab308', slate: '#94a3b8',
                  }
                  const accent = accentColors[block.color] ?? '#3b82f6'
                  return (
                    <tr key={block.id} style={{
                      background: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderLeft: `3px solid ${accent}`,
                    }}>
                      <td style={{ padding: '7px 10px', color: '#1e293b', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {fmt(block.start_time)} – {fmt(block.end_time)}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>
                        {dur} mins
                      </td>
                      <td style={{ padding: '7px 10px', color: '#1e293b', fontWeight: 600 }}>
                        {block.title}
                        {block.notes ? (
                          <div style={{ fontWeight: 400, color: '#64748b', fontSize: 10, marginTop: 1 }}>{block.notes}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#334155' }}>
                        {block.assignee || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Footer */}
          <div style={{ padding: '8px 20px', borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8' }}>
            YROCK Ops Hub · {sortedVisible.length} segment{sortedVisible.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── Block edit modal ── */}
      {editBlock !== null && (
        <BlockModal
          block={editBlock}
          events={events}
          eventDatesMap={eventDatesMap}
          assignees={assignees}
          ministries={ministries}
          onSave={handleSave}
          onClose={() => setEditBlock(null)}
        />
      )}

      {/* ── Smart Import modal ── */}
      {showImport && (
        <SmartImportModal
          events={events}
          eventDatesMap={eventDatesMap}
          existingBlocks={blocks}
          selectedEvent={selectedEvent}
          selectedDate={selectedDate}
          onClose={() => setShowImport(false)}
          onImport={handleSmartImport}
        />
      )}
    </div>
  )
}
