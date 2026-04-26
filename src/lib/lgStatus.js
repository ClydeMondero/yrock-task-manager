// ── Lifegroup member activity status ─────────────────────────────────────────

export const STATUS_COLORS = {
  Active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  Irregular: 'bg-amber-100 text-amber-700 border-amber-200',
  Inactive:  'bg-red-100 text-red-600 border-red-200',
  New:       'bg-blue-100 text-blue-700 border-blue-200',
  '-':       'bg-slate-100 text-slate-500 border-slate-200',
}

const WINDOW_WEEKS = 8
const NEW_DAYS     = 14

/**
 * Compute activity status for one member.
 *
 * @param {string}   memberId      — UUID of the member
 * @param {Object[]} groupMeetings — all LGMeeting rows for this member's lifegroup
 * @returns {'Active'|'Irregular'|'Inactive'|'New'}
 */
export function computeMemberStatus(memberId, groupMeetings) {
  if (!groupMeetings?.length) return 'Inactive'

  const now         = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - WINDOW_WEEKS * 7)

  // Meetings within the rolling window
  const inWindow = groupMeetings.filter(m => m.date && new Date(m.date) >= windowStart)

  if (inWindow.length === 0) return 'Inactive'

  const parseAttendees = m =>
    (m.attendees ?? '').split(',').map(s => s.trim()).filter(Boolean)

  const attended = inWindow.filter(m => parseAttendees(m).includes(memberId)).length
  const ratio    = attended / inWindow.length

  // "New" — member has only ever appeared in meetings within the last 14 days
  const allAttended = groupMeetings.filter(m => parseAttendees(m).includes(memberId))
  if (allAttended.length > 0) {
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - NEW_DAYS)
    const oldest = new Date(Math.min(...allAttended.map(m => new Date(m.date))))
    if (oldest >= cutoff) return 'New'
  }

  if (ratio >= 0.75) return 'Active'
  if (ratio >= 0.25) return 'Irregular'
  return 'Inactive'
}
