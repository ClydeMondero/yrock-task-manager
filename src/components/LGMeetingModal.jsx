import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useTasks } from '../context/TaskContext'

export default function LGMeetingModal({ lifegroupId, meeting = null, onClose }) {
  const { lgMembers, addLGMeeting, updateLGMeeting } = useTasks()
  const isEdit = !!meeting?.id

  const groupMembers = useMemo(
    () => lgMembers.filter(m => m.lifegroup_id === lifegroupId),
    [lgMembers, lifegroupId]
  )

  // Pre-parse existing attendees (array of member IDs)
  const initialAttendees = useMemo(() => {
    if (!meeting?.attendees) return []
    return meeting.attendees.split(',').map(s => s.trim()).filter(Boolean)
  }, [meeting])

  const [date,      setDate]      = useState(meeting?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [attendees, setAttendees] = useState(initialAttendees)
  const [notes,     setNotes]     = useState(meeting?.notes ?? '')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  function toggleAttendee(id) {
    setAttendees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function selectAll()  { setAttendees(groupMembers.map(m => m.id)) }
  function clearAll()   { setAttendees([]) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!date) { setErr('Date is required'); return }
    setSaving(true)
    const payload = {
      lifegroup_id: lifegroupId,
      date,
      attendees: attendees.join(','),
      notes,
    }
    try {
      if (isEdit) await updateLGMeeting(meeting.id, payload)
      else        await addLGMeeting(payload)
      onClose()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Meeting' : 'Log Meeting'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">
          {err && <p className="text-red-500 text-sm">{err}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Meeting Date *</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </label>

          {/* Member checklist */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Who attended? <span className="text-slate-400 font-normal">({attendees.length}/{groupMembers.length})</span>
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold uppercase tracking-wider">
                  All
                </button>
                {attendees.length > 0 && (
                  <button type="button" onClick={clearAll}
                    className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase tracking-wider">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {groupMembers.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No members yet — add members first.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {groupMembers.map(m => {
                  const checked = attendees.includes(m.id)
                  return (
                    <button key={m.id} type="button" onClick={() => toggleAttendee(m.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors border-b border-slate-100 last:border-b-0
                        ${checked ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px] transition-colors
                        ${checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                        {checked ? '✓' : ''}
                      </span>
                      <span className={`text-sm ${checked ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                        {m.name}
                      </span>
                      {m.contact && (
                        <span className="text-xs text-slate-400 ml-auto">{m.contact}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="What was discussed, highlights, prayer points…" />
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Log Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
