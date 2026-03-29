const AwsSection = () => {
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
        <p className="section-tag">// INTEGRATIONS</p>
        <h2 className="section-heading">AWS_SECURITY_STACK</h2>
        <p className="section-desc">Enterprise-grade security inspired by AWS intelligence.</p>

        <div className="mt-12 terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">aws-integrations — connected</span>
            <span className="ml-auto text-[9px] text-[#00ff41] font-bold">[ONLINE]</span>
          </div>
          <div className="terminal-body text-xs">
            <p className="text-[#6b6271] mb-3">❯ aws-sec --list-integrations</p>
            <p className="text-[#6b6271] mb-4">Active security modules:</p>

            {services.map((svc, i) => (
              <div key={i} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] glow-red" style={{ boxShadow: '0 0 6px #00ff41' }} />
                  <span className="text-[#F40000] font-bold">[{String(i + 1).padStart(2, '0')}]</span>
                  <span className="text-white font-bold">{svc.name}</span>
                  <span className="text-[#6b6271]">— port:{svc.port}</span>
                </div>
                <p className="text-[#6b6271] pl-6">    {svc.desc}</p>
                {i < services.length - 1 && (
                  <div className="pl-6 my-2 text-[#F40000]/30">    │</div>
                )}
              </div>
            ))}

            <div className="h-px bg-[#F40000]/10 my-3" />
            <p className="text-[#00ff41]">✓ All integrations healthy. Latency: {'<'}2ms</p>
            <p className="text-[#6b6271] mt-1"><span className="text-[#F40000]">❯</span> <span className="cursor">_</span></p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AwsSection
