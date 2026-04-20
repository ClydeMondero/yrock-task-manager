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
import { useState } from 'react'

const COLUMNS = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
  { id: 'blocked', label: 'Blocked' },
]

function TaskCard({ task, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, opacity: isDragging ? 0.4 : 1 } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <p className="font-medium text-slate-800 text-sm mb-2">{task.name}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.due_date && <span className="text-xs text-slate-400">{task.due_date}</span>}
      </div>
      {task.assignee && <p className="text-xs text-slate-400 mt-1">{task.assignee}</p>}
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
    <div className="flex-1 min-w-48">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-700 text-sm">{col.label}</h3>
        <span className="text-xs bg-slate-200 text-slate-500 rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-32 rounded-lg p-2 flex flex-col gap-2 transition-colors
          ${isOver ? 'bg-blue-50 border-2 border-blue-300' : 'bg-slate-100 border-2 border-transparent'}`}
      >
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

export default function KanbanView({ tasks, onEdit }) {
  const { updateTask } = useTasks()
  const [activeTask, setActiveTask] = useState(null)

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
      <div className="flex gap-4 overflow-x-auto pb-4">
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
