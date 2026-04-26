import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useTasks } from '../context/TaskContext'
import { computeMemberStatus, STATUS_COLORS } from '../lib/lgStatus'
import LGMemberModal from './LGMemberModal'
import LGMeetingModal from './LGMeetingModal'

function fmtDate(iso) {
  try { return format(parseISO(iso), 'MMM d, yyyy') } catch { return iso }
}

export default function LGGroupPanel({ group, onEditGroup, onDeleteGroup }) {
  const { lgMembers, lgMeetings, deleteLGMember, deleteLGMeeting } = useTasks()

  const [memberModal,  setMemberModal]  = useState(null)  // null | 'add' | member obj
  const [meetingModal, setMeetingModal] = useState(null)  // null | 'add' | meeting obj
  const [expandedMeeting, setExpandedMeeting] = useState(null)

  const groupMembers = useMemo(
    () => lgMembers.filter(m => m.lifegroup_id === group.id),
    [lgMembers, group.id]
  )

  const groupMeetings = useMemo(
    () => lgMeetings
      .filter(m => m.lifegroup_id === group.id)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [lgMeetings, group.id]
  )

  function memberName(id) {
    return lgMembers.find(m => m.id === id)?.name ?? id
  }

  function parseAttendees(meeting) {
    return (meeting.attendees ?? '').split(',').map(s => s.trim()).filter(Boolean)
  }

  async function handleDeleteMember(id) {
    if (!window.confirm('Remove this member?')) return
    await deleteLGMember(id)
  }

  async function handleDeleteMeeting(id) {
    if (!window.confirm('Delete this meeting record?')) return
    await deleteLGMeeting(id)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Group header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-800 text-lg">{group.name}</h2>
          {group.leader && <p className="text-sm text-slate-500">Leader: {group.leader}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onEditGroup}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
            Edit
          </button>
          <button onClick={onDeleteGroup}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            Delete
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">

        {/* ── Members ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div>
              <h3 className="font-semibold text-slate-700 text-sm">Members</h3>
              <p className="text-xs text-slate-400">{groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setMemberModal('add')}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              + Add Member
            </button>
          </div>

          {groupMembers.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-400 text-sm">No members yet</p>
              <button onClick={() => setMemberModal('add')}
                className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 font-medium underline">
                Add the first member
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 hidden sm:table-cell">Contact</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Status</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {groupMembers.map(m => {
                  const status = computeMemberStatus(m.id, groupMeetings)
                  return (
                    <tr key={m.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 group">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs hidden sm:table-cell">{m.contact || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setMemberModal(m)}
                            className="w-6 h-6 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center text-xs transition-colors"
                            title="Edit">✏</button>
                          <button onClick={() => handleDeleteMember(m.id)}
                            className="w-6 h-6 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-xs transition-colors"
                            title="Remove">×</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Meetings ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div>
              <h3 className="font-semibold text-slate-700 text-sm">Meetings</h3>
              <p className="text-xs text-slate-400">{groupMeetings.length} session{groupMeetings.length !== 1 ? 's' : ''} logged</p>
            </div>
            <button onClick={() => setMeetingModal('add')}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              + Log Meeting
            </button>
          </div>

          {groupMeetings.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-400 text-sm">No meetings logged yet</p>
              <button onClick={() => setMeetingModal('add')}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium underline">
                Log the first meeting
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groupMeetings.map(mt => {
                const ids      = parseAttendees(mt)
                const isOpen   = expandedMeeting === mt.id
                return (
                  <div key={mt.id} className="group">
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedMeeting(isOpen ? null : mt.id)}
                    >
                      {/* Date */}
                      <div className="flex-shrink-0 w-20 text-center bg-slate-100 rounded-lg py-1.5">
                        <p className="text-[10px] text-slate-500 font-medium uppercase leading-none">
                          {mt.date ? format(parseISO(mt.date), 'MMM') : '—'}
                        </p>
                        <p className="text-base font-bold text-slate-700 leading-tight">
                          {mt.date ? format(parseISO(mt.date), 'd') : '—'}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-none">
                          {mt.date ? format(parseISO(mt.date), 'yyyy') : ''}
                        </p>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">
                          {ids.length} / {groupMembers.length} attended
                        </p>
                        {mt.notes && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{mt.notes}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setMeetingModal(mt) }}
                          className="w-6 h-6 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center text-xs"
                          title="Edit">✏</button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteMeeting(mt.id) }}
                          className="w-6 h-6 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-xs"
                          title="Delete">×</button>
                      </div>

                      <span className="text-slate-300 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded attendees */}
                    {isOpen && (
                      <div className="px-4 pb-3 pt-0 bg-slate-50/50 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Attended</p>
                        {ids.length === 0 ? (
                          <p className="text-xs text-slate-400">No one recorded</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {ids.map(id => (
                              <span key={id} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                {memberName(id)}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Who was absent */}
                        {groupMembers.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-slate-500 mt-3 mb-2 uppercase tracking-wider">Absent</p>
                            {groupMembers.filter(m => !ids.includes(m.id)).length === 0 ? (
                              <p className="text-xs text-emerald-600 font-medium">Everyone attended! 🎉</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {groupMembers.filter(m => !ids.includes(m.id)).map(m => (
                                  <span key={m.id} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {mt.notes && (
                          <p className="text-xs text-slate-500 mt-3 italic border-t border-slate-200 pt-2">{mt.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {memberModal && (
        <LGMemberModal
          lifegroupId={group.id}
          member={memberModal === 'add' ? null : memberModal}
          onClose={() => setMemberModal(null)}
        />
      )}
      {meetingModal && (
        <LGMeetingModal
          lifegroupId={group.id}
          meeting={meetingModal === 'add' ? null : meetingModal}
          onClose={() => setMeetingModal(null)}
        />
      )}
    </div>
  )
}
