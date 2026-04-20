const STATUS_STYLES = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-sky-100 text-sky-700',
  done: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-rose-100 text-rose-700',
}

const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${PRIORITY_STYLES[priority] ?? 'bg-slate-100 text-slate-500'}`}>
      {priority || '—'}
    </span>
  )
}
