const ImpactSection = () => {
  const stats = [
    { value: '80%', label: 'of breaches caused by misconfigurations', bar: 80 },
    { value: 'DAYS→SEC', label: 'security review time reduction', bar: 95 },
    { value: '100%', label: 'AI-powered prevention, not just detection', bar: 100 },
  ]

  return (
    <section className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-tag">// METRICS</p>
        <h2 className="section-heading">IMPACT_REPORT</h2>
        <p className="section-desc">Why automated security analysis matters.</p>

        <div className="mt-12 terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">impact-metrics</span>
          </div>
          <div className="terminal-body text-xs space-y-5">
            <p className="text-[#6b6271]">❯ ai-sec --show-impact</p>
            {stats.map((stat, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#F40000] font-bold text-lg">{stat.value}</span>
                  <span className="text-[#6b6271] text-[10px]">{stat.label}</span>
                </div>
                <div className="h-2 bg-[#1a181c] rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-1000"
                    style={{
                      width: `${stat.bar}%`,
                      background: 'linear-gradient(90deg, #F40000, #F44E3F, #F4998D)',
                      boxShadow: '0 0 10px rgba(244,0,0,0.3)',
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="h-px bg-[#F40000]/10" />
            <p className="text-[#00ff41]">✓ Security posture: SIGNIFICANTLY IMPROVED</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ImpactSection
