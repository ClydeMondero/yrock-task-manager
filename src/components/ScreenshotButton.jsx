import { useState } from 'react'
import { toPng } from 'html-to-image'

export default function ScreenshotButton({ targetRef, label = 'Screenshot' }) {
  const [status, setStatus] = useState('idle')

  async function capture() {
    if (!targetRef?.current) return
    try {
      setStatus('capturing')
      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
      })
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setStatus('copied')
        setTimeout(() => setStatus('idle'), 2500)
      } catch {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `yrock-${label.toLowerCase()}-${Date.now()}.png`
        a.click()
        setStatus('idle')
      }
    } catch (e) {
      console.error('Screenshot failed:', e)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const config = {
    idle: { 
      style: 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200', 
      text: 'Copy Image',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    capturing: { 
      style: 'bg-slate-50 text-slate-400 border-slate-200 cursor-wait', 
      text: 'Capturing...',
      icon: (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
    copied: { 
      style: 'bg-emerald-500 text-white border-emerald-400', 
      text: 'Copied!',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    error: { 
      style: 'bg-red-500 text-white border-red-400', 
      text: 'Failed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    },
  }

  const { style, text, icon } = config[status]

  return (
    <button
      onClick={capture}
      disabled={status === 'capturing'}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 shadow-sm active:scale-95 ${style}`}
    >
      {icon}
      <span>{text}</span>
    </button>
  )
}
