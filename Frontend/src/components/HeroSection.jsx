import { useState, useEffect, useRef } from 'react'
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
]

const HeroSection = () => {
  const [logs, setLogs] = useState([])
  const [isBooting, setIsBooting] = useState(true)
  const [punchlineText, setPunchlineText] = useState('')
  const terminalBodyRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fullText = "Find vulnerabilities before attackers do."
    const delay = setTimeout(() => {
      let currentLength = 0
      const interval = setInterval(() => {
        currentLength++
        setPunchlineText(fullText.slice(0, currentLength))
        if (currentLength >= fullText.length) clearInterval(interval)
      }, 40)
      return () => clearInterval(interval)
    }, 1200)
    return () => clearTimeout(delay)
  }, [])

  useEffect(() => {
    let active = true
    const timers = BOOT_LINES.map((line) => {
      return setTimeout(() => {
        if (active) setLogs(prev => [...prev, line])
      }, line.delay)
    })
    
    const finishBoot = setTimeout(() => {
      if (active) setIsBooting(false)
    }, 5500)

    return () => {
      active = false
      timers.forEach(clearTimeout)
      clearTimeout(finishBoot)
    }
  }, [])

  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight
    }
  }, [logs])

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
    e.currentTarget.style.setProperty('--tilt-x', `${(x - centerX) / centerX}`)
    e.currentTarget.style.setProperty('--tilt-y', `${(y - centerY) / centerY}`)
  }

  const handleMouseLeave = (e) => {
    e.currentTarget.style.setProperty('--tilt-x', '0')
    e.currentTarget.style.setProperty('--tilt-y', '0')
  }

  return (
    <section className="min-h-screen flex items-center justify-center pt-24 pb-12 px-4">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16 mt-12 md:mt-4">
        
        {/* Left Column: Hero Box */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center animate-fade-in" style={{ animationDuration: '0.8s', animationFillMode: 'both', transform: 'translateX(-20px)' }}>
          <div 
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="liquid-glass floating-panel bg-[#120a0e]/40 backdrop-blur-[16px] border border-[#F40000]/30 border-t-white/10 rounded-xl p-8 md:p-12 shadow-[inset_0_0_20px_rgba(255,255,255,0.03),_0_8px_32px_rgba(0,0,0,0.5),_0_0_30px_rgba(244,0,0,0.15)] relative group hover:bg-[#120a0e]/50 hover:border-[#F40000]/50 hover:shadow-[inset_0_0_30px_rgba(255,255,255,0.05),_0_8px_32px_rgba(0,0,0,0.5),_0_0_40px_rgba(244,0,0,0.25)] text-left"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(244,0,0,0.08),_transparent_70%)] animate-[ambientPulse_6s_ease-in-out_infinite_alternate] pointer-events-none -z-0" />
            <h1 className="font-orbitron relative z-10 text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight mb-8 text-white leading-none animate-[titleGlow_4s_ease-in-out_infinite_alternate]" style={{ letterSpacing: '0.02em' }}>
              SecSphere
            </h1>
            
            <div 
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="liquid-glass floating-panel relative z-10 inline-block bg-[#180d12]/30 backdrop-blur-[12px] border border-[#ff2a2a]/30 border-t-white/10 rounded-xl px-5 py-4 md:px-6 md:py-4 shadow-[inset_0_0_15px_rgba(255,255,255,0.03),_0_4px_16px_rgba(0,0,0,0.4),_0_0_20px_rgba(255,42,42,0.15)] animate-fade-in min-h-[64px]" 
              style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
            >
              <p className="font-orbitron text-[#ff3a3a] text-lg md:text-xl font-bold tracking-[0.05em] flex items-center" style={{ textShadow: '0 0 12px rgba(255,58,58,0.6)' }}>
                {punchlineText}<span className="inline-block w-2.5 h-6 ml-1.5 bg-[#F40000] animate-[blink_1s_step-end_infinite] shadow-[0_0_8px_#F40000]" />
              </p>
            </div>
            
            <div className="relative z-10 mt-10 w-full max-w-sm h-[2px] bg-[#F40000]/10 rounded-full overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-0 h-full w-1/4 bg-gradient-to-r from-transparent via-[#F40000] to-transparent animate-[scanner_3s_ease-in-out_infinite_alternate] shadow-[0_0_10px_#F40000]" />
            </div>
          </div>
        </div>

        {/* Right Column: Terminal UI */}
        <div className="w-full lg:w-1/2 flex flex-col mt-4 lg:mt-0">
          <div 
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="terminal floating-panel relative z-10 shadow-[0_0_30px_rgba(244,0,0,0.15)] animate-fade-in" 
            style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
          >
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-3 text-[10px] text-[#6b6271]">root@secsphere — bash — 80×24</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />
                <span className="text-[9px] text-[#F40000] uppercase tracking-wider">{isBooting ? 'booting' : 'live'}</span>
              </div>
            </div>
            <div 
              ref={terminalBodyRef}
              className="terminal-body min-h-[380px] md:min-h-[420px] max-h-[420px] font-mono overflow-y-auto scrollbar-thin scrollbar-thumb-[#F40000]/50 scrollbar-track-transparent pr-2"
            >
              {logs.map((line, i) => (
                <div
                  key={i}
                  className={`${line.bold ? 'font-bold' : ''} ${line.glow ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}`}
                  style={{
                    color: line.color || '#c8c0d0',
                    textShadow: line.glow ? '0 0 10px rgba(244,0,0,0.5)' : 'none',
                  }}
                >
                  {line.text}
                </div>
              ))}
              <div className="text-[#F40000] mt-1 flex items-center h-6">
                ❯ <span className="inline-block w-2 h-4 bg-[#F40000] animate-[blink_1s_step-end_infinite] ml-1.5" />
              </div>
            </div>
          </div>

          {/* CTA below terminal */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 animate-fade-in" style={{ animationDelay: '1s', animationFillMode: 'both' }}>
            <button onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="btn-red liquid-glass" id="cta-start-scan" onClick={() => navigate('/dashboard')}>
              {'>'} START_SECURE_SCAN
            </button>
            <button onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="btn-ghost liquid-glass" id="cta-view-demo" onClick={() => navigate('/details')}>
              {'>'} VIEW_DEMO
            </button>
          </div>

          <p className="text-center lg:text-left text-[10px] text-[#6b6271] mt-6 tracking-wider animate-fade-in" style={{ animationDelay: '1.5s', animationFillMode: 'both' }}>
            [ POWERED BY AI × AWS SECURITY INTELLIGENCE ]
          </p>
        </div>
      </div>
    </section>
  )
}

export default HeroSection

