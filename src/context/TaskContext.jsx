import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import * as sheets from '../lib/sheets'

const TaskContext = createContext(null)

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([])
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const [taskData, assigneeData] = await Promise.all([
        sheets.getTasks(),
        sheets.getAssignees()
      ])
      setTasks(taskData)
      setAssignees(assigneeData)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addTask = useCallback(async (fields) => {
    const task = { ...fields, id: uuidv4(), reminder_sent: 'FALSE' }
    await sheets.addTask(task)
    setTasks(prev => [...prev, task])
  }, [])

  const addAssignee = useCallback(async (fields) => {
    const person = { ...fields, id: uuidv4() }
    await sheets.addAssignee(person)
    setAssignees(prev => [...prev, person])
  }, [])

  const updateTask = useCallback(async (id, fields) => {
    await sheets.updateTask(id, fields)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t))
  }, [])

  const deleteTask = useCallback(async (id) => {
    await sheets.deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <TaskContext.Provider value={{ tasks, assignees, loading, error, addTask, updateTask, deleteTask, addAssignee, refresh }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
