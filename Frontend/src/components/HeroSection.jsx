import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BOOT_LINES = [
  { text: '[BOOT] Initializing SecSphere Engine v3.2.1...', delay: 0, color: '#6b6271' },
  { text: '[BOOT] Loading vulnerability databases... OK', delay: 300, color: '#6b6271' },
  { text: '[BOOT] Connecting to AWS Security Hub... OK', delay: 600, color: '#6b6271' },
  { text: '[BOOT] Neural network loaded: 847M parameters', delay: 900, color: '#6b6271' },
  { text: '[SYS]  System ready. Awaiting target.', delay: 1200, color: '#00ff41' },
  { text: '', delay: 1500 },
  { text: '❯ ai-sec scan --mode=deep --target=*', delay: 1800, color: '#F40000', bold: true },
  { text: '', delay: 2100 },
  { text: '┌─────────────────────────────────────────────────────────┐', delay: 2200, color: '#F44E3F' },
  { text: '│                                                         │', delay: 2250, color: '#F44E3F' },
  { text: '│   AI-POWERED SECURITY FOR                               │', delay: 2300, color: '#ffffff', bold: true },
  { text: '│   CODE, CLOUD, AND ACCESS                               │', delay: 2400, color: '#F40000', bold: true },
  { text: '│                                                         │', delay: 2500, color: '#F44E3F' },
  { text: '│   Detect vulnerabilities, misconfigurations,            │', delay: 2600, color: '#6b6271' },
  { text: '│   and IAM risks in seconds.                             │', delay: 2700, color: '#6b6271' },
  { text: '│                                                         │', delay: 2750, color: '#F44E3F' },
  { text: '└─────────────────────────────────────────────────────────┘', delay: 2800, color: '#F44E3F' },
  { text: '', delay: 2900 },
  { text: '[SCAN] Scanning 1,247 files...', delay: 3000, color: '#F4998D' },
  { text: '[SCAN] Analyzing code patterns...            ██████████ 100%', delay: 3400, color: '#F44E3F' },
  { text: '[SCAN] Checking cloud configs...             ██████████ 100%', delay: 3800, color: '#F44E3F' },
  { text: '[SCAN] Evaluating IAM policies...            ██████████ 100%', delay: 4200, color: '#F44E3F' },
  { text: '', delay: 4400 },
  { text: '[ALERT] ██ 3 CRITICAL VULNERABILITIES DETECTED ██', delay: 4600, color: '#F40000', bold: true, glow: true },
  { text: '[WARN]  2 high-risk misconfigurations found', delay: 4900, color: '#F4998D' },
  { text: '[INFO]  AI engine generating fixes...', delay: 5200, color: '#00ff41' },
  { text: '', delay: 5400 },
  { text: '❯ _', delay: 5500, color: '#F40000', cursor: true },
]

const HeroSection = () => {
  const [visibleLines, setVisibleLines] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) => {
      return setTimeout(() => {
        setVisibleLines(prev => [...prev, line])
      }, line.delay)
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <section className="min-h-screen flex items-center justify-center pt-16 pb-12 px-4">
      <div className="w-full max-w-4xl">
        <div className="terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-3 text-[10px] text-[#6b6271]">root@secsphere — bash — 80×24</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />
              <span className="text-[9px] text-[#F40000] uppercase tracking-wider">live</span>
            </div>
          </div>
          <div className="terminal-body min-h-[420px] md:min-h-[480px] font-mono">
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className={`${line.bold ? 'font-bold' : ''} ${line.glow ? 'animate-pulse' : ''}`}
                style={{
                  color: line.color || '#c8c0d0',
                  textShadow: line.glow ? '0 0 10px rgba(244,0,0,0.5)' : 'none',
                }}
              >
                {line.text}
                {line.cursor && (
                  <span className="inline-block w-2 h-4 bg-[#F40000] animate-[blink_1s_step-end_infinite] ml-0.5 align-middle" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA below terminal */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '5.5s', opacity: 0, animationFillMode: 'forwards' }}>
          <button className="btn-red" id="cta-start-scan" onClick={() => navigate('/dashboard')}>
            {'>'} START_SECURE_SCAN
          </button>
          <button className="btn-ghost" id="cta-view-demo" onClick={() => navigate('/details')}>
            {'>'} VIEW_DEMO
          </button>
        </div>

        <p className="text-center text-[10px] text-[#6b6271] mt-6 tracking-wider animate-fade-in" style={{ animationDelay: '6s', opacity: 0, animationFillMode: 'forwards' }}>
          [ POWERED BY AI × AWS SECURITY INTELLIGENCE ]
        </p>
      </div>
    </section>
  )
}

export default HeroSection

