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
  return (
    <section id="features" className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-tag">// MODULES</p>
        <h2 className="section-heading">SECURITY_MODULES</h2>
        <p className="section-desc">Core detection engines and AI remediation pipeline.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
          {features.map((feat, i) => (
            <div key={i} className="terminal group">
              <div className="terminal-bar">
                <div className="terminal-dot bg-[#F40000]" />
                <div className="terminal-dot bg-[#F4998D]/40" />
                <div className="terminal-dot bg-[#6b6271]/30" />
                <span className="ml-2 text-[9px] text-[#6b6271]">{feat.title.toLowerCase()}</span>
                <span className={`ml-auto text-[9px] font-bold tracking-wider ${
                  feat.status === 'CRITICAL' ? 'text-[#F40000]' :
                  feat.status === 'HIGH' ? 'text-[#F44E3F]' : 'text-[#00ff41]'
                }`}>
                  [{feat.status}]
                </span>
              </div>
              <div className="terminal-body text-xs space-y-1.5">
                <p><span className="text-[#F40000] font-bold">❯</span> <span className="text-white">{feat.cmd}</span></p>
                <p className="text-[#6b6271]">Processing...</p>
                <div className="h-px bg-[#F40000]/10 my-1" />
                <p className="text-white font-bold text-[11px]"># {feat.title}</p>
                {feat.alerts.map((alert, j) => (
                  <p key={j} className="text-[#F4998D]">{alert}</p>
                ))}
                <div className="h-px bg-[#F40000]/10 my-1" />
                <p className="text-[#6b6271]">
                  <span className="text-[#F40000]">❯</span> <span className="cursor text-[#6b6271]">_</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
