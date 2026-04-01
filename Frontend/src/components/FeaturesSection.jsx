import useScrollReveal from '../hooks/useScrollReveal'
import useScrollRevealChildren from '../hooks/useScrollRevealChildren'

const features = [
  {
    cmd: 'scan --type=code',
    title: 'CODE_VULNERABILITY_DETECTION',
    alerts: [
      '→ SQL Injection vectors identified',
      '→ XSS payloads in user inputs',
      '→ Hardcoded secrets in 3 files',
    ],
    status: 'CRITICAL',
  },
  {
    cmd: 'scan --type=cloud',
    title: 'CLOUD_CONFIGURATION_SECURITY',
    alerts: [
      '→ Public S3 bucket: prod-assets',
      '→ Security group open: 0.0.0.0/0',
      '→ Terraform misconfig in vpc.tf',
    ],
    status: 'HIGH',
  },
  {
    cmd: 'scan --type=iam',
    title: 'IAM_POLICY_ANALYZER',
    alerts: [
      '→ Wildcard Action: "*" detected',
      '→ Resource: "*" on Lambda role',
      '→ Missing MFA condition',
    ],
    status: 'HIGH',
  },
  {
    cmd: 'scan --type=ai-fix',
    title: 'AI_AUTO_FIX_ENGINE',
    alerts: [
      '→ 3 fixes generated automatically',
      '→ Plain-language explanations ready',
      '→ One-click apply available',
    ],
    status: 'READY',
  },
]

const FeaturesSection = () => {
  const headerRef = useScrollReveal({ variant: 'title' })
  const gridRef = useScrollRevealChildren('.terminal', { staggerMs: 150 })

  return (
    <section id="features" className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <div ref={headerRef}>
          <p className="section-tag">// MODULES</p>
          <h2 className="section-heading">SECURITY_MODULES</h2>
          <p className="section-desc">Core detection engines and AI remediation pipeline.</p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          {features.map((feat, i) => {
            const isCritical = feat.status === 'CRITICAL';
            
            return (
            <div 
              key={i} 
              className={`terminal group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(244,0,0,0.2)] hover:border-[#F40000]/50 relative overflow-hidden ${
                isCritical ? 'border-[#F40000]/40 shadow-[0_0_20px_rgba(244,0,0,0.1)] scale-[1.01]' : 'border-[#F40000]/15'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F40000]/[0.03] to-transparent h-[200%] animate-[scanVertical_5s_linear_infinite] pointer-events-none -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="terminal-bar relative z-10 transition-colors duration-300 group-hover:bg-[#F40000]/10">
                <div className="terminal-dot bg-[#F40000]" />
                <div className="terminal-dot bg-[#F4998D]/40" />
                <div className="terminal-dot bg-[#6b6271]/30" />
                <span className="ml-2 text-[9px] text-[#6b6271] uppercase tracking-wider">{feat.title.toLowerCase().replace(/_/g, '-')}</span>
                <div className={`ml-auto flex items-center gap-1.5 text-[9px] font-bold tracking-wider ${
                  feat.status === 'CRITICAL' ? 'text-[#F40000]' :
                  feat.status === 'HIGH' ? 'text-[#F44E3F]' : 'text-[#00ff41]'
                }`}>
                  {feat.status === 'CRITICAL' && <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />}
                  {feat.status === 'HIGH' && <div className="w-1.5 h-1.5 rounded-full bg-[#F44E3F] animate-[pulse_3s_ease-in-out_infinite] shadow-[0_0_8px_#F44E3F]" />}
                  {feat.status === 'READY' && <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] shadow-[0_0_8px_#00ff41]" />}
                  [{feat.status}]
                </div>
              </div>
              <div className="terminal-body text-xs space-y-2 relative z-10">
                <p><span className="text-[#F40000] font-bold">❯</span> <span className="text-white">{feat.cmd}</span></p>
                <p className="text-[#6b6271] animate-pulse">Initializing module array...</p>
                <div className="h-px bg-[#F40000]/10 my-2 transition-all duration-300 group-hover:bg-[#F40000]/30" />
                <p className="text-white font-bold text-[11px] uppercase tracking-widest text-[#F44E3F] drop-shadow-[0_0_5px_rgba(244,78,63,0.5)]"># {feat.title}</p>
                <div className="space-y-1.5">
                  {feat.alerts.map((alert, j) => (
                    <p 
                      key={j} 
                      className="text-[#F4998D] animate-fade-in opacity-0" 
                      style={{ animationDelay: `${0.3 + (j * 0.15)}s`, animationFillMode: 'forwards' }}
                    >
                      {alert}
                    </p>
                  ))}
                </div>
                <div className="h-px bg-[#F40000]/10 my-2 transition-all duration-300 group-hover:bg-[#F40000]/30" />
                <p className="text-[#6b6271] flex items-center h-4">
                  <span className="text-[#F40000] mr-1.5">❯</span> 
                  <span className="typing-text overflow-hidden whitespace-nowrap border-r-2 border-transparent pr-1">waiting for input</span>
                  <span className="inline-block w-1.5 h-3.5 bg-[#F40000] animate-[blink_1s_step-end_infinite] -ml-1" />
                </p>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
