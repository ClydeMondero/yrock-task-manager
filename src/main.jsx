import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { TaskProvider } from './context/TaskContext.jsx'
import LoginPage, { isAuthenticated } from './components/LoginPage.jsx'

function Root() {
  const [authed, setAuthed] = useState(isAuthenticated)
  if (!authed) return <LoginPage onAuth={() => setAuthed(true)} />
  return (
    <TaskProvider>
      <App />
    </TaskProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
