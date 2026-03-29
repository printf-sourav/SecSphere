import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const DetailedPage = () => {
  return (
    <>
      <div className="pt-20 pb-16 px-4 md:px-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Page header */}
          <div className="text-center mb-10">
            <p className="text-[#F40000] font-bold text-[10px] tracking-[0.3em] uppercase mb-2">// CLASSIFIED_DOCUMENT</p>
            <h1 className="text-3xl md:text-4xl font-bold text-[#F44E3F] mb-4" style={{ textShadow: '0 0 20px rgba(244,0,0,0.15)' }}>
              SECSPHERE
            </h1>
            <p className="text-[#6b6271] text-sm max-w-2xl mx-auto">
              Complete project documentation — architecture, capabilities, and impact.
            </p>
            <Link to="/" className="btn-ghost !text-xs mt-6 inline-flex">❯ cd ~/home</Link>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* PROBLEM STATEMENT */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">problem-statement</span>
              <span className="ml-auto text-[9px] text-[#F40000] font-bold">[CRITICAL]</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ cat /docs/problem_statement.md</p>
              <p className="text-white font-bold text-sm"># 🚨 PROBLEM_STATEMENT</p>
              <p className="text-[#6b6271]">Modern software development is fast, but security is slow and complex.</p>
              <div className="border border-[#F40000]/10 rounded p-3 space-y-2">
                <p className="text-[#F40000]">  [✘] Developers push insecure code unknowingly</p>
                <p className="text-[#F40000]">  [✘] Security reviews take days or weeks</p>
                <p className="text-[#F40000]">  [✘] 80%+ cloud breaches due to misconfigurations</p>
                <p className="text-[#F40000]">  [✘] IAM policies are overly permissive ("it works, ship it")</p>
                <p className="text-[#F40000]">  [✘] Existing tools generate complex, unreadable reports</p>
              </div>
              <div className="border border-[#F40000]/20 rounded p-3 bg-[#F40000]/5">
                <p className="text-[#F40000] font-bold text-[10px] tracking-wider mb-1">CORE PROBLEM:</p>
                <p className="text-[#F4998D]">There is no simple, developer-friendly tool that not only detects</p>
                <p className="text-[#F4998D]">vulnerabilities but also <span className="text-white font-bold">explains and fixes them automatically</span>.</p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* SOLUTION */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">solution-overview</span>
              <span className="ml-auto text-[9px] text-[#00ff41] font-bold">[SOLVED]</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ cat /docs/solution.md</p>
              <p className="text-white font-bold text-sm"># 💡 OUR_SOLUTION</p>
              <p className="text-[#6b6271]">An AI-powered Security Review Agent that scans code, configurations,</p>
              <p className="text-[#6b6271]">and IAM policies — explains vulnerabilities in simple terms — and</p>
              <p className="text-[#6b6271]">generates secure fixes instantly.</p>
              <div className="border border-[#00ff41]/15 rounded p-4 bg-[#00ff41]/3 text-center">
                <p className="text-[#00ff41] font-bold text-sm tracking-wider">
                  "Detect → Explain → Fix — all in seconds using AI"
                </p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* WHAT OUR SYSTEM DOES */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">system-capabilities</span>
              <span className="ml-auto text-[9px] text-[#F40000] font-bold">[6 MODULES]</span>
            </div>
            <div className="terminal-body text-xs space-y-4">
              <p className="text-[#6b6271]">❯ ai-sec --list-capabilities</p>
              <p className="text-white font-bold text-sm"># ⚙️ SYSTEM_CAPABILITIES</p>

              {/* Module 1: Code */}
              <div className="border border-[#F40000]/10 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F40000] font-bold">[01]</span>
                  <span className="text-white font-bold">🔍 CODE_SECURITY_ANALYSIS</span>
                </div>
                <p className="text-[#6b6271] pl-6">Detect:</p>
                <p className="text-[#F4998D] pl-6">  → SQL Injection vulnerabilities</p>
                <p className="text-[#F4998D] pl-6">  → Cross-Site Scripting (XSS)</p>
                <p className="text-[#F4998D] pl-6">  → Hardcoded secrets & API keys</p>
              </div>

              {/* Module 2: Cloud */}
              <div className="border border-[#F40000]/10 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F40000] font-bold">[02]</span>
                  <span className="text-white font-bold">☁️ CLOUD_CONFIGURATION_SCANNER</span>
                </div>
                <p className="text-[#6b6271] pl-6">Detect:</p>
                <p className="text-[#F4998D] pl-6">  → Public S3 buckets</p>
                <p className="text-[#F4998D] pl-6">  → Open ports (0.0.0.0/0)</p>
                <p className="text-[#F4998D] pl-6">  → Misconfigured infrastructure</p>
              </div>

              {/* Module 3: IAM */}
              <div className="border border-[#F40000]/10 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F40000] font-bold">[03]</span>
                  <span className="text-white font-bold">🔐 IAM_POLICY_ANALYZER</span>
                </div>
                <p className="text-[#6b6271] pl-6">Detect:</p>
                <p className="text-[#F4998D] pl-6">  → "Action": "*" (wildcard permissions)</p>
                <p className="text-[#F4998D] pl-6">  → "Resource": "*" (unrestricted access)</p>
                <p className="text-[#00ff41] pl-6">  → Suggest least privilege policies</p>
              </div>

              {/* Module 4: AI Explain */}
              <div className="border border-[#00ff41]/15 rounded p-3 bg-[#00ff41]/3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F40000] font-bold">[04]</span>
                  <span className="text-white font-bold">🧠 AI_EXPLANATION_ENGINE</span>
                  <span className="text-[#00ff41] text-[9px] font-bold ml-2">[KEY FEATURE]</span>
                </div>
                <p className="text-[#6b6271] pl-6">Converts complex security issues into simple explanations.</p>
                <div className="mt-2 pl-6 border-l-2 border-[#F40000]/30 ml-4 pl-3">
                  <p className="text-[#6b6271] text-[10px] italic">"User input is directly used in SQL query →</p>
                  <p className="text-[#6b6271] text-[10px] italic"> attacker can inject malicious queries"</p>
                </div>
              </div>

              {/* Module 5: Auto Fix */}
              <div className="border border-[#00ff41]/15 rounded p-3 bg-[#00ff41]/3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F40000] font-bold">[05]</span>
                  <span className="text-white font-bold">🛠 AUTO_FIX_GENERATOR</span>
                  <span className="text-[#F40000] text-[9px] font-bold ml-2 animate-pulse">[WINNING FEATURE]</span>
                </div>
                <p className="text-[#6b6271] pl-6">Suggests secure code instantly — production-ready patches.</p>
              </div>

              {/* Module 6: Dashboard */}
              <div className="border border-[#F40000]/10 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F40000] font-bold">[06]</span>
                  <span className="text-white font-bold">📊 UNIFIED_SECURITY_DASHBOARD</span>
                </div>
                <p className="text-[#6b6271] pl-6">Shows: All vulnerabilities | Severity levels | Fix suggestions</p>
              </div>

              <p className="text-[#00ff41]">✓ All 6 modules loaded and operational.</p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ARCHITECTURE */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">system-architecture</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ ai-sec --show-architecture</p>
              <p className="text-white font-bold text-sm"># 🏗️ SYSTEM_ARCHITECTURE</p>
              <pre className="text-[#F4998D] text-[10px] md:text-xs overflow-x-auto">{`
    ┌─────────────────────────────────────┐
    │     USER UPLOAD                     │
    │   (Code / Config / IAM Policy)      │
    └─────────────────┬───────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────┐
    │          BACKEND API                │
    │     (FastAPI / Node.js)             │
    └─────────────────┬───────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    ┌─────────┐ ┌──────────┐ ┌──────────┐
    │  CODE   │ │  CONFIG  │ │   IAM    │
    │  SCAN   │ │  SCAN    │ │ ANALYSIS │
    │(Semgrep)│ │ (Custom) │ │ (Custom) │
    └────┬────┘ └────┬─────┘ └────┬─────┘
         │           │            │
         └───────────┼────────────┘
                     ▼
    ┌─────────────────────────────────────┐
    │    SECURITY AGGREGATOR              │
    │   (Inspired by AWS Security Hub)    │
    └─────────────────┬───────────────────┘
                      ▼
    ┌─────────────────────────────────────┐
    │       AI ANALYSIS ENGINE            │
    │         (OpenAI API)                │
    └─────────────────┬───────────────────┘
                      ▼
    ┌─────────────────────────────────────┐
    │  EXPLANATION + FIX GENERATOR        │
    └─────────────────┬───────────────────┘
                      ▼
    ┌─────────────────────────────────────┐
    │      FRONTEND DASHBOARD             │
    │     (React + Tailwind CSS)          │
    └─────────────────────────────────────┘`}
              </pre>
              <p className="text-[#00ff41]">✓ Architecture diagram rendered.</p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* HOW IT WORKS */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">execution-flow</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ ai-sec --show-pipeline</p>
              <p className="text-white font-bold text-sm"># 🧠 HOW_IT_WORKS</p>

              <div className="space-y-2">
                {[
                  { step: '01', label: 'User uploads code or repository', icon: '⬆', color: '#F4998D' },
                  { step: '02', label: 'System scans using rule-based tools (Semgrep + Custom)', icon: '🔍', color: '#F44E3F' },
                  { step: '03', label: 'Vulnerabilities detected and categorized', icon: '⚠', color: '#F40000' },
                  { step: '04', label: 'AI explains each issue in plain language', icon: '🧠', color: '#F4998D' },
                  { step: '05', label: 'AI suggests production-ready fixes', icon: '🛠', color: '#00ff41' },
                  { step: '06', label: 'Dashboard displays all results', icon: '📊', color: '#00ff41' },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[#F40000] font-bold shrink-0">[{s.step}]</span>
                    <span className="shrink-0">{s.icon}</span>
                    <span style={{ color: s.color }}>{s.label}</span>
                    {i < 5 && <span className="text-[#F40000]/20 absolute left-8 mt-5">│</span>}
                  </div>
                ))}
              </div>

              <div className="h-px bg-[#F40000]/10 my-2" />
              <p className="text-[#00ff41]">✓ Pipeline execution: avg 4.2s end-to-end</p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TECH STACK */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">tech-stack</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ cat /docs/tech_stack.md</p>
              <p className="text-white font-bold text-sm"># 🧰 TECH_STACK</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-[#F40000]/10 rounded p-3">
                  <p className="text-[#F40000] font-bold text-[10px] tracking-wider mb-2">FRONTEND</p>
                  <p className="text-white">  React + Tailwind CSS</p>
                  <p className="text-[#6b6271]">  Responsive dashboard UI</p>
                </div>
                <div className="border border-[#F40000]/10 rounded p-3">
                  <p className="text-[#F40000] font-bold text-[10px] tracking-wider mb-2">BACKEND</p>
                  <p className="text-white">  FastAPI / Node.js</p>
                  <p className="text-[#6b6271]">  REST API + scan orchestration</p>
                </div>
                <div className="border border-[#F40000]/10 rounded p-3">
                  <p className="text-[#F40000] font-bold text-[10px] tracking-wider mb-2">AI LAYER</p>
                  <p className="text-white">  OpenAI API</p>
                  <p className="text-[#6b6271]">  Explanation + fix generation</p>
                </div>
                <div className="border border-[#F40000]/10 rounded p-3">
                  <p className="text-[#F40000] font-bold text-[10px] tracking-wider mb-2">SECURITY TOOLS</p>
                  <p className="text-white">  Semgrep (code scanning)</p>
                  <p className="text-[#6b6271]">  Custom rules (config + IAM)</p>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* MARKET ANALYSIS */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">market-analysis</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ ai-sec --compare-competitors</p>
              <p className="text-white font-bold text-sm"># ⚔️ EXISTING_SOLUTIONS</p>

              <div className="border border-[#F40000]/10 rounded p-3 space-y-1">
                <p className="text-[#6b6271] font-bold text-[10px] mb-2">COMPETITORS:</p>
                <p className="text-white">  Snyk | SonarQube | AWS Security Hub</p>
                <p className="text-white">  Amazon GuardDuty | IAM Access Analyzer</p>
              </div>

              <p className="text-white font-bold mt-2"># ❌ PROBLEMS WITH EXISTING TOOLS:</p>
              <div className="border border-[#F40000]/15 rounded p-3 space-y-1.5 bg-[#F40000]/3">
                <p className="text-[#F40000]">  [✘] Complex reports (hard for beginners)</p>
                <p className="text-[#F40000]">  [✘] No clear explanations</p>
                <p className="text-[#F40000]">  [✘] No auto-fix suggestions</p>
                <p className="text-[#F40000]">  [✘] Separate tools for Code / Cloud / IAM</p>
                <p className="text-[#F40000]">  [✘] Mostly detection-only (not actionable)</p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* COMPETITIVE ADVANTAGE */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">competitive-advantage</span>
              <span className="ml-auto text-[9px] text-[#00ff41] font-bold">[WINNING]</span>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ ai-sec --why-us</p>
              <p className="text-white font-bold text-sm"># 🚀 WHAT_MAKES_US_BETTER</p>

              <div className="space-y-2">
                {[
                  { tag: '01', title: 'AI-Powered Explanation', desc: 'Makes security understandable for everyone' },
                  { tag: '02', title: 'Auto-Fix Suggestions', desc: 'Not just detection — solution provided instantly' },
                  { tag: '03', title: 'Unified Platform', desc: 'Code + Config + IAM — all in one place' },
                  { tag: '04', title: 'Beginner-Friendly', desc: 'No deep security knowledge required' },
                  { tag: '05', title: 'Faster Workflow', desc: 'Reduces review time from days → seconds' },
                  { tag: '06', title: 'Shift-Left Security', desc: 'Prevent vulnerabilities before deployment' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded border border-[#00ff41]/10 hover:border-[#00ff41]/30 transition-all bg-[#00ff41]/3">
                    <span className="text-[#F40000] font-bold shrink-0">[{item.tag}]</span>
                    <div>
                      <span className="text-[#00ff41] font-bold">✅ {item.title}</span>
                      <p className="text-[#6b6271] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-[#F40000]/20 rounded p-4 bg-[#F40000]/5 text-center mt-4">
                <p className="text-[#F4998D] text-[11px] italic">
                  "Traditional tools detect problems. Our system detects, explains,
                </p>
                <p className="text-[#F4998D] text-[11px] italic">
                  and <span className="text-white font-bold">fixes them using AI</span> — all in one platform."
                </p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* DEMO FLOW */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">demo-walkthrough</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />
                <span className="text-[9px] text-[#F40000] tracking-wider font-bold">LIVE</span>
              </div>
            </div>
            <div className="terminal-body text-xs space-y-3">
              <p className="text-[#6b6271]">❯ ai-sec --run-demo</p>
              <p className="text-white font-bold text-sm"># 🧪 DEMO_WALKTHROUGH</p>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[#F40000] font-bold">[1]</span>
                  <span className="text-white">Upload vulnerable code</span>
                </div>
                <div className="pl-8 border border-[#F40000]/10 rounded p-2.5 bg-[#0d0c0e]">
                  <p className="text-[#F40000] text-[10px]">// vulnerable_login.js</p>
                  <p className="text-[#F4998D]">{'const query = `SELECT * FROM users WHERE email=\'${input}\'`;'}</p>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[#F40000] font-bold">[2]</span>
                  <span className="text-white">System detects SQL Injection</span>
                </div>
                <div className="pl-8 border border-[#F40000]/20 rounded p-2.5 bg-[#F40000]/5">
                  <p className="text-[#F40000] font-bold">⚠ VULNERABILITY: SQL Injection (CWE-89)</p>
                  <p className="text-[#F4998D]">Severity: CRITICAL | File: login.js:14</p>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[#F40000] font-bold">[3]</span>
                  <span className="text-white">AI explains the issue</span>
                </div>
                <div className="pl-8 border border-[#F4998D]/15 rounded p-2.5">
                  <p className="text-[#F4998D]">🧠 "User input is directly concatenated into the SQL query.</p>
                  <p className="text-[#F4998D]">   An attacker can inject malicious SQL to bypass authentication</p>
                  <p className="text-[#F4998D]">   or extract the entire database."</p>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[#F40000] font-bold">[4]</span>
                  <span className="text-white">AI suggests secure fix</span>
                </div>
                <div className="pl-8 border border-[#00ff41]/15 rounded p-2.5 bg-[#00ff41]/3">
                  <p className="text-[#6b6271]">// secure version:</p>
                  <p className="text-[#00ff41]">{'const query = "SELECT * FROM users WHERE email = ?";'}</p>
                  <p className="text-[#00ff41]">{'db.execute(query, [req.body.email]);'}</p>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[#F40000] font-bold">[5]</span>
                  <span className="text-white">Everything displayed in dashboard</span>
                </div>
                <p className="text-[#00ff41] pl-8">✓ Results visible. Fix can be applied with one click.</p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* IMPACT */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">impact-report</span>
            </div>
            <div className="terminal-body text-xs space-y-4">
              <p className="text-[#6b6271]">❯ ai-sec --show-impact</p>
              <p className="text-white font-bold text-sm"># 📈 IMPACT</p>

              {[
                { icon: '🚀', label: 'Saves developer time', detail: 'Review from days → seconds', pct: 95 },
                { icon: '🔐', label: 'Prevents security breaches', detail: '80%+ breaches are misconfigurations', pct: 80 },
                { icon: '👨‍💻', label: 'Makes security accessible', detail: 'No deep security knowledge needed', pct: 100 },
                { icon: '⚡', label: 'Improves DevSecOps', detail: 'Shift-left security workflow', pct: 90 },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white">{item.icon} {item.label}</span>
                    <span className="text-[#6b6271] text-[10px]">{item.detail}</span>
                  </div>
                  <div className="h-2 bg-[#1a181c] rounded overflow-hidden">
                    <div className="h-full rounded" style={{
                      width: `${item.pct}%`,
                      background: 'linear-gradient(90deg, #F40000, #F44E3F, #F4998D)',
                      boxShadow: '0 0 10px rgba(244,0,0,0.3)',
                    }} />
                  </div>
                </div>
              ))}

              <div className="h-px bg-[#F40000]/10" />
              <p className="text-[#00ff41]">✓ Security posture: SIGNIFICANTLY IMPROVED</p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* CTA */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="terminal">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">ready</span>
            </div>
            <div className="terminal-body text-center py-10 space-y-4">
              <p className="text-white font-bold text-lg">READY_TO_SECURE_YOUR_STACK?</p>
              <p className="text-[#6b6271] text-xs max-w-md mx-auto">
                Start scanning your code, cloud configurations, and IAM policies in seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
                <button className="btn-red">❯ START_FREE_SCAN</button>
                <Link to="/" className="btn-ghost">❯ cd ~/home</Link>
              </div>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </>
  )
}

export default DetailedPage
