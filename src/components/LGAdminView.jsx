import { useMemo } from 'react'
import { useTasks } from '../context/TaskContext'
import { computeMemberStatus, STATUS_COLORS } from '../lib/lgStatus'
import { format, parseISO, subWeeks } from 'date-fns'

function fmtDate(iso) {
  try { return format(parseISO(iso), 'MMM d, yyyy') } catch { return iso ?? '—' }
}

function AttendanceBadge({ value }) {
  const pct = Math.round(value * 100)
  const cls = pct >= 75 ? 'bg-emerald-100 text-emerald-700'
            : pct >= 40 ? 'bg-amber-100 text-amber-700'
            :              'bg-red-100 text-red-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {pct}%
    </span>
  )
}

export default function LGAdminView() {
  const { lgGroups, lgMembers, lgMeetings } = useTasks()

  const now        = new Date()
  const windowStart = subWeeks(now, 8)

  const groupStats = useMemo(() => lgGroups.map(g => {
    const members  = lgMembers.filter(m => m.lifegroup_id === g.id)
    const meetings = lgMeetings.filter(m => m.lifegroup_id === g.id)
    const recent   = meetings.filter(m => m.date && new Date(m.date) >= windowStart)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

    const parseAttendees = m =>
      (m.attendees ?? '').split(',').map(s => s.trim()).filter(Boolean)

    // Per-member stats
    const memberStats = members.map(m => {
      const status      = computeMemberStatus(m.id, meetings)
      const attendedAll = meetings.filter(mt => parseAttendees(mt).includes(m.id)).length
      const attendedRec = recent.filter(mt => parseAttendees(mt).includes(m.id)).length
      const rate        = recent.length > 0 ? attendedRec / recent.length : 0
      const lastSeen    = meetings
        .filter(mt => parseAttendees(mt).includes(m.id))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]?.date ?? null
      return { ...m, status, attendedAll, attendedRec, rate, lastSeen }
    })

    const statusCounts = {
      Active:    memberStats.filter(m => m.status === 'Active').length,
      Irregular: memberStats.filter(m => m.status === 'Irregular').length,
      Inactive:  memberStats.filter(m => m.status === 'Inactive').length,
      New:       memberStats.filter(m => m.status === 'New').length,
    }

    const overallRate = recent.length === 0 || members.length === 0 ? 0
      : recent.reduce((sum, mt) => sum + parseAttendees(mt).filter(id => members.find(m => m.id === id)).length, 0)
        / (recent.length * members.length)

    const lastMeeting = meetings.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]?.date ?? null

    return { group: g, members, meetings, recent, memberStats, statusCounts, overallRate, lastMeeting }
  }), [lgGroups, lgMembers, lgMeetings])

  if (lgGroups.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="text-slate-400">No lifegroups created yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Lifegroups',    value: lgGroups.length,  color: 'text-emerald-600' },
          { label: 'Total Members', value: lgMembers.length, color: 'text-blue-600'    },
          { label: 'Meetings (8wk)',
            value: lgMeetings.filter(m => m.date && new Date(m.date) >= windowStart).length,
            color: 'text-purple-600' },
          { label: 'Active Members',
            value: groupStats.reduce((s, g) => s + g.statusCounts.Active, 0),
            color: 'text-emerald-600' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center shadow-sm">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Per-group cards */}
      {groupStats.map(({ group: g, members, recent, memberStats, statusCounts, overallRate, lastMeeting }) => (
        <div key={g.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

          {/* Group header */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800">{g.name}</h3>
              <p className="text-xs text-slate-500">
                Leader: {g.leader || '—'} &nbsp;·&nbsp;
                {members.length} member{members.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                Last meeting: {lastMeeting ? fmtDate(lastMeeting) : 'none'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-slate-500">8-wk attendance</p>
                <AttendanceBadge value={overallRate} />
              </div>
            </div>
          </div>

          {/* Status summary row */}
          <div className="flex gap-4 px-5 py-2.5 border-b border-slate-100 bg-white flex-wrap">
            {Object.entries(statusCounts).map(([s, n]) => (
              <span key={s} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[s]}`}>
                {s} <span className="font-bold">{n}</span>
              </span>
            ))}
          </div>

          {/* Member table */}
          {memberStats.length === 0 ? (
            <p className="text-xs text-slate-400 px-5 py-4">No members.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-slate-500">Member</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 hidden sm:table-cell">8-wk Rate</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 hidden sm:table-cell">
                    Attended ({recent.length} sessions)
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 hidden md:table-cell">Last Seen</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 hidden md:table-cell">Contact</th>
                </tr>
              </thead>
              <tbody>
                {memberStats
                  .sort((a, b) => {
                    const order = { Active: 0, New: 1, Irregular: 2, Inactive: 3 }
                    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
                  })
                  .map(m => (
                    <tr key={m.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                      <td className="px-5 py-2.5 font-medium text-slate-800">{m.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[m.status]}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <AttendanceBadge value={m.rate} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs hidden sm:table-cell">
                        {m.attendedRec} / {recent.length}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs hidden md:table-cell">
                        {m.lastSeen ? fmtDate(m.lastSeen) : <span className="text-red-400">Never</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs hidden md:table-cell">
                        {m.contact || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
