import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

// ── DATA ──────────────────────────────────────────────────────────
const VULNS = [
  { id: 'CVE-2024-001', title: 'SQL Injection in /api/login', file: 'routes/auth.js:14', sev: 'CRIT', type: 'code', color: '#F40000',
    explain: 'User input is concatenated directly into an SQL query string. An attacker can inject malicious SQL to bypass authentication or dump the database.',
    code: 'const q = `SELECT * FROM users WHERE email=\'${input}\'`;',
    fix: 'const q = "SELECT * FROM users WHERE email = ?";\ndb.execute(q, [req.body.email]);' },
  { id: 'CVE-2024-002', title: 'Hardcoded Secret Key', file: 'config/auth.js:3', sev: 'CRIT', type: 'code', color: '#F40000',
    explain: 'A production secret key is hardcoded in the source code. If the repo is public or compromised, attackers gain full access to JWT signing.',
    code: 'const SECRET = "sk_live_a1b2c3d4e5f6g7h8i9";',
    fix: 'const SECRET = process.env.JWT_SECRET;\n// Store in .env or secrets manager' },
  { id: 'CVE-2024-003', title: 'XSS via dangerouslySetInnerHTML', file: 'components/Profile.jsx:42', sev: 'HIGH', type: 'code', color: '#F44E3F',
    explain: 'User-supplied bio field is rendered as raw HTML without sanitization. An attacker can inject <script> tags to steal cookies or session tokens.',
    code: '<div dangerouslySetInnerHTML={{__html: user.bio}} />',
    fix: 'import DOMPurify from "dompurify";\n<div>{DOMPurify.sanitize(user.bio)}</div>' },
  { id: 'CFG-2024-001', title: 'Public S3 Bucket: prod-assets', file: 'infra/s3.tf:8', sev: 'CRIT', type: 'cloud', color: '#F40000',
    explain: 'The S3 bucket has a public ACL policy. Any internet user can read all objects, potentially leaking production data, user uploads, or internal configs.',
    code: 'acl = "public-read"\n# Block public access: false',
    fix: 'acl = "private"\nblock_public_acls = true\nblock_public_policy = true' },
  { id: 'CFG-2024-002', title: 'Security Group: 0.0.0.0/0 on SSH', file: 'infra/sg.tf:15', sev: 'HIGH', type: 'cloud', color: '#F44E3F',
    explain: 'SSH (port 22) is open to the entire internet. Attackers can brute-force credentials or exploit SSH vulnerabilities remotely.',
    code: 'ingress {\n  from_port = 22\n  cidr_blocks = ["0.0.0.0/0"]\n}',
    fix: 'ingress {\n  from_port = 22\n  cidr_blocks = ["10.0.0.0/8"] # VPN only\n}' },
  { id: 'CFG-2024-003', title: 'Unencrypted RDS Instance', file: 'infra/rds.tf:22', sev: 'MED', type: 'cloud', color: '#F4998D',
    explain: 'Database storage is not encrypted at rest. If underlying hardware is compromised, data can be read in plaintext.',
    code: 'storage_encrypted = false',
    fix: 'storage_encrypted = true\nkms_key_id = aws_kms_key.db.arn' },
  { id: 'IAM-2024-001', title: 'Wildcard Action on Lambda Role', file: 'iam/lambda-role.json:5', sev: 'CRIT', type: 'iam', color: '#F40000',
    explain: 'The Lambda execution role has Action: "*" and Resource: "*", granting unrestricted access to every AWS service. A compromised function can pivot across your entire infrastructure.',
    code: '"Action": "*",\n"Resource": "*"',
    fix: '"Action": ["s3:GetObject", "s3:PutObject"],\n"Resource": "arn:aws:s3:::my-bucket/*"' },
  { id: 'IAM-2024-002', title: 'Cross-Account Trust: Principal *', file: 'iam/trust-policy.json:3', sev: 'HIGH', type: 'iam', color: '#F44E3F',
    explain: 'The trust policy allows any AWS account to assume this role. An attacker with any AWS account can escalate privileges into your environment.',
    code: '"Principal": {"AWS": "*"}',
    fix: '"Principal": {"AWS": "arn:aws:iam::123456789:root"}\n"Condition": {"Bool": {"aws:MultiFactorAuthPresent":"true"}}' },
  { id: 'IAM-2024-003', title: 'No MFA Condition on Admin Role', file: 'iam/admin-role.json:8', sev: 'MED', type: 'iam', color: '#F4998D',
    explain: 'Admin role can be assumed without MFA. If credentials are stolen, there is no second factor preventing unauthorized access.',
    code: '// No Condition block present',
    fix: '"Condition": {\n  "Bool": {"aws:MultiFactorAuthPresent": "true"}\n}' },
]

const TABS = [
  { id: 'all', label: 'ALL', icon: '◉' },
  { id: 'code', label: 'CODE', icon: '⌨' },
  { id: 'cloud', label: 'CLOUD', icon: '☁' },
  { id: 'iam', label: 'IAM', icon: '🔐' },
]

// ── COMPONENT ─────────────────────────────────────────────────────
const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedVuln, setSelectedVuln] = useState(0)
  const [fixApplied, setFixApplied] = useState({})

  // Upload state
  const [repoUrl, setRepoUrl] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [scanState, setScanState] = useState('idle') // idle | scanning | done
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const filtered = activeTab === 'all' ? VULNS : VULNS.filter(v => v.type === activeTab)
  const current = filtered[selectedVuln] || filtered[0]

  const counts = {
    total: VULNS.length,
    crit: VULNS.filter(v => v.sev === 'CRIT').length,
    high: VULNS.filter(v => v.sev === 'HIGH').length,
    med: VULNS.filter(v => v.sev === 'MED').length,
    code: VULNS.filter(v => v.type === 'code').length,
    cloud: VULNS.filter(v => v.type === 'cloud').length,
    iam: VULNS.filter(v => v.type === 'iam').length,
  }

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    setSelectedVuln(0)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setUploadedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, size: f.size, type: f.name.split('.').pop() }))])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    setUploadedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, size: f.size, type: f.name.split('.').pop() }))])
  }

  const removeFile = (idx) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const startScan = () => {
    if (!repoUrl && uploadedFiles.length === 0) return
    setScanState('scanning')
    setTimeout(() => setScanState('done'), 3000)
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <>
      <div className="pt-16 pb-8 px-3 md:px-6 min-h-screen">
        <div className="max-w-[1400px] mx-auto">

          {/* ── HEADER BAR ─────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#F40000] animate-pulse glow-red" />
                <h1 className="text-lg font-bold text-white">SECURITY_DASHBOARD</h1>
              </div>
              <p className="text-[10px] text-[#6b6271]">
                {scanState === 'done'
                  ? 'Last scan: just now | 247 files analyzed in 4.2s'
                  : 'Upload files or paste a repo URL to begin scanning'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="btn-ghost !py-1.5 !px-4 !text-[10px]">❯ ~/home</Link>
              <Link to="/details" className="btn-ghost !py-1.5 !px-4 !text-[10px]">❯ ~/details</Link>
              <button
                onClick={() => { setScanState('idle'); setUploadedFiles([]); setRepoUrl(''); setFixApplied({}); }}
                className="btn-ghost !py-1.5 !px-4 !text-[10px]"
              >❯ NEW_SCAN</button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════ */}
          {/* UPLOAD / INPUT SECTION                                  */}
          {/* ════════════════════════════════════════════════════════ */}
          <div className="terminal mb-5">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">target-input — upload files or paste repo</span>
              {scanState === 'scanning' && (
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />
                  <span className="text-[9px] text-[#F40000] font-bold tracking-wider">SCANNING</span>
                </div>
              )}
              {scanState === 'done' && (
                <span className="ml-auto text-[9px] text-[#00ff41] font-bold">[COMPLETE]</span>
              )}
            </div>
            <div className="p-4 text-xs space-y-4">
              {/* Repo URL input */}
              <div>
                <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-2">❯ OPTION 1: REPOSITORY URL</p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center border border-[#F40000]/15 rounded bg-[#0d0c0e] overflow-hidden focus-within:border-[#F40000]/40 transition-all">
                    <span className="text-[#F40000] px-3 text-[10px] shrink-0">git clone</span>
                    <input
                      type="text"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      className="flex-1 bg-transparent text-white text-[11px] py-2.5 px-2 outline-none placeholder:text-[#6b6271]/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#F40000]/10" />
                <span className="text-[#6b6271] text-[9px] tracking-widest">OR</span>
                <div className="flex-1 h-px bg-[#F40000]/10" />
              </div>

              {/* File upload area */}
              <div>
                <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-2">❯ OPTION 2: UPLOAD FILES</p>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-[#F40000] bg-[#F40000]/5'
                      : 'border-[#F40000]/15 hover:border-[#F40000]/30 hover:bg-[#F40000]/3'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <p className="text-[#F40000] text-lg mb-1">⬆</p>
                  <p className="text-[#6b6271] text-[11px]">
                    <span className="text-[#F44E3F] font-bold">Click to browse</span> or drag & drop files here
                  </p>
                  <p className="text-[#6b6271]/50 text-[9px] mt-1">
                    Supports: .js .py .ts .tf .json .yaml .jsx .tsx .env .cfg .toml
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".js,.py,.ts,.jsx,.tsx,.tf,.json,.yaml,.yml,.env,.cfg,.toml,.html,.css"
                  />
                </div>
              </div>

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div>
                  <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-2">
                    QUEUED FILES ({uploadedFiles.length}):
                  </p>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border border-[#F40000]/10 bg-[#0d0c0e]">
                        <span className="text-[#F40000] text-[10px]">📄</span>
                        <span className="text-white text-[10px] flex-1 truncate font-mono">{f.name}</span>
                        <span className="text-[#6b6271] text-[9px]">{formatSize(f.size)}</span>
                        <span className="text-[#6b6271] text-[8px] px-1 py-0.5 rounded border border-[#F40000]/10 uppercase">{f.type}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(i) }} className="text-[#F40000] text-[10px] hover:text-white transition-colors px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scan config + button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px]">
                  <label className="flex items-center gap-1.5 text-[#6b6271] cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#F40000] w-3 h-3" />
                    Code Scan
                  </label>
                  <label className="flex items-center gap-1.5 text-[#6b6271] cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#F40000] w-3 h-3" />
                    Cloud Config
                  </label>
                  <label className="flex items-center gap-1.5 text-[#6b6271] cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#F40000] w-3 h-3" />
                    IAM Policies
                  </label>
                  <label className="flex items-center gap-1.5 text-[#6b6271] cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#F40000] w-3 h-3" />
                    AI Auto-Fix
                  </label>
                </div>
                <button
                  onClick={startScan}
                  disabled={scanState === 'scanning' || (!repoUrl && uploadedFiles.length === 0)}
                  className={`btn-red !py-2.5 !px-8 !text-[10px] shrink-0 ${
                    scanState === 'scanning' ? 'opacity-50 cursor-wait' : ''
                  } ${(!repoUrl && uploadedFiles.length === 0) ? '!opacity-30 !cursor-not-allowed' : ''}`}
                >
                  {scanState === 'scanning' ? '⏳ SCANNING...' : '❯ RUN_SCAN'}
                </button>
              </div>

              {/* Scanning animation */}
              {scanState === 'scanning' && (
                <div className="space-y-2 border border-[#F40000]/10 rounded p-3 bg-[#0d0c0e]">
                  <p className="text-[#6b6271]">❯ ai-sec scan --deep --target=uploaded</p>
                  {['Cloning repository...', 'Indexing 247 files...', 'Running Semgrep code analysis...', 'Scanning cloud configurations...'].map((line, i) => (
                    <p key={i} className="text-[#F4998D] animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}>{line}</p>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-[#1a181c] rounded overflow-hidden">
                      <div className="h-full rounded animate-[scan_3s_ease-in-out_infinite]"
                        style={{ background: 'linear-gradient(90deg, #F40000, #F44E3F)', width: '60%' }} />
                    </div>
                    <span className="text-[#F40000] text-[9px] font-bold">ANALYZING</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════ */}
          {/* RESULTS — only show after scan completes                */}
          {/* ════════════════════════════════════════════════════════ */}
          {scanState === 'done' && (
            <>
              {/* ── STATS ROW ──────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
                {[
                  { label: 'TOTAL', value: counts.total, color: '#F40000' },
                  { label: 'CRITICAL', value: counts.crit, color: '#F40000' },
                  { label: 'HIGH', value: counts.high, color: '#F44E3F' },
                  { label: 'MEDIUM', value: counts.med, color: '#F4998D' },
                  { label: 'CODE', value: counts.code, color: '#F44E3F' },
                  { label: 'CLOUD', value: counts.cloud, color: '#F4998D' },
                  { label: 'IAM', value: counts.iam, color: '#F40000' },
                ].map((s, i) => (
                  <div key={i} className="terminal !rounded-md">
                    <div className="px-3 py-2.5 text-center">
                      <p className="text-lg font-bold" style={{ color: s.color, textShadow: `0 0 10px ${s.color}30` }}>{s.value}</p>
                      <p className="text-[8px] text-[#6b6271] tracking-widest font-bold">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── SCAN PROGRESS ──────────────────────────────────── */}
              <div className="terminal !rounded-md mb-5">
                <div className="px-4 py-2.5 text-xs flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="text-[#6b6271]">❯ scan-status:</span>
                  {['Code Analysis', 'Cloud Config', 'IAM Policies', 'AI Analysis'].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[#00ff41]">✓</span>
                      <span className="text-[#6b6271]">{step}</span>
                      <span className="text-[#00ff41] text-[10px]">DONE</span>
                    </div>
                  ))}
                  <span className="text-[#6b6271] ml-auto text-[10px]">
                    {repoUrl ? repoUrl.split('/').pop()?.replace('.git', '') : `${uploadedFiles.length} files`} | 247 files in 4.2s
                  </span>
                </div>
              </div>

              {/* ── PROJECT DETAILS ────────────────────────────────── */}
              <div className="terminal !rounded-md mb-5">
                <div className="terminal-bar">
                  <div className="terminal-dot bg-[#F40000]" />
                  <div className="terminal-dot bg-[#F4998D]/40" />
                  <div className="terminal-dot bg-[#6b6271]/30" />
                  <span className="ml-2 text-[9px] text-[#6b6271]">project-info</span>
                </div>
                <div className="p-4 text-xs">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">SOURCE</p>
                      <p className="text-white text-[10px] truncate">{repoUrl || `${uploadedFiles.length} uploaded files`}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">LANGUAGES</p>
                      <p className="text-[#F4998D] text-[10px]">JavaScript, Python, Terraform</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">FILES ANALYZED</p>
                      <p className="text-white text-[10px]">247 files (18.4 MB)</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">SECURITY SCORE</p>
                      <p className="text-[#F40000] text-[10px] font-bold">32 / 100 — CRITICAL</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">ENGINE</p>
                      <p className="text-[#6b6271] text-[10px]">Semgrep v1.56 + Custom Rules</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">AI MODEL</p>
                      <p className="text-[#6b6271] text-[10px]">GPT-4o (847M params)</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">SCAN TIME</p>
                      <p className="text-[#6b6271] text-[10px]">4.2 seconds</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b6271] tracking-widest mb-0.5">AUTO-FIXES</p>
                      <p className="text-[#00ff41] text-[10px]">{counts.total} fixes available</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── FILTER TABS ────────────────────────────────────── */}
              <div className="flex gap-1 mb-4">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSwitch(tab.id)}
                    className={`px-4 py-2 text-[10px] font-bold tracking-wider rounded-t transition-all ${
                      activeTab === tab.id
                        ? 'bg-[#0d0c0e] text-[#F40000] border border-b-0 border-[#F40000]/20'
                        : 'text-[#6b6271] hover:text-[#F4998D] border border-transparent'
                    }`}
                  >
                    {tab.icon} {tab.label} ({VULNS.filter(v => tab.id === 'all' || v.type === tab.id).length})
                  </button>
                ))}
              </div>

              {/* ── MAIN GRID ──────────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                {/* ── LEFT: Vulnerability List ─────────────────────── */}
                <div className="lg:col-span-4 terminal">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">threat-list — {filtered.length} results</span>
                  </div>
                  <div className="p-3 space-y-1.5 max-h-[520px] overflow-y-auto">
                    <p className="text-[9px] text-[#6b6271] mb-2 tracking-widest font-bold">❯ cat /scan/results/{activeTab}</p>
                    {filtered.map((v, i) => (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVuln(i)}
                        className={`flex items-start gap-2.5 p-2.5 rounded cursor-pointer transition-all duration-200 text-xs ${
                          i === selectedVuln
                            ? 'bg-[#F40000]/8 border border-[#F40000]/25'
                            : 'border border-transparent hover:bg-[#F40000]/3 hover:border-[#F40000]/10'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: v.color, boxShadow: `0 0 5px ${v.color}` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[11px] font-medium truncate">{v.title}</p>
                          <p className="text-[#6b6271] text-[9px] font-mono mt-0.5">{v.id} — {v.file}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded font-mono tracking-wider"
                            style={{ color: v.color, border: `1px solid ${v.color}30` }}>{v.sev}</span>
                          <span className="text-[8px] text-[#6b6271] uppercase">{v.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── CENTER: AI Analysis ──────────────────────────── */}
                <div className="lg:col-span-4 terminal">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">ai-analysis</span>
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse" />
                      <span className="text-[8px] text-[#F40000] font-bold">AI</span>
                    </div>
                  </div>
                  <div className="p-4 text-xs space-y-3 max-h-[520px] overflow-y-auto">
                    <p className="text-[9px] text-[#6b6271] tracking-widest font-bold">❯ ai-explain {current.id}</p>

                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full glow-red" style={{ backgroundColor: current.color }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: current.color }}>
                        {current.sev === 'CRIT' ? 'CRITICAL' : current.sev === 'HIGH' ? 'HIGH RISK' : 'MEDIUM RISK'} THREAT
                      </span>
                    </div>

                    <p className="text-white font-bold text-sm">{current.title}</p>
                    <p className="text-[#6b6271] text-[10px] font-mono">{current.file}</p>

                    <div className="flex gap-2">
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded border border-[#F40000]/20 text-[#F40000] uppercase tracking-widest">{current.type}</span>
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded border border-[#F40000]/20 text-[#F4998D]">{current.id}</span>
                    </div>

                    <div className="h-px bg-[#F40000]/10" />

                    <div>
                      <p className="text-[9px] text-[#F40000] font-bold tracking-wider mb-2">🧠 AI EXPLANATION:</p>
                      <p className="text-[#c8c0d0] leading-relaxed text-[11px]">{current.explain}</p>
                    </div>

                    <div className="h-px bg-[#F40000]/10" />

                    <div>
                      <p className="text-[9px] text-[#F40000] font-bold tracking-wider mb-2">⚠ VULNERABLE CODE:</p>
                      <div className="p-3 rounded bg-[#F40000]/5 border border-[#F40000]/15 font-mono text-[10px]">
                        {current.code.split('\n').map((line, j) => (
                          <p key={j} className="text-[#F4998D]">{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Auto-Fix ──────────────────────────────── */}
                <div className="lg:col-span-4 terminal">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">auto-fix-engine</span>
                    <span className="ml-auto text-[9px] text-[#00ff41] font-bold">[READY]</span>
                  </div>
                  <div className="p-4 text-xs space-y-3 max-h-[520px] overflow-y-auto">
                    <p className="text-[9px] text-[#6b6271] tracking-widest font-bold">❯ ai-fix --generate {current.id}</p>

                    <p className="text-[#6b6271]">Processing AI remediation...</p>

                    {fixApplied[current.id] ? (
                      <div className="p-3 rounded bg-[#00ff41]/5 border border-[#00ff41]/20 text-center">
                        <p className="text-[#00ff41] font-bold text-sm">✓ FIX APPLIED</p>
                        <p className="text-[#6b6271] text-[10px] mt-1">Patch committed to branch: fix/{current.id.toLowerCase()}</p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-[9px] text-[#00ff41] font-bold tracking-wider mb-2">🛠 SUGGESTED FIX:</p>
                          <div className="p-3 rounded bg-[#00ff41]/3 border border-[#00ff41]/15 font-mono text-[10px] space-y-1">
                            <p className="text-[#6b6271]">// secure implementation</p>
                            {current.code.split('\n').map((line, j) => (
                              <p key={`old-${j}`} className="text-[#F40000]">- {line}</p>
                            ))}
                            {current.fix.split('\n').map((line, j) => (
                              <p key={`new-${j}`} className="text-[#00ff41]">+ {line}</p>
                            ))}
                          </div>
                        </div>

                        <div className="h-px bg-[#F40000]/10" />

                        <div>
                          <p className="text-[9px] text-[#6b6271] font-bold tracking-wider mb-1.5">IMPACT PREVIEW:</p>
                          <div className="space-y-1 text-[10px]">
                            <p className="text-[#00ff41]">✓ Vulnerability will be resolved</p>
                            <p className="text-[#00ff41]">✓ No breaking changes detected</p>
                            <p className="text-[#6b6271]">✓ Compatible with existing codebase</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setFixApplied(prev => ({ ...prev, [current.id]: true }))}
                            className="btn-red flex-1 !py-2 !px-3 !text-[10px]"
                          >
                            ❯ APPLY_FIX
                          </button>
                          <button className="btn-ghost flex-1 !py-2 !px-3 !text-[10px]">❯ SKIP</button>
                        </div>
                      </>
                    )}

                    <div className="h-px bg-[#F40000]/10" />

                    <div>
                      <p className="text-[9px] text-[#6b6271] font-bold tracking-wider mb-2">SESSION STATS:</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 rounded border border-[#F40000]/10 text-center">
                          <p className="text-[#F40000] font-bold text-sm">{Object.keys(fixApplied).length}</p>
                          <p className="text-[#6b6271] text-[8px]">FIXES APPLIED</p>
                        </div>
                        <div className="p-2 rounded border border-[#F40000]/10 text-center">
                          <p className="text-[#F4998D] font-bold text-sm">{VULNS.length - Object.keys(fixApplied).length}</p>
                          <p className="text-[#6b6271] text-[8px]">REMAINING</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── BOTTOM PANELS ──────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {/* Code Scanner */}
                <div className="terminal">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">code-scanner</span>
                    <span className="ml-auto text-[9px] text-[#F40000] font-bold">[{counts.code} THREATS]</span>
                  </div>
                  <div className="p-4 text-xs space-y-2">
                    <p className="text-[#6b6271]">❯ scan --type=code --summary</p>
                    <div className="h-px bg-[#F40000]/10" />
                    <p className="text-[#F4998D]">  → SQL Injection: 1 found</p>
                    <p className="text-[#F4998D]">  → XSS: 1 found</p>
                    <p className="text-[#F4998D]">  → Hardcoded Secrets: 1 found</p>
                    <div className="h-px bg-[#F40000]/10" />
                    <div className="flex items-center justify-between">
                      <span className="text-[#6b6271]">Files scanned:</span>
                      <span className="text-white">142</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#6b6271]">Engine:</span>
                      <span className="text-[#F4998D]">Semgrep + Custom</span>
                    </div>
                  </div>
                </div>

                {/* Cloud Config */}
                <div className="terminal">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">cloud-scanner</span>
                    <span className="ml-auto text-[9px] text-[#F44E3F] font-bold">[{counts.cloud} THREATS]</span>
                  </div>
                  <div className="p-4 text-xs space-y-2">
                    <p className="text-[#6b6271]">❯ scan --type=cloud --summary</p>
                    <div className="h-px bg-[#F40000]/10" />
                    <p className="text-[#F4998D]">  → Public S3 Bucket: 1 found</p>
                    <p className="text-[#F4998D]">  → Open Security Group: 1 found</p>
                    <p className="text-[#F4998D]">  → Unencrypted Storage: 1 found</p>
                    <div className="h-px bg-[#F40000]/10" />
                    <div className="flex items-center justify-between">
                      <span className="text-[#6b6271]">Configs scanned:</span>
                      <span className="text-white">67</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#6b6271]">Formats:</span>
                      <span className="text-[#F4998D]">Terraform, JSON, YAML</span>
                    </div>
                  </div>
                </div>

                {/* IAM */}
                <div className="terminal">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">iam-analyzer</span>
                    <span className="ml-auto text-[9px] text-[#F40000] font-bold">[{counts.iam} THREATS]</span>
                  </div>
                  <div className="p-4 text-xs space-y-2">
                    <p className="text-[#6b6271]">❯ scan --type=iam --summary</p>
                    <div className="h-px bg-[#F40000]/10" />
                    <p className="text-[#F4998D]">  → Wildcard Actions: 1 found</p>
                    <p className="text-[#F4998D]">  → Open Trust Policy: 1 found</p>
                    <p className="text-[#F4998D]">  → Missing MFA: 1 found</p>
                    <div className="h-px bg-[#F40000]/10" />
                    <div className="flex items-center justify-between">
                      <span className="text-[#6b6271]">Policies scanned:</span>
                      <span className="text-white">38</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#6b6271]">Engine:</span>
                      <span className="text-[#F4998D]">IAM Access Analyzer</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ACTIVITY LOG ───────────────────────────────────── */}
              <div className="terminal mt-4">
                <div className="terminal-bar">
                  <div className="terminal-dot bg-[#F40000]" />
                  <div className="terminal-dot bg-[#F4998D]/40" />
                  <div className="terminal-dot bg-[#6b6271]/30" />
                  <span className="ml-2 text-[9px] text-[#6b6271]">activity-log — latest events</span>
                </div>
                <div className="p-4 text-[10px] space-y-1.5 font-mono max-h-[150px] overflow-y-auto">
                  <p><span className="text-[#6b6271]">[19:00:12]</span> <span className="text-[#00ff41]">SCAN</span> Full project scan completed in 4.2s</p>
                  <p><span className="text-[#6b6271]">[19:00:12]</span> <span className="text-[#F40000]">ALERT</span> {counts.crit} critical vulnerabilities detected</p>
                  <p><span className="text-[#6b6271]">[19:00:11]</span> <span className="text-[#F44E3F]">WARN</span> {counts.high} high-risk issues found</p>
                  <p><span className="text-[#6b6271]">[19:00:10]</span> <span className="text-[#F4998D]">INFO</span> {counts.med} medium-risk findings</p>
                  <p><span className="text-[#6b6271]">[19:00:09]</span> <span className="text-[#00ff41]">AI</span> Fix suggestions generated for {counts.total} threats</p>
                  <p><span className="text-[#6b6271]">[19:00:08]</span> <span className="text-[#6b6271]">SYS</span> AI engine loaded (GPT-4o, 847M params)</p>
                  <p><span className="text-[#6b6271]">[19:00:05]</span> <span className="text-[#6b6271]">SYS</span> Connected to Semgrep engine v1.56.0</p>
                  <p><span className="text-[#6b6271]">[19:00:02]</span> <span className="text-[#6b6271]">SYS</span> Source: {repoUrl || `${uploadedFiles.length} uploaded files`}</p>
                  <p><span className="text-[#6b6271]">[19:00:01]</span> <span className="text-[#6b6271]">SYS</span> Scan initiated by user@dashboard</p>
                  <p><span className="text-[#6b6271]">[19:00:00]</span> <span className="text-[#00ff41]">SYS</span> Session started</p>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
      <Footer />
    </>
  )
}

export default DashboardPage
