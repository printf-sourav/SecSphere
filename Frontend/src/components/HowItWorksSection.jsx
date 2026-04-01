import { useState, useEffect } from 'react'
import useScrollReveal from '../hooks/useScrollReveal'
import useScrollRevealChildren from '../hooks/useScrollRevealChildren'

const HowItWorksSection = () => {
  const headerRef = useScrollReveal({ variant: 'title' })
  const terminalRef = useScrollReveal({ threshold: 0.1 })
  const pipelineRef = useScrollRevealChildren('.pipeline-step', { staggerMs: 200, threshold: 0.2 })
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 4)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const steps = [
    { tag: 'INPUT', label: 'Upload Code / Config / IAM Policy', char: '⬆', activeColor: '#00ff41', anim: 'animate-[bounce_2s_infinite]', glow: 'shadow-[0_0_15px_rgba(0,255,65,0.4)]' },
    { tag: 'SCAN', label: 'Scan Across All Security Layers', char: '⚡', activeColor: '#F40000', anim: 'animate-[pulse_1s_infinite]', glow: 'shadow-[0_0_20px_rgba(244,0,0,0.4)]' },
    { tag: 'ANALYZE', label: 'AI Explains Threats', char: '🧠', activeColor: '#F4998D', anim: 'animate-[pulse_2s_infinite]', glow: 'shadow-[0_0_20px_rgba(244,153,141,0.4)]' },
    { tag: 'FIX', label: 'Get Instant Remediation', char: '🔧', activeColor: '#00ff41', anim: 'animate-[pulse_1.5s_infinite]', glow: 'shadow-[0_0_15px_rgba(0,255,65,0.4)]' },
  ]
  
  const statusTexts = [
    "Processing input payload...",
    "Scanning all active security layers...",
    "Analyzing detected threat vectors...",
    "Applying automated secure fixes..."
  ]

  return (
    <section className="py-20 px-4 md:px-6 relative">
      <div className="max-w-5xl mx-auto">
        <div ref={headerRef}>
          <p className="section-tag">// PIPELINE</p>
          <h2 className="section-heading">EXECUTION_FLOW</h2>
          <p className="section-desc">From upload to auto-fix in 4 stages.</p>
        </div>

        <div ref={terminalRef} className="mt-12 terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">pipeline-flow</span>
            <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#00ff41] font-bold tracking-wider">
              <span className="text-[#6b6271] mr-1 hidden sm:inline animate-[pulse_3s_ease-in-out_infinite] font-normal lowercase italic tracking-normal">data flow</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse shadow-[0_0_8px_#00ff41]" />
              [ACTIVE]
            </span>
          </div>
          <div className="terminal-body text-xs relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F40000]/[0.02] to-transparent h-[200%] animate-[scanVertical_5s_linear_infinite] pointer-events-none -translate-y-1/2 opacity-50 z-0" />
            <p className="text-[#6b6271] mb-8 relative z-10">❯ ai-sec --show-pipeline</p>

            {/* ASCII pipeline */}
            <div ref={pipelineRef} className="hidden md:block font-mono text-center mb-10 relative z-10">
              <div className="flex items-center justify-center gap-0 text-[11px] relative">
                {steps.map((step, i) => {
                  const isActive = activeStep === i;
                  return (
                  <div key={i} className="flex items-center relative group">
                    <div className="text-center px-1 lg:px-2 pipeline-step transition-transform duration-300 hover:-translate-y-2 cursor-pointer relative z-10">
                      <div className={`border rounded-lg px-3 py-4 lg:px-4 lg:py-5 transition-all duration-300 bg-[#0d0c0e] flex flex-col items-center justify-center min-w-[100px] lg:min-w-[120px] ${
                        isActive ? `border-[${step.activeColor}] scale-105 ${step.glow} z-20 relative bg-[#131114]` : 'border-[#F40000]/20 hover:border-[#F40000]/50 hover:shadow-[0_0_15px_rgba(244,0,0,0.15)]'
                      }`}>
                        <span className={`text-2xl lg:text-3xl block mb-2 transition-transform duration-500 ${isActive ? step.anim : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'}`}>
                          {step.char}
                        </span>
                        <span className={`font-bold text-[10px] block transition-colors duration-300 ${isActive ? `text-[${step.activeColor}]` : 'text-[#F40000]'}`}>
                          [{step.tag}]
                        </span>
                        
                        {/* Interactive tooltip ring */}
                        <div className={`absolute inset-0 border-2 rounded-lg opacity-0 transition-opacity duration-300 pointer-events-none ${isActive ? `border-[${step.activeColor}] blur-sm opacity-50` : 'group-hover:opacity-20 border-[#F40000] blur-sm'}`} />
                      </div>
                      <p className={`text-[10px] lg:text-[11px] mt-4 max-w-[120px] mx-auto transition-colors duration-300 ${isActive ? 'text-white font-medium' : 'text-[#6b6271] group-hover:text-white/80'}`}>
                        {step.label}
                      </p>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="relative w-12 lg:w-16 h-0.5 bg-[#F40000]/20 mx-2 -mt-10 mb-4 overflow-hidden rounded">
                         <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#F40000] to-transparent w-full h-full ${i === activeStep || (activeStep === 0 && i === steps.length-1) ? 'animate-[flowRight_1s_ease-in-out_infinite]' : 'opacity-0'}`} />
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </div>

            {/* Mobile: vertical pipeline */}
            <div className="md:hidden space-y-2 relative z-10 mb-8">
              {steps.map((step, i) => {
                const isActive = activeStep === i;
                return (
                <div key={i} className="relative group">
                  <div className={`flex items-center gap-3 p-3 rounded transition-all duration-300 ${isActive ? `bg-[#131114] border border-[${step.activeColor}]/30 ${step.glow} scale-[1.02]` : 'border border-transparent hover:border-[#F40000]/20 hover:bg-[#F40000]/5'}`}>
                    <span className={`text-xl transition-all duration-300 ${isActive ? step.anim : ''}`}>{step.char}</span>
                    <span className={`font-bold text-[11px] ${isActive ? `text-[${step.activeColor}]` : 'text-[#F40000]'}`}>[{step.tag}]</span>
                    <span className={`text-[11px] transition-colors duration-300 ${isActive ? 'text-white font-medium' : 'text-[#6b6271]'}`}>{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="relative w-0.5 h-6 bg-[#F40000]/20 ml-[25px] my-1 overflow-hidden">
                       <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-[#F40000] to-transparent w-full h-full ${isActive ? 'animate-[flowDown_1s_ease-in-out_infinite]' : 'opacity-0'}`} />
                    </div>
                  )}
                </div>
              )})}
            </div>

            <div className="h-px bg-[#F40000]/10 my-4 relative z-10" />
            <div className="flex justify-between items-end relative z-10">
              <div>
                <p className="text-[#00ff41] pb-1">
                  ✓ Active operation: <span className="font-bold text-white uppercase ml-1 animate-pulse tracking-wide">{steps[activeStep].tag} NODE</span>
                </p>
                <p className="text-[#6b6271] flex items-center h-4 mt-1">
                  <span className="text-[#F40000] mr-1.5">❯</span> 
                  <span className="border-r-2 border-transparent pr-1 text-[#F4998D] italic lowercase tracking-wider animate-pulse">{statusTexts[activeStep]}</span>
                  <span className="inline-block w-1.5 h-3 h-3 bg-[#F40000] animate-[blink_1s_step-end_infinite] -ml-1" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection
