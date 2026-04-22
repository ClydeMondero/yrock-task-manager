import { useState } from 'react'
import logo from '../assets/logo.jpg'

const PASSWORD = 'yrock@bustosbaliwag'
const STORAGE_KEY = 'yrock_auth'

export function isAuthenticated() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export default function LoginPage({ onAuth }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      if (pw === PASSWORD) {
        localStorage.setItem(STORAGE_KEY, 'true')
        onAuth()
      } else {
        setErr('Incorrect password.')
        setPw('')
      }
      setLoading(false)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-[#0f2d6b] flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">

        {/* Logo */}
        <img
          src={logo}
          alt="YROCK Logo"
          className="w-52 h-52 rounded-2xl shadow-2xl object-cover"
        />

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-8 w-full shadow-xl">
          <h1 className="text-white text-center text-lg font-semibold mb-1">Operations Hub</h1>
          <p className="text-blue-200 text-center text-xs mb-6">Yeshua The Rock Christian Assembly</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-blue-100 text-xs font-medium">Password</span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setErr('') }}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2.5 pr-10 text-white placeholder:text-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="Enter password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white text-xs select-none"
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {err && (
              <p className="text-red-300 text-xs text-center">{err}</p>
            )}

            <button
              type="submit"
              disabled={loading || !pw}
              className="bg-white text-[#0f2d6b] font-semibold text-sm py-2.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </form>
        </div>

        <p className="text-blue-300/60 text-xs">Bustos & Baliuag</p>
      </div>
    </div>
  )
}
