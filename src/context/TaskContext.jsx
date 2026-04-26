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
  const [lgGroups,   setLGGroups]   = useState([])
  const [lgMembers,  setLGMembers]  = useState([])
  const [lgMeetings, setLGMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const [taskData, assigneeData, eventData, ministryData, programData,
             lgGroupData, lgMemberData, lgMeetingData] = await Promise.all([
        sheets.getTasks(),
        sheets.getAssignees(),
        sheets.getEvents(),
        sheets.getMinistries(),
        sheets.getProgramFlow(),
        sheets.getLGGroups(),
        sheets.getLGMembers(),
        sheets.getLGMeetings(),
      ])
      setTasks(taskData)
      setAssignees(assigneeData)
      setEvents(eventData)
      setMinistries(ministryData)
      setProgramBlocks(programData)
      setLGGroups(lgGroupData)
      setLGMembers(lgMemberData)
      setLGMeetings(lgMeetingData)
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

  // ── LG Groups ────────────────────────────────────────────────────────────────
  const addLGGroup = useCallback(async (fields) => {
    const g = { ...fields, id: uuidv4() }
    await sheets.addLGGroup(g)
    setLGGroups(prev => [...prev, g])
  }, [])
  const updateLGGroup = useCallback(async (id, fields) => {
    await sheets.updateLGGroup(id, fields)
    setLGGroups(prev => prev.map(g => g.id === id ? { ...g, ...fields } : g))
  }, [])
  const deleteLGGroup = useCallback(async (id) => {
    await sheets.deleteLGGroup(id)
    setLGGroups(prev => prev.filter(g => g.id !== id))
  }, [])

  // ── LG Members ───────────────────────────────────────────────────────────────
  const addLGMember = useCallback(async (fields) => {
    const m = { ...fields, id: uuidv4() }
    await sheets.addLGMember(m)
    setLGMembers(prev => [...prev, m])
  }, [])
  const updateLGMember = useCallback(async (id, fields) => {
    await sheets.updateLGMember(id, fields)
    setLGMembers(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m))
  }, [])
  const deleteLGMember = useCallback(async (id) => {
    await sheets.deleteLGMember(id)
    setLGMembers(prev => prev.filter(m => m.id !== id))
  }, [])

  // ── LG Meetings ──────────────────────────────────────────────────────────────
  const addLGMeeting = useCallback(async (fields) => {
    const m = { ...fields, id: uuidv4() }
    await sheets.addLGMeeting(m)
    setLGMeetings(prev => [...prev, m])
  }, [])
  const updateLGMeeting = useCallback(async (id, fields) => {
    await sheets.updateLGMeeting(id, fields)
    setLGMeetings(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m))
  }, [])
  const deleteLGMeeting = useCallback(async (id) => {
    await sheets.deleteLGMeeting(id)
    setLGMeetings(prev => prev.filter(m => m.id !== id))
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
      lgGroups, lgMembers, lgMeetings,
      loading, error,
      addTask, updateTask, deleteTask,
      addAssignee, addEvent, addMinistry,
      addProgramBlock, updateProgramBlock, deleteProgramBlock,
      addLGGroup, updateLGGroup, deleteLGGroup,
      addLGMember, updateLGMember, deleteLGMember,
      addLGMeeting, updateLGMeeting, deleteLGMeeting,
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
