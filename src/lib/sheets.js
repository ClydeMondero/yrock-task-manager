const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID
const CLIENT_EMAIL = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL
const PRIVATE_KEY_PEM = import.meta.env.VITE_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
const SHEET_NAME = 'Tasks'
const COLUMNS = ['id', 'name', 'event', 'status', 'priority', 'due_date', 'assignee', 'assignee_tg', 'reminder', 'reminder_sent', 'recurring', 'remarks', 'gdrive_link', 'ministry']
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

let _tokenCache = null

function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlFromBuffer(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function pemToBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (_tokenCache && _tokenCache.exp > now + 60) return _tokenCache.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const msg = `${header}.${claim}`

  const keyBuf = pemToBuffer(PRIVATE_KEY_PEM)
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(msg))
  const jwt = `${msg}.${b64urlFromBuffer(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description ?? 'Failed to get access token')

  _tokenCache = { token: data.access_token, exp: now + data.expires_in }
  return data.access_token
}

async function sheetsRequest(method, path, body) {
  const token = await getAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Sheets API error')
  return data
}

function rowToTask(row, rowIndex) {
  const task = { _row: rowIndex + 2 }
  COLUMNS.forEach((col, i) => { task[col] = row[i] ?? '' })
  return task
}

function taskToRow(task) {
  return COLUMNS.map(col => task[col] ?? '')
}

export async function getTasks() {
  const data = await sheetsRequest('GET', `/values/${SHEET_NAME}!A2:N`)
  const rows = data.values ?? []
  return rows.map((row, i) => rowToTask(row, i)).filter(t => t.id)
}

export async function getAssignees() {
  try {
    const data = await sheetsRequest('GET', `/values/Assignees!A2:C`)
    const rows = data.values ?? []
    return rows.map(row => ({
      id: row[0],
      name: row[1],
      telegram_id: row[2]
    })).filter(a => a.id)
  } catch (e) {
    console.error("Failed to fetch assignees", e)
    return []
  }
}

export async function getEvents() {
  try {
    const data = await sheetsRequest('GET', `/values/Events!A2:D`)
    const rows = data.values ?? []
    return rows.map(row => ({
      id: row[0],
      name: row[1],
      start_date: row[2] ?? '',
      end_date: row[3] ?? ''
    })).filter(e => e.id)
  } catch (e) {
    console.error("Failed to fetch events", e)
    return []
  }
}

export async function addAssignee(person) {
  await sheetsRequest('POST', `/values/Assignees!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [[person.id, person.name, person.telegram_id]],
  })
}

export async function addEvent(event) {
  await sheetsRequest('POST', `/values/Events!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [[event.id, event.name, event.start_date ?? '', event.end_date ?? '']],
  })
}

export async function getMinistries() {
  try {
    const data = await sheetsRequest('GET', `/values/Ministries!A2:B`)
    const rows = data.values ?? []
    return rows.map(row => ({
      id: row[0],
      name: row[1],
    })).filter(m => m.id)
  } catch (e) {
    console.error('Failed to fetch ministries', e)
    return []
  }
}

export async function addMinistry(ministry) {
  await sheetsRequest('POST', `/values/Ministries!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [[ministry.id, ministry.name]],
  })
}

export async function addTask(task) {
  await sheetsRequest('POST', `/values/${SHEET_NAME}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [taskToRow(task)],
  })
}

export async function updateTask(id, fields) {
  const tasks = await getTasks()
  const task = tasks.find(t => t.id === id)
  if (!task) throw new Error(`Task ${id} not found`)
  const updated = { ...task, ...fields }
  await sheetsRequest('PUT', `/values/${SHEET_NAME}!A${task._row}:N${task._row}?valueInputOption=RAW`, {
    values: [taskToRow(updated)],
  })
}

export async function deleteTask(id) {
  const tasks = await getTasks()
  const task = tasks.find(t => t.id === id)
  if (!task) return
  await sheetsRequest('PUT', `/values/${SHEET_NAME}!A${task._row}:N${task._row}?valueInputOption=RAW`, {
    values: [['', '', '', '', '', '', '', '', '', '', '', '', '', '']],
  })
}
