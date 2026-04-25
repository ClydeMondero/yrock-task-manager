import { useState, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import { parseProgramFromImage, parseProgramFromText } from '../lib/gemini'

// ── Helpers ───────────────────────────────────────────────────────────────────
const COLORS = ['blue', 'green', 'purple', 'red', 'orange', 'pink', 'yellow', 'slate']
const DOT_COLORS = {
  blue: '#3b82f6', green: '#22c55e', purple: '#a855f7',
  red: '#ef4444', orange: '#f97316', pink: '#ec4899',
  yellow: '#eab308', slate: '#94a3b8',
}

function calcDuration(start, end) {
  try {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return (eh * 60 + em) - (sh * 60 + sm)
  } catch { return 0 }
}

function addMinutes(time, mins) {
  try {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + parseInt(mins, 10)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  } catch { return '' }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'source',     label: 'Source'   },
  { key: 'processing', label: 'Analyzing' },
  { key: 'review',     label: 'Review'   },
]

function StepDots({ current }) {
  const idx = STEPS.findIndex(s => s.key === current)
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors
            ${i < idx ? 'bg-emerald-500 text-white' : i === idx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
            {i < idx ? '✓' : i + 1}
          </div>
          <span className={`text-xs ${i === idx ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{s.label}</span>
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SmartImportModal({
  events          = [],   // string[] event names
  eventDatesMap   = {},   // { eventName: string[] }
  existingBlocks  = [],   // all current program blocks (for upsert matching)
  selectedEvent   = '',
  selectedDate    = '',
  onClose,
  onImport,               // async (blocks[], eventName, date) => void
}) {
  const [step,         setStep]         = useState('source')
  const [sourceType,   setSourceType]   = useState(null)  // 'photo' | 'gsheet'
  const [imagePreview, setImagePreview] = useState(null)
  const [gsheetUrl,    setGsheetUrl]    = useState('')
  const [blocks,       setBlocks]       = useState([])
  const [importEvent,  setImportEvent]  = useState(selectedEvent || '')
  const [importDate,   setImportDate]   = useState(selectedDate  || format(new Date(), 'yyyy-MM-dd'))
  const [error,        setError]        = useState('')
  const [importing,    setImporting]    = useState(false)
  const fileRef = useRef()

  // Valid dates constrained to chosen event
  const validDates = importEvent ? (eventDatesMap[importEvent] ?? []) : []

  // title.toLowerCase() → existing block id, for the selected event+date
  const matchMap = useMemo(() => {
    if (!importEvent || !importDate) return {}
    const map = {}
    existingBlocks
      .filter(b => b.event === importEvent && b.date === importDate)
      .forEach(b => { if (b.title) map[b.title.trim().toLowerCase()] = b.id })
    return map
  }, [existingBlocks, importEvent, importDate])

  function handleEventChange(evName) {
    setImportEvent(evName)
    const dates = evName ? (eventDatesMap[evName] ?? []) : []
    if (dates.length && !dates.includes(importDate)) setImportDate(dates[0])
  }

  // ── Image processing ────────────────────────────────────────────────────────
  async function processFile(file) {
    setError('')
    setStep('processing')
    try {
      const base64 = await fileToBase64(file)
      const result = await parseProgramFromImage(base64, file.type)
      setBlocks(result.map((b, i) => ({ ...b, _id: Date.now() + i })))
      setStep('review')
    } catch (e) {
      setError(e.message)
      setStep('source')
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setSourceType('photo')
    setImagePreview(URL.createObjectURL(file))
    processFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) {
      setSourceType('photo')
      setImagePreview(URL.createObjectURL(file))
      processFile(file)
    }
  }

  // ── GSheet processing ───────────────────────────────────────────────────────
  async function processGSheet() {
    if (!gsheetUrl.trim()) return
    setError('')
    setStep('processing')
    try {
      const match = gsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
      if (!match) throw new Error('Invalid Google Sheet URL — copy it from the browser address bar')
      const sheetId  = match[1]
      const gidMatch = gsheetUrl.match(/[?&]gid=(\d+)/)
      const gid      = gidMatch ? gidMatch[1] : '0'

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
      const res    = await fetch(csvUrl)
      if (!res.ok) throw new Error('Could not fetch sheet. Make sure sharing is "Anyone with the link can view".')
      const csv    = await res.text()

      const result = await parseProgramFromText(csv)
      setBlocks(result.map((b, i) => ({ ...b, _id: Date.now() + i })))
      setStep('review')
    } catch (e) {
      setError(e.message)
      setStep('source')
    }
  }

  // ── Row editing ─────────────────────────────────────────────────────────────
  function updateBlock(id, field, value) {
    setBlocks(prev => prev.map(b => {
      if (b._id !== id) return b
      const u = { ...b, [field]: value }
      // Auto-sync duration ↔ times
      if ((field === 'start_time' || field === 'end_time') && u.start_time && u.end_time) {
        u.duration = calcDuration(u.start_time, u.end_time)
      }
      if (field === 'duration' && u.start_time) {
        u.end_time = addMinutes(u.start_time, value)
      }
      return u
    }))
  }

  function removeBlock(id) {
    setBlocks(prev => prev.filter(b => b._id !== id))
  }

  function addRow() {
    const last  = blocks[blocks.length - 1]
    const start = last?.end_time || '08:00'
    setBlocks(prev => [...prev, {
      _id: Date.now(), title: '', start_time: start,
      end_time: addMinutes(start, 15), duration: 15,
      assignee: '', notes: '', color: 'slate',
    }])
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function handleImport() {
    const valid = blocks.filter(b => b.title?.trim() && b.start_time)
    if (!valid.length)   { setError('No valid blocks — each row needs a title and start time'); return }
    if (!importEvent)    { setError('Select an event to import into'); return }
    if (!importDate)     { setError('Select a date'); return }
    setError('')
    setImporting(true)
    // Attach _existingId so parent knows which blocks to update vs create
    const enriched = valid.map(b => ({
      ...b,
      _existingId: matchMap[b.title.trim().toLowerCase()] ?? null,
    }))
    try {
      await onImport(enriched, importEvent, importDate)
      onClose()
    } catch (e) {
      setError(e.message)
      setImporting(false)
    }
  }

  const validBlocks   = blocks.filter(b => b.title?.trim())
  const validCount    = validBlocks.length
  const updateCount   = validBlocks.filter(b => matchMap[b.title?.trim().toLowerCase()]).length
  const newCount      = validCount - updateCount

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Smart Import</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">AI-powered program flow extraction</p>
            </div>
            <StepDots current={step} />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Step: source */}
          {step === 'source' && (
            <div className="p-6 flex flex-col gap-5">
              <p className="text-sm text-slate-500">
                Upload a photo of a whiteboard/printed schedule, or paste a Google Sheet URL.
                AI normalizes everything to your program schema automatically.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">

                {/* Photo */}
                <div
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors
                    ${sourceType === 'photo' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                  onClick={() => { setSourceType('photo'); fileRef.current?.click() }}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-700 text-sm">Photo / Whiteboard</p>
                    <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, HEIC — drag & drop or click</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-medium">Browse files</span>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                {/* Google Sheet */}
                <div
                  className={`border-2 rounded-xl p-6 flex flex-col gap-3 transition-colors
                    ${sourceType === 'gsheet' ? 'border-purple-400 bg-purple-50' : 'border-slate-200 hover:border-purple-200'}`}
                  onClick={() => setSourceType('gsheet')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">Google Sheet</p>
                      <p className="text-xs text-slate-400">Paste the sheet URL below</p>
                    </div>
                  </div>
                  <input
                    type="url"
                    value={gsheetUrl}
                    onChange={e => { setGsheetUrl(e.target.value); setSourceType('gsheet') }}
                    onClick={e => e.stopPropagation()}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 w-full bg-white"
                  />
                  <p className="text-[10px] text-slate-400 -mt-1">
                    Sheet must be shared as "Anyone with the link can view"
                  </p>
                  <button
                    type="button"
                    disabled={!gsheetUrl.trim()}
                    onClick={e => { e.stopPropagation(); processGSheet() }}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors self-start"
                  >
                    Analyze Sheet →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: processing */}
          {step === 'processing' && (
            <div className="p-16 flex flex-col items-center gap-5">
              {imagePreview && (
                <img src={imagePreview} alt="Uploaded preview"
                  className="max-h-48 rounded-xl border border-slate-200 shadow-sm object-contain" />
              )}
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">AI is analyzing your program flow…</p>
                <p className="text-xs text-slate-400 mt-1">Usually takes 5–15 seconds</p>
              </div>
            </div>
          )}

          {/* Step: review */}
          {step === 'review' && (
            <div className="flex flex-col">

              {/* Event + date selectors */}
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-4 flex-wrap shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Import into:</span>
                  <select value={importEvent} onChange={e => handleEventChange(e.target.value)}
                    className={`border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400
                      ${!importEvent ? 'border-orange-300 bg-orange-50' : 'border-slate-300'}`}>
                    <option value="">— Select Event —</option>
                    {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Date:</span>
                  {validDates.length > 0 ? (
                    <select value={importDate} onChange={e => setImportDate(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      {validDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  )}
                </div>
                <div className="flex-1" />
                <span className="text-xs text-slate-400 font-medium">{blocks.length} blocks extracted</span>
              </div>

              {error && (
                <div className="mx-6 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[860px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['', '#', 'Title / Segment', 'Start', 'End', 'Mins', 'Assignee', 'Color', 'Notes', ''].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((block, i) => (
                      <tr key={block._id}
                        className={`border-b border-slate-100 group ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>

                        {/* UPDATE / NEW badge */}
                        <td className="pl-3 pr-1 py-1.5 w-16">
                          {block.title?.trim() && (
                            matchMap[block.title.trim().toLowerCase()]
                              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wider">update</span>
                              : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase tracking-wider">new</span>
                          )}
                        </td>
                        {/* # */}
                        <td className="px-3 py-1.5 text-xs text-slate-400 w-6">{i + 1}</td>

                        {/* Title */}
                        <td className="px-3 py-1.5">
                          <input
                            value={block.title || ''}
                            onChange={e => updateBlock(block._id, 'title', e.target.value)}
                            placeholder="Segment name…"
                            className={`w-full min-w-[150px] border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent
                              ${!block.title?.trim() ? 'border-orange-300 bg-orange-50/50' : 'border-transparent hover:border-slate-300 focus:border-blue-400'}`}
                          />
                        </td>

                        {/* Start */}
                        <td className="px-3 py-1.5 w-28">
                          <input type="time" value={block.start_time || ''}
                            onChange={e => updateBlock(block._id, 'start_time', e.target.value)}
                            className="border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent w-full" />
                        </td>

                        {/* End */}
                        <td className="px-3 py-1.5 w-28">
                          <input type="time" value={block.end_time || ''}
                            onChange={e => updateBlock(block._id, 'end_time', e.target.value)}
                            className="border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent w-full" />
                        </td>

                        {/* Duration */}
                        <td className="px-3 py-1.5 w-16">
                          <input type="number" value={block.duration ?? ''}
                            onChange={e => updateBlock(block._id, 'duration', e.target.value)}
                            min="1"
                            className="border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent w-full" />
                        </td>

                        {/* Assignee */}
                        <td className="px-3 py-1.5">
                          <input value={block.assignee || ''}
                            onChange={e => updateBlock(block._id, 'assignee', e.target.value)}
                            placeholder="WORSHIP / CHI"
                            className="w-full min-w-[110px] border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                        </td>

                        {/* Color */}
                        <td className="px-3 py-1.5 w-36">
                          <div className="flex gap-1 flex-wrap">
                            {COLORS.map(c => (
                              <button key={c} type="button"
                                onClick={() => updateBlock(block._id, 'color', c)}
                                style={{ background: DOT_COLORS[c] }}
                                title={c}
                                className={`w-4 h-4 rounded-full transition-transform
                                  ${block.color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-125' : 'opacity-50 hover:opacity-100 hover:scale-110'}`}
                              />
                            ))}
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-1.5">
                          <input value={block.notes || ''}
                            onChange={e => updateBlock(block._id, 'notes', e.target.value)}
                            placeholder="Notes…"
                            className="w-full min-w-[100px] border border-transparent hover:border-slate-300 focus:border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-1.5 w-8">
                          <button onClick={() => removeBlock(block._id)}
                            className="w-5 h-5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-xs transition-colors opacity-0 group-hover:opacity-100">
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add row */}
              <div className="px-6 py-3 border-t border-slate-100">
                <button onClick={addRow}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5">
                  <span className="text-sm font-bold leading-none">+</span> Add row
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 bg-white rounded-b-2xl">
          <button onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            Cancel
          </button>

          {step === 'review' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep('source'); setError('') }}
                className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2">
                {importing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    Import {validCount} block{validCount !== 1 ? 's' : ''}
                    {updateCount > 0 && newCount > 0 && (
                      <span className="text-white/70 font-normal text-xs ml-1">
                        ({newCount} new · {updateCount} update)
                      </span>
                    )}
                    {updateCount > 0 && newCount === 0 && (
                      <span className="text-white/70 font-normal text-xs ml-1">({updateCount} update)</span>
                    )}
                    {' →'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
