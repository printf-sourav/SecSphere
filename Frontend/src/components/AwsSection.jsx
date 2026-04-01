import { useState, useEffect } from 'react'
import useScrollReveal from '../hooks/useScrollReveal'

const AwsSection = () => {
  const headerRef = useScrollReveal({ variant: 'title' })
  const terminalRef = useScrollReveal({ threshold: 0.1 })
  const [latency, setLatency] = useState(2)
  const [logText, setLogText] = useState('monitoring live traffic')

  useEffect(() => {
    const latencies = [2, 3, 5, 2, 4, 3]
    let lIdx = 0
    const lInterval = setInterval(() => {
      lIdx = (lIdx + 1) % latencies.length
      setLatency(latencies[lIdx])
    }, 1500)

    const logs = [
      'syncing services...',
      'fetching threat data...',
      'validating permissions...',
      'analyzing access patterns...',
      'monitoring live traffic...'
    ]
    let logIdx = 0
    const logInterval = setInterval(() => {
      logIdx = (logIdx + 1) % logs.length
      setLogText(logs[logIdx])
    }, 2800)

    return () => {
      clearInterval(lInterval)
      clearInterval(logInterval)
    }
  }, [])

  const services = [
    {
      name: 'IAM_ACCESS_ANALYZER',
      desc: 'Detect risky permissions and enforce least privilege across all IAM roles and policies.',
      port: '8443',
    },
    {
      name: 'AWS_SECURITY_HUB',
      desc: 'Unified view of all vulnerabilities from code, configs, and IAM in a single dashboard.',
      port: '8444',
    },
    {
      name: 'AMAZON_GUARDDUTY',
      desc: 'Proactive threat prevention — stop vulnerabilities before they reach deployment.',
      port: '8445',
    },
  ]

  return (
    <section id="aws" className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <div ref={headerRef}>
          <p className="section-tag">// INTEGRATIONS</p>
          <h2 className="section-heading">AWS_SECURITY_STACK</h2>
          <p className="section-desc">Enterprise-grade security inspired by AWS intelligence.</p>
        </div>

        <div ref={terminalRef} className="mt-12 terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">aws-integrations — connected</span>
            <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#00ff41] font-bold tracking-wider">
              <span className="text-[#6b6271] mr-1 hidden sm:inline animate-[pulse_3s_ease-in-out_infinite] font-normal lowercase italic tracking-normal">syncing node</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse shadow-[0_0_8px_#00ff41]" />
              [ONLINE]
            </span>
          </div>
          <div className="terminal-body text-xs relative overflow-hidden">
            {/* Background scanning gradient specific to AWS terminal */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00ff41]/[0.02] to-transparent h-[200%] animate-[scanVertical_5s_linear_infinite] pointer-events-none -translate-y-1/2" />
            
            <p className="text-[#6b6271] mb-3 relative z-10">❯ aws-sec --list-integrations</p>
            <p className="text-[#6b6271] mb-4 relative z-10 animate-pulse">Active security modules:</p>

            <div className="relative z-10">
              {services.map((svc, i) => (
                <div 
                  key={i} 
                  className={`mb-2 last:mb-0 p-3 -ml-3 rounded transition-all duration-300 cursor-pointer animate-fade-in opacity-0 group ${
                    i === 1 ? 'border-l-2 border-[#F40000] bg-[#F40000]/[0.02] scale-[1.01] shadow-[inset_0_0_20px_rgba(244,0,0,0.03)]' : 'border-l-2 border-transparent hover:bg-[#F40000]/5 hover:border-[#F40000]/30 hover:shadow-[0_0_15px_rgba(244,0,0,0.05)]'
                  }`}
                  style={{ animationDelay: `${0.4 + (i * 0.4)}s`, animationFillMode: 'forwards' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className={`w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-[pulse_2s_ease-in-out_infinite] transition-shadow duration-300 ${i === 1 ? 'shadow-[0_0_12px_#00ff41]' : 'shadow-[0_0_6px_#00ff41] group-hover:shadow-[0_0_10px_#00ff41]'}`} 
                    />
                    <span className="text-[#F40000] font-bold">[{String(i + 1).padStart(2, '0')}]</span>
                    <span className={`font-bold transition-colors duration-300 ${i === 1 ? 'text-[#F44E3F] drop-shadow-[0_0_8px_rgba(244,78,63,0.4)]' : 'text-white'}`}>
                      {svc.name}
                    </span>
                    <span className="text-[#6b6271]">— port:{svc.port}</span>
                  </div>
                  <p className="text-[#6b6271] pl-6 transition-colors duration-300 group-hover:text-[#F4998D]/80">
                    {svc.desc}
                  </p>
                  {i < services.length - 1 && (
                    <div className="pl-6 mt-4 -mb-2 text-[#F40000]/30 transition-colors duration-300 group-hover:text-[#F40000]/50">    │</div>
                  )}
                </div>
              ))}
            </div>

            <div className="h-px bg-[#F40000]/10 my-4 relative z-10" />
            
            <div className="flex justify-between items-end relative z-10">
              <div>
                <p className="text-[#00ff41] animate-fade-in opacity-0 pb-1" style={{ animationDelay: '1.6s', animationFillMode: 'forwards' }}>
                  ✓ All integrations healthy. Latency: <span className="font-bold text-white transition-all duration-200">{latency}ms</span>
                </p>
                <p className="text-[#6b6271] flex items-center h-4 animate-fade-in opacity-0" style={{ animationDelay: '2s', animationFillMode: 'forwards' }}>
                  <span className="text-[#F40000] mr-1.5">❯</span> 
                  <span className="typing-text overflow-hidden whitespace-nowrap border-r-2 border-transparent pr-1">{logText}</span>
                  <span className="inline-block w-1.5 h-3.5 bg-[#F40000] animate-[blink_1s_step-end_infinite] -ml-1" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AwsSection
