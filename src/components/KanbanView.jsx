import { useTasks } from '../context/TaskContext'
import { StatusBadge, PriorityBadge } from './Badges'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState, useRef } from 'react'
import ScreenshotButton from './ScreenshotButton'

const COLUMNS = [
  {
    id: 'todo',
    label: 'Todo',
    headerCls: 'bg-slate-100 text-slate-700',
    countCls: 'bg-slate-200 text-slate-600',
    dropCls: 'bg-slate-100 border-slate-300',
    overCls: 'bg-slate-200 border-slate-400',
    dotCls: 'bg-slate-400',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    headerCls: 'bg-sky-100 text-sky-700',
    countCls: 'bg-sky-200 text-sky-700',
    dropCls: 'bg-sky-50 border-sky-200',
    overCls: 'bg-sky-100 border-sky-400',
    dotCls: 'bg-sky-500',
  },
  {
    id: 'done',
    label: 'Done',
    headerCls: 'bg-emerald-100 text-emerald-700',
    countCls: 'bg-emerald-200 text-emerald-700',
    dropCls: 'bg-emerald-50 border-emerald-200',
    overCls: 'bg-emerald-100 border-emerald-400',
    dotCls: 'bg-emerald-500',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    headerCls: 'bg-rose-100 text-rose-700',
    countCls: 'bg-rose-200 text-rose-700',
    dropCls: 'bg-rose-50 border-rose-200',
    overCls: 'bg-rose-100 border-rose-400',
    dotCls: 'bg-rose-500',
  },
]

const CARD_ACCENT = {
  todo: 'border-l-slate-400',
  in_progress: 'border-l-sky-500',
  done: 'border-l-emerald-500',
  blocked: 'border-l-rose-500',
}

function TaskCard({ task, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, opacity: isDragging ? 0.4 : 1 } : undefined
  const accent = CARD_ACCENT[task.status] ?? 'border-l-slate-300'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white border border-slate-200 border-l-4 ${accent} rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing`}
    >
      <p className="font-medium text-slate-800 text-sm mb-2">{task.name}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.due_date && <span className="text-xs text-slate-400">{task.due_date}</span>}
      </div>
      {task.assignee && (
        <div className="flex flex-wrap gap-1 mt-1">
          {task.assignee.split(',').map(n => n.trim()).filter(Boolean).map(name => (
            <span key={name} className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{name}</span>
          ))}
        </div>
      )}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onEdit(task)}
        className="text-xs text-blue-500 hover:text-blue-700 mt-2 block"
      >
        Edit
      </button>
    </div>
  )
}

function Column({ col, tasks, onEdit }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="flex-1 min-w-52">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg mb-0 ${col.headerCls}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dotCls}`} />
          <h3 className="font-semibold text-sm">{col.label}</h3>
        </div>
        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${col.countCls}`}>{tasks.length}</span>
      </div>
      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`min-h-32 rounded-b-lg p-2 flex flex-col gap-2 border-2 transition-colors
          ${isOver ? col.overCls : col.dropCls}`}
      >
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onEdit={onEdit} col={col} />
        ))}
      </div>
    </div>
  )
}

export default function KanbanView({ tasks, onEdit }) {
  const { updateTask } = useTasks()
  const [activeTask, setActiveTask] = useState(null)
  const boardRef = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart({ active }) {
    setActiveTask(tasks.find(t => t.id === active.id))
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over) return
    const newStatus = over.id
    const task = tasks.find(t => t.id === active.id)
    if (task && task.status !== newStatus) {
      updateTask(task.id, { status: newStatus })
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex justify-end mb-3">
        <ScreenshotButton targetRef={boardRef} label="Kanban" />
      </div>
      <div ref={boardRef} className="flex gap-4 overflow-x-auto pb-4 bg-slate-50 rounded-lg p-2">
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            col={col}
            tasks={tasks.filter(t => t.status === col.id)}
            onEdit={onEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="bg-white border border-blue-300 rounded-lg p-3 shadow-lg opacity-90">
            <p className="font-medium text-slate-800 text-sm">{activeTask.name}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
