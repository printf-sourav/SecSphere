import { useState } from 'react'

const VULNS = [
  { id: 'CVE-2024-001', title: 'SQL Injection in /api/login', sev: 'CRIT', color: '#F40000' },
  { id: 'CVE-2024-002', title: 'Public S3: prod-assets', sev: 'HIGH', color: '#F44E3F' },
  { id: 'CVE-2024-003', title: 'IAM wildcard on Lambda', sev: 'HIGH', color: '#F44E3F' },
  { id: 'WARN-001', title: 'Hardcoded API key', sev: 'MED', color: '#F4998D' },
  { id: 'WARN-002', title: 'XSS in profile render', sev: 'MED', color: '#F4998D' },
]

const DemoSection = () => {
  const [selected, setSelected] = useState(0)

  return (
    <section id="demo" className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-tag">// LIVE_SCAN</p>
        <h2 className="section-heading">THREAT_DASHBOARD</h2>
        <p className="section-desc">Real-time vulnerability detection, AI analysis, and auto-fix.</p>

        <div className="mt-12 terminal">
          <div className="terminal-bar">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">dashboard — scan-results — 5 threats</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />
              <span className="text-[9px] text-[#F40000] tracking-wider font-bold">SCANNING</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#F40000]/8">
            {/* Threat list */}
            <div className="p-5 text-xs">
              <p className="text-[#6b6271] text-[10px] mb-3 uppercase tracking-widest font-bold">❯ cat /threats</p>
              <div className="space-y-1.5">
                {VULNS.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => setSelected(i)}
                    className={`flex items-center gap-2 p-2.5 rounded cursor-pointer transition-all duration-200 ${
                      selected === i
                        ? 'bg-[#F40000]/8 border border-[#F40000]/25'
                        : 'border border-transparent hover:bg-[#F40000]/3'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color, boxShadow: `0 0 5px ${v.color}` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate text-[11px]">{v.title}</p>
                      <p className="text-[#6b6271] text-[9px] font-mono">{v.id}</p>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ color: v.color, border: `1px solid ${v.color}30` }}>
                      {v.sev}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            <div className="p-5 text-xs">
              <p className="text-[#6b6271] text-[10px] mb-3 uppercase tracking-widest font-bold">❯ ai-explain {VULNS[selected].id}</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] glow-red" />
                  <span className="text-[9px] font-bold tracking-wider" style={{ color: VULNS[selected].color }}>{VULNS[selected].sev} THREAT</span>
                </div>
                <p className="text-white font-bold text-[11px]">{VULNS[selected].title}</p>
                <p className="text-[#6b6271] leading-relaxed">
                  {selected === 0 && <>The <span className="text-[#F40000]">loginUser()</span> function directly concatenates user input into SQL. An attacker can inject <span className="text-[#F40000]">malicious payloads</span> to bypass auth or exfiltrate data.</>}
                  {selected === 1 && <>S3 bucket <span className="text-[#F40000]">prod-assets</span> has a public ACL policy. Any internet user can read all objects. This may leak <span className="text-[#F40000]">sensitive production data</span>.</>}
                  {selected === 2 && <>Lambda execution role has <span className="text-[#F40000]">Action: "*"</span> and <span className="text-[#F40000]">Resource: "*"</span>. This grants unrestricted access to all AWS services.</>}
                  {selected === 3 && <>File <span className="text-[#F40000]">.env.production</span> contains a hardcoded <span className="text-[#F40000]">STRIPE_SECRET_KEY</span>. Secrets must be stored in a vault or environment variables.</>}
                  {selected === 4 && <>User profile component renders <span className="text-[#F40000]">unsanitized HTML</span> via dangerouslySetInnerHTML. An attacker can inject scripts to steal session cookies.</>}
                </p>
                <div className="p-2.5 rounded bg-[#F40000]/5 border border-[#F40000]/12 font-mono text-[10px] text-[#F4998D]">
                  {selected === 0 && 'query = `SELECT * FROM users WHERE email=\'${input}\'`'}
                  {selected === 1 && '"Principal": "*", "Effect": "Allow"'}
                  {selected === 2 && '"Action": "*", "Resource": "*"'}
                  {selected === 3 && 'STRIPE_SECRET_KEY=sk_live_12345...'}
                  {selected === 4 && '<div dangerouslySetInnerHTML={{__html: bio}} />'}
                </div>
              </div>
            </div>

            {/* Auto-Fix */}
            <div className="p-5 text-xs">
              <p className="text-[#6b6271] text-[10px] mb-3 uppercase tracking-widest font-bold">❯ ai-fix --apply</p>
              <div className="space-y-3">
                <p className="text-[#6b6271]">Generating secure patch...</p>
                <div className="p-3 rounded bg-[#00ff41]/5 border border-[#00ff41]/15 font-mono text-[10px] space-y-1">
                  <p className="text-[#6b6271]">// secure implementation</p>
                  {selected === 0 && <>
                    <p className="text-[#F40000]">- query = `SELECT * ... ${'{input}'}`</p>
                    <p className="text-[#00ff41]">+ const q = "SELECT * FROM users WHERE email = ?";</p>
                    <p className="text-[#00ff41]">+ db.execute(q, [req.body.email]);</p>
                  </>}
                  {selected === 1 && <>
                    <p className="text-[#F40000]">- "Principal": "*"</p>
                    <p className="text-[#00ff41]">+ "Principal": {"{"}"AWS": "arn:aws:iam::123:root"{"}"}</p>
                    <p className="text-[#00ff41]">+ "Condition": {"{"}"Bool": ...{"}"}</p>
                  </>}
                  {selected === 2 && <>
                    <p className="text-[#F40000]">- "Action": "*"</p>
                    <p className="text-[#00ff41]">+ "Action": ["s3:GetObject", "s3:PutObject"]</p>
                    <p className="text-[#F40000]">- "Resource": "*"</p>
                    <p className="text-[#00ff41]">+ "Resource": "arn:aws:s3:::bucket/*"</p>
                  </>}
                  {selected === 3 && <>
                    <p className="text-[#F40000]">- STRIPE_SECRET_KEY=sk_live_...</p>
                    <p className="text-[#00ff41]">+ STRIPE_SECRET_KEY=${"{{"}vault.stripe_key{"}}"}</p>
                  </>}
                  {selected === 4 && <>
                    <p className="text-[#F40000]">- dangerouslySetInnerHTML</p>
                    <p className="text-[#00ff41]">+ import DOMPurify from 'dompurify';</p>
                    <p className="text-[#00ff41]">+ {"<div>{DOMPurify.sanitize(bio)}</div>"}</p>
                  </>}
                </div>
                <div className="flex gap-2">
                  <button className="btn-red flex-1 !py-2 !px-3 !text-[10px]">APPLY_FIX</button>
                  <button className="btn-ghost flex-1 !py-2 !px-3 !text-[10px]">SKIP</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <button className="btn-ghost" id="try-live-demo">❯ RUN_LIVE_SCAN</button>
        </div>
      </div>
    </section>
  )
}

export default DemoSection
