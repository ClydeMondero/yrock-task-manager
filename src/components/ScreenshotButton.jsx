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
    idle:      { style: 'bg-blue/20 hover:bg-white/30 text-blue border border-white/30', text: `Copy to clipboard` },
    capturing: { style: 'bg-blue/10 text-blue-200 border border-white/20 cursor-wait',    text: 'Capturing…' },
    copied:    { style: 'bg-green-500 text-white border border-green-400',                 text: 'Copied!' },
    error:     { style: 'bg-red-500 text-white border border-red-400',                     text: 'Failed' },
  }

  const { style, text } = config[status]

  return (
    <button
      onClick={capture}
      disabled={status === 'capturing'}
      className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${style}`}
    >
      {text}
    </button>
  )
}
