import { useState, useEffect, useRef } from 'react'
import useScrollReveal from '../hooks/useScrollReveal'
import useScrollRevealChildren from '../hooks/useScrollRevealChildren'

const VULNS = [
  { id: 'CVE-2024-001', title: 'SQL Injection in /api/login', sev: 'CRIT', color: '#F40000', conf: 98, file: 'loginUser()' },
  { id: 'CVE-2024-002', title: 'Public S3: prod-assets', sev: 'HIGH', color: '#F44E3F', conf: 95, file: 'prod-assets bucket' },
  { id: 'CVE-2024-003', title: 'IAM wildcard on Lambda', sev: 'HIGH', color: '#F44E3F', conf: 91, file: 'lambda execution role' },
  { id: 'WARN-001', title: 'Hardcoded API key', sev: 'MED', color: '#F4998D', conf: 88, file: '.env.production' },
  { id: 'WARN-002', title: 'XSS in profile render', sev: 'MED', color: '#F4998D', conf: 93, file: 'User profile component' },
]

const DemoSection = () => {
  const [selected, setSelected] = useState(0)
  const [phase, setPhase] = useState('analyzing') // analyzing -> explaining -> idle
  const [fixStatus, setFixStatus] = useState('idle') // idle -> loading -> success
  const [userInteracted, setUserInteracted] = useState(false)
  const autoRotateTimer = useRef(null)

  const headerRef = useScrollReveal({ variant: 'title' })
  const terminalRef = useScrollReveal({ threshold: 0.05 })
  const ctaRef = useScrollReveal()
  const threatListRef = useScrollRevealChildren('.flex.items-center.gap-2.p-2\\.5', { staggerMs: 120, threshold: 0.1 })

  // Process the threat selection animation pipeline
  useEffect(() => {
    setFixStatus('idle')
    setPhase('analyzing')
    
    const analyzeTimer = setTimeout(() => {
      setPhase('explaining');
      const explainTimer = setTimeout(() => {
        setPhase('idle');
      }, 800)
      return () => clearTimeout(explainTimer)
    }, 600)
    
    return () => clearTimeout(analyzeTimer)
  }, [selected])

  // Process Auto-Rotation
  useEffect(() => {
    if (!userInteracted) {
      autoRotateTimer.current = setInterval(() => {
        setSelected((prev) => (prev + 1) % VULNS.length)
      }, 7000)
    }
    return () => {
      if (autoRotateTimer.current) clearInterval(autoRotateTimer.current)
    }
  }, [userInteracted])

  const handleSelect = (idx) => {
    setUserInteracted(true)
    if (idx !== selected) {
      setSelected(idx)
    }
  }

  const handleApplyFix = () => {
    setUserInteracted(true)
    setFixStatus('loading')
    setTimeout(() => {
      setFixStatus('success')
    }, 1200)
  }

  const handleSkip = () => {
    setUserInteracted(true)
    setSelected((prev) => (prev + 1) % VULNS.length)
  }

  const currentVuln = VULNS[selected]

  const getExplanation = (idx) => {
    switch(idx) {
      case 0: return <>The <span className="text-[#F40000]">loginUser()</span> function directly concatenates user input into SQL. An attacker can inject <span className="text-[#F40000]">malicious payloads</span> to bypass auth or exfiltrate data.</>
      case 1: return <>S3 bucket <span className="text-[#F40000]">prod-assets</span> has a public ACL policy. Any internet user can read all objects. This may leak <span className="text-[#F40000]">sensitive production data</span>.</>
      case 2: return <>Lambda execution role has <span className="text-[#F40000]">Action: "*"</span> and <span className="text-[#F40000]">Resource: "*"</span>. This grants unrestricted access to all AWS services.</>
      case 3: return <>File <span className="text-[#F40000]">.env.production</span> contains a hardcoded <span className="text-[#F40000]">STRIPE_SECRET_KEY</span>. Secrets must be stored in a vault or environment variables.</>
      case 4: return <>User profile component renders <span className="text-[#F40000]">unsanitized HTML</span> via dangerouslySetInnerHTML. An attacker can inject scripts to steal session cookies.</>
      default: return ""
    }
  }

  const getVulnerableCode = (idx) => {
    switch(idx) {
      case 0: return 'query = `SELECT * FROM users WHERE email=\'${input}\'`'
      case 1: return '"Principal": "*", "Effect": "Allow"'
      case 2: return '"Action": "*", "Resource": "*"'
      case 3: return 'STRIPE_SECRET_KEY=sk_live_12345...'
      case 4: return '<div dangerouslySetInnerHTML={{__html: bio}} />'
      default: return ""
    }
  }

  const getSecurePatch = (idx) => {
    switch(idx) {
      case 0: return (
        <>
          <p className="text-[#F40000]">- query = `SELECT * ... ${'{input}'}`</p>
          <p className="text-[#00ff41]">+ const q = "SELECT * FROM users WHERE email = ?";</p>
          <p className="text-[#00ff41]">+ db.execute(q, [req.body.email]);</p>
        </>
      )
      case 1: return (
        <>
          <p className="text-[#F40000]">- "Principal": "*"</p>
          <p className="text-[#00ff41]">+ "Principal": {"{"}"AWS": "arn:aws:iam::123:root"{"}"}</p>
          <p className="text-[#00ff41]">+ "Condition": {"{"}"Bool": ...{"}"}</p>
        </>
      )
      case 2: return (
        <>
          <p className="text-[#F40000]">- "Action": "*"</p>
          <p className="text-[#00ff41]">+ "Action": ["s3:GetObject", "s3:PutObject"]</p>
          <p className="text-[#F40000]">- "Resource": "*"</p>
          <p className="text-[#00ff41]">+ "Resource": "arn:aws:s3:::bucket/*"</p>
        </>
      )
      case 3: return (
        <>
          <p className="text-[#F40000]">- STRIPE_SECRET_KEY=sk_live_...</p>
          <p className="text-[#00ff41]">+ STRIPE_SECRET_KEY=${"{{"}vault.stripe_key{"}}"}</p>
        </>
      )
      case 4: return (
        <>
          <p className="text-[#F40000]">- dangerouslySetInnerHTML</p>
          <p className="text-[#00ff41]">+ import DOMPurify from 'dompurify';</p>
          <p className="text-[#00ff41]">+ {"<div>{DOMPurify.sanitize(bio)}</div>"}</p>
        </>
      )
      default: return null
    }
  }

  return (
    <section id="demo" className="py-20 px-4 md:px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,0,0,0.02)_0%,transparent_60%)] pointer-events-none" />
      <div className="max-w-5xl mx-auto">
        <div ref={headerRef}>
          <p className="section-tag">// LIVE_SCAN</p>
          <h2 className="section-heading">THREAT_DASHBOARD</h2>
          <p className="section-desc">Real-time vulnerability detection, AI analysis, and auto-fix.</p>
        </div>

        <div ref={terminalRef} className="mt-12 terminal shadow-[0_10px_60px_rgba(244,0,0,0.08)]">
          <div className="terminal-bar bg-[#0d0c0e]/80 backdrop-blur">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">dashboard — scan-results — {VULNS.length} threats</span>
            <div className="ml-auto flex items-center gap-1.5 border border-[#F40000]/20 rounded-full px-2 py-0.5 bg-[#F40000]/5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red shadow-[0_0_8px_#F40000]" />
              <span className="text-[9px] text-[#F40000] tracking-wider font-bold">SCANNING</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#F40000]/10 bg-[#0d0c0e]">
            {/* THREAT LIST PANEL */}
            <div className="p-5 text-xs relative">
              <p className="text-[#6b6271] text-[10px] mb-3 uppercase tracking-widest font-bold flex justify-between">
                <span>❯ cat /threats</span>
                {!userInteracted && <span className="text-[#F40000]/50 animate-pulse font-normal lowercase italic tracking-normal border-b border-transparent">auto-scan active</span>}
              </p>
              <div ref={threatListRef} className="space-y-1.5 relative z-10 block">
                {VULNS.map((v, i) => {
                  const isSel = selected === i;
                  return (
                  <div
                    key={i}
                    onClick={() => handleSelect(i)}
                    className={`flex items-center gap-2 p-2.5 rounded cursor-pointer transition-all duration-300 transform outline-none ${
                        isSel 
                        ? 'bg-[#F40000]/10 border border-[#F40000]/30 shadow-[0_0_15px_rgba(244,0,0,0.1)] translate-x-1' 
                        : 'border border-transparent hover:bg-[#F40000]/5 hover:border-[#F40000]/10 hover:translate-x-0.5'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${isSel ? 'animate-[pulse_1s_infinite]' : ''}`} style={{ backgroundColor: v.color, boxShadow: `0 0 8px ${v.color}` }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-white truncate transition-all duration-300 ${isSel ? 'text-[12px] font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]' : 'text-[11px]'}`}>{v.title}</p>
                      <p className="text-[#6b6271] text-[9px] font-mono">{v.id}</p>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded font-mono transition-colors" style={{ color: v.color, border: `1px solid ${v.color}${isSel?'50':'20'}`, backgroundColor: `${v.color}${isSel?'15':'05'}` }}>
                      {v.sev}
                    </span>
                  </div>
                )})}
              </div>
            </div>

            {/* AI ANALYSIS PANEL */}
            <div className={`p-5 text-xs transition-opacity duration-300 ${phase === 'analyzing' ? 'opacity-40' : 'opacity-100'}`}>
              <p className="text-[#6b6271] text-[10px] mb-3 uppercase tracking-widest font-bold h-4">
                {phase !== 'idle' ? (
                   <span className="text-[#F4998D] animate-pulse">❯ Analyzing vulnerability...</span>
                ) : (
                   `❯ ai-explain ${currentVuln.id}`
                )}
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] glow-red" />
                    <span className="text-[9px] font-bold tracking-wider" style={{ color: currentVuln.color }}>
                      {currentVuln.sev} THREAT IDENTIFIED
                    </span>
                  </div>
                  <span className="text-[8px] font-bold text-[#00ff41] font-mono tracking-widest border border-[#00ff41]/20 px-1.5 py-0.5 rounded bg-[#00ff41]/5">
                    AI_CONF: {currentVuln.conf}%
                  </span>
                </div>
                
                <p className={`text-white font-bold text-[12px] border-b border-[#F40000]/10 pb-2 transition-all duration-500 ${phase !== 'idle' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  {currentVuln.title}
                </p>
                
                <p className="text-[#6b6271] leading-relaxed min-h-[60px] relative">
                  {phase === 'analyzing' && <span className="absolute inset-0 flex items-center justify-center text-[#F4998D] italic animate-pulse">Running semantic analysis...</span>}
                  {phase === 'explaining' && <span className="absolute inset-0 flex items-center justify-center text-[#F4998D] italic animate-pulse">Generating explanation...</span>}
                  {phase === 'idle' && (
                    <span className="inline-block animate-[fade-in_0.5s_ease-out_forwards]">
                      {getExplanation(selected)}
                    </span>
                  )}
                </p>

                <div className={`p-2.5 rounded bg-[#F40000]/5 border border-[#F40000]/15 font-mono text-[10px] text-[#F4998D] transition-all duration-500 ${phase !== 'idle' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  <p className="text-[#c8c0d0]/50 mb-1">// {currentVuln.file}</p>
                  {getVulnerableCode(selected)}
                </div>
              </div>
            </div>

            {/* AUTO-FIX PANEL */}
            <div className={`p-5 text-xs transition-opacity duration-300 relative ${phase !== 'idle' ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
              {fixStatus === 'success' && (
                <div className="absolute inset-0 bg-[#0d0c0e]/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fade-in border border-[#00ff41]/20 rounded-lg shadow-[inset_0_0_40px_rgba(0,255,65,0.05)]">
                  <div className="w-10 h-10 rounded-full bg-[#00ff41]/10 flex items-center justify-center mb-3 border border-[#00ff41]/30">
                     <span className="text-[#00ff41] text-xl">✓</span>
                  </div>
                  <p className="text-[#00ff41] font-bold tracking-widest text-[11px] mb-1">PATCH APPLIED</p>
                  <p className="text-[#6b6271] text-[9px] mb-4">Vulnerability perfectly remediated via AI.</p>
                  <button onClick={handleSkip} className="btn-ghost !py-1.5 !px-4 !text-[9px]">❯ CONTINUE</button>
                </div>
              )}

              <p className="text-[#6b6271] text-[10px] mb-3 uppercase tracking-widest font-bold">❯ ai-fix --apply</p>
              
              <div className="space-y-4">
                <p className="text-[#6b6271] flex items-center gap-2">
                  {fixStatus === 'loading' ? (
                     <span className="text-[#00ff41] animate-pulse">Executing code replacement...</span>
                  ) : (
                     <span className="text-[#6b6271]">Generating secure patch...</span>
                  )}
                </p>
                
                <div className={`p-3 rounded bg-[#00ff41]/5 border border-[#00ff41]/15 font-mono text-[10px] space-y-1 relative overflow-hidden transition-all duration-500`}>
                   <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff41]/50" />
                   {fixStatus === 'loading' && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00ff41]/10 to-transparent h-[200%] animate-[scanVertical_1s_linear_infinite] pointer-events-none -translate-y-1/2" />}
                   
                   <div className={phase === 'idle' ? "animate-[fade-in_0.6s_ease-out_forwards] pl-1" : "opacity-0"}>
                     <p className="text-[#6b6271] mb-2">// secure implementation via SecSphere AI</p>
                     {getSecurePatch(selected)}
                   </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleApplyFix}
                    disabled={fixStatus === 'loading'}
                    className={`btn-red flex-1 !py-2.5 !px-3 !text-[10px] flex items-center justify-center gap-2 ${fixStatus === 'loading' ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    {fixStatus === 'loading' ? <div className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin" /> : 'APPLY_FIX'}
                  </button>
                  <button 
                    onClick={handleSkip} 
                    className="btn-ghost flex-1 !py-2.5 !px-3 !text-[10px]"
                  >
                    SKIP
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={ctaRef} className="text-center mt-10">
          <button className="btn-ghost hover:scale-105 transition-transform" id="try-live-demo">❯ RUN_LIVE_SCAN</button>
        </div>
      </div>
    </section>
  )
}

export default DemoSection

