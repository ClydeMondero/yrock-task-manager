import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import * as sheets from '../lib/sheets'

const TaskContext = createContext(null)

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([])
  const [assignees, setAssignees] = useState([])
  const [events, setEvents] = useState([])
  const [ministries, setMinistries] = useState([])
  const [programBlocks, setProgramBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const [taskData, assigneeData, eventData, ministryData, programData] = await Promise.all([
        sheets.getTasks(),
        sheets.getAssignees(),
        sheets.getEvents(),
        sheets.getMinistries(),
        sheets.getProgramFlow(),
      ])
      setTasks(taskData)
      setAssignees(assigneeData)
      setEvents(eventData)
      setMinistries(ministryData)
      setProgramBlocks(programData)
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

  const addEvent = useCallback(async (fields) => {
    const event = { ...fields, id: uuidv4() }
    await sheets.addEvent(event)
    setEvents(prev => [...prev, event])
  }, [])

  const addMinistry = useCallback(async (fields) => {
    const ministry = { ...fields, id: uuidv4() }
    await sheets.addMinistry(ministry)
    setMinistries(prev => [...prev, ministry])
  }, [])

  const addProgramBlock = useCallback(async (fields) => {
    const block = { ...fields, id: fields.id || uuidv4() }
    await sheets.addBlock(block)
    setProgramBlocks(prev => [...prev, block])
  }, [])

  const updateProgramBlock = useCallback(async (id, fields) => {
    await sheets.updateBlock(id, fields)
    setProgramBlocks(prev => prev.map(b => b.id === id ? { ...b, ...fields } : b))
  }, [])

  const deleteProgramBlock = useCallback(async (id) => {
    await sheets.deleteBlock(id)
    setProgramBlocks(prev => prev.filter(b => b.id !== id))
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
    <TaskContext.Provider value={{
      tasks, assignees, events, ministries, programBlocks,
      loading, error,
      addTask, updateTask, deleteTask,
      addAssignee, addEvent, addMinistry,
      addProgramBlock, updateProgramBlock, deleteProgramBlock,
      refresh,
    }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
