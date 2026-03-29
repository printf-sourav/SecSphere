const HowItWorksSection = () => {
  const steps = [
    { tag: 'INPUT', label: 'Upload Code / Config / IAM Policy', char: '⬆' },
    { tag: 'SCAN', label: 'Scan Across All Security Layers', char: '⚡' },
    { tag: 'ANALYZE', label: 'AI Explains Threats', char: '🧠' },
    { tag: 'FIX', label: 'Get Instant Remediation', char: '🔧' },
  ]

  return (
    <section className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-tag">// PIPELINE</p>
        <h2 className="section-heading">EXECUTION_FLOW</h2>
        <p className="section-desc">From upload to auto-fix in 4 stages.</p>

        <div className="mt-12 terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">pipeline-flow</span>
          </div>
          <div className="terminal-body text-xs">
            <p className="text-[#6b6271] mb-4">❯ ai-sec --show-pipeline</p>

            {/* ASCII pipeline */}
            <div className="hidden md:block font-mono text-center mb-6">
              <div className="flex items-center justify-center gap-0 text-[11px]">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center">
                    <div className="text-center px-2">
                      <div className="border border-[#F40000]/30 rounded px-4 py-3 hover:border-[#F40000] hover:shadow-[0_0_15px_rgba(244,0,0,0.15)] transition-all duration-300 bg-[#0d0c0e]">
                        <span className="text-lg block mb-1">{step.char}</span>
                        <span className="text-[#F40000] font-bold text-[10px] block">[{step.tag}]</span>
                      </div>
                      <p className="text-[#6b6271] text-[10px] mt-2 max-w-[120px]">{step.label}</p>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="text-[#F40000]/40 mx-1 mb-8">──{'>'}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: vertical pipeline */}
            <div className="md:hidden space-y-2">
              {steps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3">
                    <span className="text-[#F40000]">{step.char}</span>
                    <span className="text-[#F40000] font-bold">[{step.tag}]</span>
                    <span className="text-white">{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="text-[#F40000]/30 pl-2 text-xs">   │</div>
                  )}
                </div>
              ))}
            </div>

            <div className="h-px bg-[#F40000]/10 my-3" />
            <p className="text-[#00ff41]">✓ Pipeline ready. Average execution: 4.2s</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection
