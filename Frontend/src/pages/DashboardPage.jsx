import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import { applyFixToCodebase, runScan, submitFixFeedback } from '../services/api'

// ── SEVERITY HELPERS ──────────────────────────────────────────────
const SEV_META = {
  critical: { label: 'CRIT', color: '#F40000', order: 4 },
  high:     { label: 'HIGH', color: '#F44E3F', order: 3 },
  medium:   { label: 'MED',  color: '#F4998D', order: 2 },
  low:      { label: 'LOW',  color: '#6b6271', order: 1 },
}
const sev = (s) => SEV_META[String(s || 'low').toLowerCase()] || SEV_META.low

const BAND_COLORS = {
  critical: '#F40000',
  high: '#F44E3F',
  moderate: '#F4998D',
  low: '#00ff41',
}

const TABS = [
  { id: 'all', label: 'ALL', icon: '◉' },
  { id: 'code', label: 'CODE', icon: '⌨' },
  { id: 'cloud', label: 'CLOUD', icon: '☁' },
  { id: 'iam', label: 'IAM', icon: '🔐' },
]

const inferType = (title = '') => {
  const t = title.toLowerCase()
  if (/iam|wildcard|principal|mfa|role|trust|policy|permission/.test(t)) return 'iam'
  if (/s3|bucket|security.?group|rds|vpc|subnet|cloudfront|open.?network|0\.0\.0\.0/.test(t)) return 'cloud'
  return 'code'
}

const normalizeFixText = (value = '') =>
  String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

const getAiProblemText = (vuln = {}) => String(vuln.explanation || vuln.title || '').trim()

const getAiSolutionText = (vuln = {}) => {
  if (String(vuln.fix || '').trim()) {
    return String(vuln.fix).trim()
  }

  const learned = (vuln.learningHints || []).find((hint) => String(hint?.fix || '').trim())
  return learned ? String(learned.fix).trim() : ''
}

const toSingleLinePreview = (value = '', maxLength = 88) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`
}

const buildFixOptions = (vuln = {}) => {
  const rawOptions = []

  if (vuln.fix) {
    rawOptions.push({
      title: 'AI Suggested Fix',
      source: 'ai',
      fix: vuln.fix,
    })
  }

  for (const hint of vuln.learningHints || []) {
    if (!hint?.fix) continue
    rawOptions.push({
      title: `Learned Fix: ${hint.vulnerability || 'Prior Pattern'}`,
      source: hint.source || 'learned',
      fix: hint.fix,
    })
  }

  const seen = new Set()
  const deduped = []
  for (const option of rawOptions) {
    const key = normalizeFixText(option.fix)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push({
      id: `fix-option-${deduped.length + 1}`,
      ...option,
    })
  }

  return deduped
}

const sanitizeFileNamePart = (value = '') =>
  String(value || 'fix')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'fix'

const downloadAppliedFixFile = ({ vuln, selectedOption }) => {
  const sourcePath = String(vuln?.file || 'target-file')
  const sourceName = sourcePath.split(/[\\/]/).pop() || 'target-file'
  const baseName = sourceName.includes('.') ? sourceName.slice(0, sourceName.lastIndexOf('.')) : sourceName
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${sanitizeFileNamePart(baseName)}.applied-fix.${timestamp}.txt`

  const content = [
    'SecSphere Applied Fix Export',
    '===========================',
    `Generated At: ${new Date().toISOString()}`,
    `Vulnerability: ${vuln?.title || 'unknown'}`,
    `Severity: ${String(vuln?.severity || 'unknown').toUpperCase()}`,
    `File: ${sourcePath}`,
    `Line: ${vuln?.line || 'n/a'}`,
    `Fix Option: ${selectedOption?.title || 'selected-option'}`,
    `Source: ${selectedOption?.source || 'unknown'}`,
    '',
    'Selected Remediation:',
    '---------------------',
    String(selectedOption?.fix || '').trim(),
    '',
    'Note: This is a generated remediation file. Apply the changes to your source file and validate with tests/security scan.',
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)

  return fileName
}

const createFixChooserInitial = () => ({
  open: false,
  vuln: null,
  options: [],
  selected: 0,
  applying: false,
  error: '',
})

// ── COMPONENT ─────────────────────────────────────────────────────
const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedVuln, setSelectedVuln] = useState(0)
  const [fixApplied, setFixApplied] = useState({})
  const [appliedFixChoice, setAppliedFixChoice] = useState({})
  const [fixChooser, setFixChooser] = useState(createFixChooserInitial())

  // Upload state
  const [repoUrl, setRepoUrl] = useState('')
  const [projectType, setProjectType] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [scanState, setScanState] = useState('idle') // idle | scanning | done | error
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // API result state
  const [scanData, setScanData] = useState(null)
  const [scanError, setScanError] = useState('')
  const [scanTime, setScanTime] = useState(0)

  // Scan history
  const [history, setHistory] = useState([])

  // Derive vulnerability list from API data
  const results = scanData?.results || []
  const vulns = results.map((r, i) => ({
    id: `VULN-${String(i + 1).padStart(3, '0')}`,
    title: r.title,
    severity: r.severity,
    file: r.file || 'unknown',
    line: r.line,
    explanation: r.explanation,
    fix: r.fix,
    learningHints: r.learningHints || [],
    type: inferType(r.title),
    ...sev(r.severity),
  }))

  const filtered = activeTab === 'all' ? vulns : vulns.filter(v => v.type === activeTab)
  const current = filtered[selectedVuln] || filtered[0]
  const currentFixOptions = current ? buildFixOptions(current) : []

  const counts = {
    total: vulns.length,
    crit: vulns.filter(v => v.label === 'CRIT').length,
    high: vulns.filter(v => v.label === 'HIGH').length,
    med: vulns.filter(v => v.label === 'MED').length,
    low: vulns.filter(v => v.label === 'LOW').length,
    code: vulns.filter(v => v.type === 'code').length,
    cloud: vulns.filter(v => v.type === 'cloud').length,
    iam: vulns.filter(v => v.type === 'iam').length,
  }

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    setSelectedVuln(0)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) setUploadedFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setUploadedFile(file)
  }

  const removeFile = () => setUploadedFile(null)

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const startScan = async () => {
    if (!repoUrl && !uploadedFile) return
    setScanState('scanning')
    setScanError('')
    setScanData(null)
    setFixApplied({})
    setAppliedFixChoice({})
    setFixChooser(createFixChooserInitial())
    setSelectedVuln(0)
    setActiveTab('all')

    const t0 = Date.now()
    try {
      const data = await runScan({
        file: uploadedFile || undefined,
        repoUrl: repoUrl || undefined,
        projectType: projectType || undefined,
      })
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      setScanTime(elapsed)
      setScanData(data)
      setScanState('done')

      // Add to history
      setHistory(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        source: repoUrl || uploadedFile?.name || 'unknown',
        issueCount: data.results?.length || 0,
        score: data.score,
        riskBand: data.riskBand,
      }, ...prev].slice(0, 10))
    } catch (err) {
      setScanState('error')
      setScanError(err.message || 'Scan failed')
      setScanTime(((Date.now() - t0) / 1000).toFixed(1))
    }
  }

  const openFixChooser = (vuln) => {
    if (!vuln) return
    const options = buildFixOptions(vuln)
    if (!options.length) return

    setFixChooser({
      open: true,
      vuln,
      options,
      selected: 0,
      applying: false,
      error: '',
    })
  }

  const closeFixChooser = () => {
    if (fixChooser.applying) return
    setFixChooser(createFixChooserInitial())
  }

  const applySelectedFix = async () => {
    const vuln = fixChooser.vuln
    const selectedOption = fixChooser.options[fixChooser.selected]
    if (!vuln || !selectedOption) return

    setFixChooser(prev => ({ ...prev, applying: true, error: '' }))

    try {
      const applied = await applyFixToCodebase({
        vulnerability: vuln.title,
        fix: selectedOption.fix,
        file: vuln.file,
      })

      await submitFixFeedback({
        vulnerability: vuln.title,
        fix: selectedOption.fix,
        projectType: scanData?.projectContext?.domain,
        file: vuln.file,
        notes: `Selected fix option: ${selectedOption.title}`,
      })

      const downloadedFileName = downloadAppliedFixFile({
        vuln,
        selectedOption,
      })

      setFixApplied(prev => ({ ...prev, [vuln.id]: true }))
      setAppliedFixChoice(prev => ({
        ...prev,
        [vuln.id]: {
          title: selectedOption.title,
          source: selectedOption.source,
          fix: selectedOption.fix,
          updatedFile: applied?.file,
          backupFile: applied?.backupFile,
          applyStrategy: applied?.strategy,
          downloadedFileName,
        },
      }))
      setFixChooser(createFixChooserInitial())
    } catch (err) {
      setFixChooser(prev => ({
        ...prev,
        applying: false,
        error: err?.message || 'Unable to apply the selected fix. Please try again.',
      }))
    }
  }

  const score = scanData?.score ?? 0
  const predictedScore = scanData?.predictedScore ?? 0
  const riskBand = scanData?.riskBand || 'low'
  const bandColor = BAND_COLORS[riskBand] || '#6b6271'
  const summary = scanData?.summary || ''
  const bestPractices = scanData?.bestPractices || []
  const projectContext = scanData?.projectContext || {}

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
                  ? `Last scan: just now | ${vulns.length} issues found in ${scanTime}s`
                  : scanState === 'error'
                  ? `Scan failed after ${scanTime}s`
                  : 'Upload files or paste a repo URL to begin scanning'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="btn-ghost !py-1.5 !px-4 !text-[10px]">❯ ~/home</Link>
              <Link to="/details" className="btn-ghost !py-1.5 !px-4 !text-[10px]">❯ ~/details</Link>
              <button
                onClick={() => {
                  setScanState('idle')
                  setUploadedFile(null)
                  setRepoUrl('')
                  setProjectType('')
                  setFixApplied({})
                  setAppliedFixChoice({})
                  setFixChooser(createFixChooserInitial())
                  setScanData(null)
                  setScanError('')
                }}
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
              {scanState === 'error' && (
                <span className="ml-auto text-[9px] text-[#F40000] font-bold">[ERROR]</span>
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
                      placeholder="https://github.com/user/repo"
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
                <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-2">❯ OPTION 2: UPLOAD FILE (single file or ZIP)</p>
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
                    <span className="text-[#F44E3F] font-bold">Click to browse</span> or drag & drop a file
                  </p>
                  <p className="text-[#6b6271]/50 text-[9px] mt-1">
                    Supports: .js .ts .jsx .tsx .json .yaml .yml .env .tf .zip
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".js,.ts,.jsx,.tsx,.tf,.json,.yaml,.yml,.env,.zip,.txt,.md,.ini,.conf"
                  />
                </div>
              </div>

              {/* Uploaded file */}
              {uploadedFile && (
                <div>
                  <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-2">SELECTED FILE:</p>
                  <div className="flex items-center gap-2 p-2 rounded border border-[#F40000]/10 bg-[#0d0c0e]">
                    <span className="text-[#F40000] text-[10px]">📄</span>
                    <span className="text-white text-[10px] flex-1 truncate font-mono">{uploadedFile.name}</span>
                    <span className="text-[#6b6271] text-[9px]">{formatSize(uploadedFile.size)}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeFile() }} className="text-[#F40000] text-[10px] hover:text-white transition-colors px-1">✕</button>
                  </div>
                </div>
              )}

              {/* Project type + scan button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div className="flex-1">
                  <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-1.5">PROJECT TYPE (optional)</p>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="bg-[#0d0c0e] border border-[#F40000]/15 rounded text-white text-[10px] py-2 px-3 w-full outline-none focus:border-[#F40000]/40 font-mono"
                  >
                    <option value="">Auto-detect</option>
                    <option value="banking">Banking / Fintech</option>
                    <option value="e-commerce">E-commerce</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="saas">SaaS</option>
                  </select>
                </div>
                <button
                  onClick={startScan}
                  disabled={scanState === 'scanning' || (!repoUrl && !uploadedFile)}
                  className={`btn-red !py-2.5 !px-8 !text-[10px] shrink-0 ${
                    scanState === 'scanning' ? 'opacity-50 cursor-wait' : ''
                  } ${(!repoUrl && !uploadedFile) ? '!opacity-30 !cursor-not-allowed' : ''}`}
                >
                  {scanState === 'scanning' ? '⏳ SCANNING...' : '❯ RUN_SCAN'}
                </button>
              </div>

              {/* Scanning animation */}
              {scanState === 'scanning' && (
                <div className="space-y-2 border border-[#F40000]/10 rounded p-3 bg-[#0d0c0e]">
                  <p className="text-[#6b6271]">❯ ai-sec scan --deep --target={repoUrl ? 'repo' : 'uploaded'}</p>
                  {[
                    repoUrl ? 'Cloning repository...' : 'Processing uploaded file...',
                    'Running Semgrep code analysis...',
                    'Scanning cloud configurations & IAM policies...',
                    'AI generating explanations & fixes...',
                  ].map((line, i) => (
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

              {/* Error state */}
              {scanState === 'error' && (
                <div className="border border-[#F40000]/30 rounded p-4 bg-[#F40000]/5 space-y-2">
                  <p className="text-[#F40000] font-bold text-[11px]">⚠ SCAN FAILED</p>
                  <p className="text-[#F4998D] text-[10px] font-mono">{scanError}</p>
                  <button onClick={startScan} className="btn-ghost !py-1.5 !px-4 !text-[9px]">❯ RETRY</button>
                </div>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════ */}
          {/* RESULTS — only shown after scan completes               */}
          {/* ════════════════════════════════════════════════════════ */}
          {scanState === 'done' && (
            <>
              {/* ── HERO ANALYTICS ─────────────────────────────────── */}
              {/* Top row: Radial gauges + project context */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">

                {/* ── Score Radial Gauge ──────────── */}
                <div className="md:col-span-4 terminal !rounded-md overflow-hidden" style={{ background: 'linear-gradient(180deg, #0d0c0e 0%, #0a090b 100%)' }}>
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">security-score</span>
                    <span className="ml-auto text-[8px] text-[#6b6271]">rule-engine</span>
                  </div>
                  <div className="p-5 flex flex-col items-center">
                    <div className="relative w-36 h-36">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        {/* Background arc */}
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#1a181c" strokeWidth="8" />
                        {/* Score arc */}
                        <circle cx="60" cy="60" r="52" fill="none"
                          stroke={bandColor}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${score * 3.267} ${326.7 - score * 3.267}`}
                          style={{
                            filter: `drop-shadow(0 0 6px ${bandColor}60)`,
                            transition: 'stroke-dasharray 1.5s ease-out',
                          }}
                        />
                        {/* Glow ring */}
                        <circle cx="60" cy="60" r="52" fill="none"
                          stroke={bandColor}
                          strokeWidth="2"
                          opacity="0.15"
                          strokeDasharray={`${score * 3.267} ${326.7 - score * 3.267}`}
                          style={{ filter: `blur(3px)`, transition: 'stroke-dasharray 1.5s ease-out' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold" style={{ color: bandColor, textShadow: `0 0 20px ${bandColor}50` }}>{score}</span>
                        <span className="text-[9px] text-[#6b6271] tracking-widest">/100</span>
                      </div>
                    </div>
                    <p className="text-[8px] text-[#6b6271] tracking-[0.2em] font-bold mt-3 uppercase">Rule-Based Score</p>
                  </div>
                </div>

                {/* ── Predicted Risk Radial Gauge ── */}
                <div className="md:col-span-4 terminal !rounded-md overflow-hidden" style={{ background: 'linear-gradient(180deg, #0d0c0e 0%, #0a090b 100%)' }}>
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">risk-prediction</span>
                    <span className="ml-auto text-[8px] text-[#6b6271]">{scanData?.riskModel || 'linear-risk-v1'}</span>
                  </div>
                  <div className="p-5 flex flex-col items-center">
                    <div className="relative w-36 h-36">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#1a181c" strokeWidth="8" />
                        <circle cx="60" cy="60" r="52" fill="none"
                          stroke={bandColor}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${predictedScore * 3.267} ${326.7 - predictedScore * 3.267}`}
                          style={{
                            filter: `drop-shadow(0 0 6px ${bandColor}60)`,
                            transition: 'stroke-dasharray 1.5s ease-out',
                          }}
                        />
                        <circle cx="60" cy="60" r="52" fill="none"
                          stroke={bandColor}
                          strokeWidth="2"
                          opacity="0.15"
                          strokeDasharray={`${predictedScore * 3.267} ${326.7 - predictedScore * 3.267}`}
                          style={{ filter: `blur(3px)`, transition: 'stroke-dasharray 1.5s ease-out' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold" style={{ color: bandColor, textShadow: `0 0 20px ${bandColor}50` }}>{predictedScore}</span>
                        <span className="text-[9px] text-[#6b6271] tracking-widest">/100</span>
                      </div>
                    </div>
                    <span className="inline-block text-[9px] font-bold px-4 py-1 rounded-full uppercase tracking-widest mt-3"
                      style={{
                        color: bandColor,
                        border: `1px solid ${bandColor}40`,
                        background: `${bandColor}10`,
                        boxShadow: `0 0 15px ${bandColor}15, inset 0 0 15px ${bandColor}05`,
                      }}>
                      {riskBand} RISK
                    </span>
                  </div>
                </div>

                {/* ── Project Context Card ─────── */}
                <div className="md:col-span-4 terminal !rounded-md overflow-hidden" style={{ background: 'linear-gradient(180deg, #0d0c0e 0%, #0a090b 100%)' }}>
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">project-context</span>
                  </div>
                  <div className="p-5 text-xs space-y-3">
                    {/* Domain badge */}
                    <div className="text-center">
                      <span className="inline-block text-sm font-bold px-4 py-1.5 rounded uppercase tracking-widest text-white"
                        style={{ background: 'linear-gradient(135deg, #F40000 0%, #F44E3F 100%)', boxShadow: '0 0 20px rgba(244,0,0,0.2)' }}>
                        {projectContext.domain || 'generic'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#6b6271] text-[9px] tracking-wider">IMPACT LEVEL</span>
                          <span className="font-bold uppercase text-[10px]"
                            style={{ color: projectContext.impact === 'high' ? '#F40000' : '#F4998D' }}>
                            {projectContext.impact || 'medium'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#1a181c] rounded overflow-hidden">
                          <div className="h-full rounded transition-all duration-700"
                            style={{
                              width: projectContext.impact === 'high' ? '100%' : projectContext.impact === 'low' ? '33%' : '66%',
                              background: projectContext.impact === 'high'
                                ? 'linear-gradient(90deg, #F40000, #F44E3F)'
                                : 'linear-gradient(90deg, #F4998D, #F4998D88)',
                              boxShadow: projectContext.impact === 'high' ? '0 0 8px rgba(244,0,0,0.3)' : 'none',
                            }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#6b6271] text-[9px] tracking-wider">AI CONFIDENCE</span>
                          <span className="text-white font-bold text-[10px]">{Math.round((projectContext.confidence || 0) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#1a181c] rounded overflow-hidden">
                          <div className="h-full rounded transition-all duration-700"
                            style={{
                              width: `${Math.round((projectContext.confidence || 0) * 100)}%`,
                              background: 'linear-gradient(90deg, #00ff41, #00ff4188)',
                              boxShadow: '0 0 8px rgba(0,255,65,0.2)',
                            }} />
                        </div>
                      </div>
                    </div>

                    {projectContext.rationale && (
                      <p className="text-[9px] text-[#6b6271] italic border-t border-[#F40000]/10 pt-2">{projectContext.rationale}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── AI SUMMARY ──────────────────────────────────────── */}
              <div className="terminal !rounded-md mb-5" style={{ background: 'linear-gradient(135deg, #0d0c0e 0%, #100e12 50%, #0d0c0e 100%)' }}>
                <div className="terminal-bar">
                  <div className="terminal-dot bg-[#F40000]" />
                  <div className="terminal-dot bg-[#F4998D]/40" />
                  <div className="terminal-dot bg-[#6b6271]/30" />
                  <span className="ml-2 text-[9px] text-[#6b6271]">ai-summary</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse" style={{ boxShadow: '0 0 6px #F40000' }} />
                    <span className="text-[8px] text-[#F40000] font-bold tracking-wider">AI ENGINE</span>
                  </div>
                </div>
                <div className="p-4 text-xs">
                  <p className="text-[9px] text-[#F40000] tracking-widest font-bold mb-2">❯ EXECUTIVE SUMMARY</p>
                  <p className="text-[#c8c0d0] leading-relaxed text-[11px]" style={{ borderLeft: '2px solid #F4000030', paddingLeft: '12px' }}>{summary}</p>
                </div>
              </div>

              {/* ── THREAT DISTRIBUTION ─────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                {/* Severity bars */}
                <div className="terminal !rounded-md" style={{ background: 'linear-gradient(180deg, #0d0c0e 0%, #0a090b 100%)' }}>
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">severity-distribution</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { label: 'CRITICAL', count: counts.crit, color: '#F40000', gradient: 'linear-gradient(90deg, #F40000, #F44E3F)' },
                      { label: 'HIGH', count: counts.high, color: '#F44E3F', gradient: 'linear-gradient(90deg, #F44E3F, #F4998D)' },
                      { label: 'MEDIUM', count: counts.med, color: '#F4998D', gradient: 'linear-gradient(90deg, #F4998D, #F4998D88)' },
                      { label: 'LOW', count: counts.low, color: '#6b6271', gradient: 'linear-gradient(90deg, #6b6271, #6b627188)' },
                    ].map((s, i) => {
                      const maxCount = Math.max(counts.crit, counts.high, counts.med, counts.low, 1)
                      const pct = (s.count / maxCount) * 100
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color, boxShadow: s.count > 0 ? `0 0 6px ${s.color}60` : 'none' }} />
                              <span className="text-[9px] text-[#6b6271] tracking-wider font-bold">{s.label}</span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: s.count > 0 ? s.color : '#6b627150', textShadow: s.count > 0 ? `0 0 10px ${s.color}30` : 'none' }}>{s.count}</span>
                          </div>
                          <div className="h-2.5 bg-[#1a181c] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000 ease-out"
                              style={{
                                width: s.count > 0 ? `${Math.max(pct, 8)}%` : '0%',
                                background: s.gradient,
                                boxShadow: s.count > 0 ? `0 0 10px ${s.color}30, inset 0 1px 0 rgba(255,255,255,0.1)` : 'none',
                              }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="terminal !rounded-md" style={{ background: 'linear-gradient(180deg, #0d0c0e 0%, #0a090b 100%)' }}>
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">category-breakdown</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { label: 'CODE VULNERABILITIES', count: counts.code, icon: '⌨', color: '#F44E3F', gradient: 'linear-gradient(90deg, #F44E3F, #F4998D)' },
                      { label: 'CLOUD MISCONFIG', count: counts.cloud, icon: '☁', color: '#F4998D', gradient: 'linear-gradient(90deg, #F4998D, #F4998D88)' },
                      { label: 'IAM / ACCESS', count: counts.iam, icon: '🔐', color: '#F40000', gradient: 'linear-gradient(90deg, #F40000, #F44E3F)' },
                    ].map((s, i) => {
                      const pct = counts.total > 0 ? (s.count / counts.total) * 100 : 0
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{s.icon}</span>
                              <span className="text-[9px] text-[#6b6271] tracking-wider font-bold">{s.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold" style={{ color: s.count > 0 ? s.color : '#6b627150', textShadow: s.count > 0 ? `0 0 10px ${s.color}30` : 'none' }}>{s.count}</span>
                              <span className="text-[8px] text-[#6b6271]">({Math.round(pct)}%)</span>
                            </div>
                          </div>
                          <div className="h-2.5 bg-[#1a181c] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000 ease-out"
                              style={{
                                width: s.count > 0 ? `${Math.max(pct, 8)}%` : '0%',
                                background: s.gradient,
                                boxShadow: s.count > 0 ? `0 0 10px ${s.color}30, inset 0 1px 0 rgba(255,255,255,0.1)` : 'none',
                              }} />
                          </div>
                        </div>
                      )
                    })}

                    {/* Total indicator */}
                    <div className="flex items-center justify-between border-t border-[#F40000]/10 pt-3 mt-1">
                      <span className="text-[9px] text-[#6b6271] tracking-wider font-bold">TOTAL THREATS</span>
                      <span className="text-xl font-bold text-[#F40000]" style={{ textShadow: '0 0 15px rgba(244,0,0,0.3)' }}>{counts.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── QUICK METRICS ROW ───────────────────────────────── */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
                {[
                  { label: 'SCORE', value: score, suffix: '/100', color: bandColor },
                  { label: 'PREDICTED', value: predictedScore, suffix: '/100', color: bandColor },
                  { label: 'SCAN TIME', value: scanTime, suffix: 's', color: '#00ff41' },
                  { label: 'AI FIXES', value: vulns.filter(v => v.fix).length, suffix: '', color: '#00ff41' },
                  { label: 'APPLIED', value: Object.keys(fixApplied).length, suffix: `/${vulns.length}`, color: '#00ff41' },
                  { label: 'RISK', value: riskBand.toUpperCase(), suffix: '', color: bandColor, isText: true },
                ].map((m, i) => (
                  <div key={i} className="terminal !rounded-md overflow-hidden group hover:border-[#F40000]/30 transition-all duration-300"
                    style={{ background: 'linear-gradient(180deg, #0d0c0e 0%, #0a090b 100%)' }}>
                    <div className="px-3 py-3 text-center">
                      {m.isText ? (
                        <p className="text-sm font-bold tracking-wider" style={{ color: m.color, textShadow: `0 0 12px ${m.color}30` }}>{m.value}</p>
                      ) : (
                        <p className="text-lg font-bold" style={{ color: m.color, textShadow: `0 0 12px ${m.color}30` }}>
                          {m.value}<span className="text-[9px] text-[#6b6271]">{m.suffix}</span>
                        </p>
                      )}
                      <p className="text-[7px] text-[#6b6271] tracking-[0.15em] font-bold mt-0.5">{m.label}</p>
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
                      <span className="text-[#00ff41]" style={{ textShadow: '0 0 4px rgba(0,255,65,0.5)' }}>✓</span>
                      <span className="text-[#6b6271]">{step}</span>
                      <span className="text-[#00ff41] text-[10px] font-bold">DONE</span>
                    </div>
                  ))}
                  <span className="text-[#6b6271] ml-auto text-[10px]">
                    {repoUrl ? repoUrl.split('/').pop()?.replace('.git', '') : uploadedFile?.name || 'scan'} | {scanTime}s
                  </span>
                </div>
              </div>

              {/* ── NO RESULTS EMPTY STATE ────────────────────────── */}
              {vulns.length === 0 && (
                <div className="terminal !rounded-md mb-5">
                  <div className="p-8 text-center space-y-3">
                    <p className="text-[#00ff41] text-3xl">✓</p>
                    <p className="text-[#00ff41] font-bold text-sm">NO VULNERABILITIES DETECTED</p>
                    <p className="text-[#6b6271] text-[11px]">Your code appears clean. Score: {score}/100</p>
                  </div>
                </div>
              )}

              {/* ── FILTER TABS ────────────────────────────────────── */}
              {vulns.length > 0 && (
                <>
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
                        {tab.icon} {tab.label} ({vulns.filter(v => tab.id === 'all' || v.type === tab.id).length})
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
                              <p className="text-[#6b6271] text-[9px] font-mono mt-0.5">{v.file}{v.line ? `:${v.line}` : ''}</p>
                              {getAiProblemText(v) && (
                                <p className="text-[#F4998D] text-[9px] mt-1 truncate">
                                  Problem: {toSingleLinePreview(getAiProblemText(v), 92)}
                                </p>
                              )}
                              {getAiSolutionText(v) && (
                                <p className="text-[#00ff41] text-[9px] mt-0.5 truncate">
                                  Solution: {toSingleLinePreview(getAiSolutionText(v), 92)}
                                </p>
                              )}
                              {v.learningHints?.length > 0 && (
                                <span className="text-[8px] text-[#00ff41] font-bold mt-0.5 inline-block">✦ LEARNED FIX</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded font-mono tracking-wider"
                                style={{ color: v.color, border: `1px solid ${v.color}30` }}>{v.label}</span>
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
                      {current ? (
                        <div className="p-4 text-xs space-y-3 max-h-[520px] overflow-y-auto">
                          <p className="text-[9px] text-[#6b6271] tracking-widest font-bold">❯ ai-explain {current.id}</p>

                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full glow-red" style={{ backgroundColor: current.color }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: current.color }}>
                              {current.label === 'CRIT' ? 'CRITICAL' : current.label === 'HIGH' ? 'HIGH RISK' : current.label === 'MED' ? 'MEDIUM RISK' : 'LOW RISK'} THREAT
                            </span>
                          </div>

                          <p className="text-white font-bold text-sm">{current.title}</p>
                          <p className="text-[#6b6271] text-[10px] font-mono">{current.file}{current.line ? `:${current.line}` : ''}</p>

                          <div className="flex gap-2">
                            <span className="text-[8px] font-bold px-2 py-0.5 rounded border border-[#F40000]/20 text-[#F40000] uppercase tracking-widest">{current.type}</span>
                            <span className="text-[8px] font-bold px-2 py-0.5 rounded border border-[#F40000]/20 text-[#F4998D]">{current.id}</span>
                          </div>

                          <div className="h-px bg-[#F40000]/10" />

                          {getAiProblemText(current) ? (
                            <div>
                              <p className="text-[9px] text-[#F40000] font-bold tracking-wider mb-2">🧠 AI GENERATED PROBLEM:</p>
                              <p className="text-[#c8c0d0] leading-relaxed text-[11px]">{getAiProblemText(current)}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[9px] text-[#6b6271] font-bold tracking-wider mb-2">🧠 AI GENERATED PROBLEM:</p>
                              <p className="text-[#6b6271] text-[10px] italic">AI-generated problem details are not available for this issue.</p>
                            </div>
                          )}

                          {getAiSolutionText(current) ? (
                            <div>
                              <p className="text-[9px] text-[#00ff41] font-bold tracking-wider mb-2">🛠 AI GENERATED SOLUTION:</p>
                              <p className="text-[#00ff41] leading-relaxed text-[11px]">{getAiSolutionText(current)}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[9px] text-[#6b6271] font-bold tracking-wider mb-2">🛠 AI GENERATED SOLUTION:</p>
                              <p className="text-[#6b6271] text-[10px] italic">AI-generated solution is not available for this issue.</p>
                            </div>
                          )}

                          {/* Learning hints */}
                          {current.learningHints?.length > 0 && (
                            <>
                              <div className="h-px bg-[#F40000]/10" />
                              <div>
                                <p className="text-[9px] text-[#00ff41] font-bold tracking-wider mb-2">✦ LEARNED FROM PAST FIXES:</p>
                                {current.learningHints.map((hint, hi) => (
                                  <div key={hi} className="p-2 rounded border border-[#00ff41]/15 bg-[#00ff41]/3 mb-1 text-[10px]">
                                    <p className="text-[#00ff41]">{hint.vulnerability}</p>
                                    <p className="text-[#6b6271]">Source: {hint.source} • Used {hint.usageCount}x</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-[#6b6271] text-xs">No vulnerability selected</div>
                      )}
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
                      {current ? (
                        <div className="p-4 text-xs space-y-3 max-h-[520px] overflow-y-auto">
                          <p className="text-[9px] text-[#6b6271] tracking-widest font-bold">❯ ai-fix --generate {current.id}</p>

                          {fixApplied[current.id] ? (
                            <div className="p-3 rounded bg-[#00ff41]/5 border border-[#00ff41]/20 text-center">
                              <p className="text-[#00ff41] font-bold text-sm">✓ FIX APPLIED TO CODEBASE</p>
                              <p className="text-[#6b6271] text-[10px] mt-1">Source file was updated automatically and learning feedback was recorded.</p>
                              {appliedFixChoice[current.id] && (
                                <>
                                  <p className="text-[#6b6271] text-[10px] mt-1">
                                    Selected: <span className="text-[#00ff41]">{appliedFixChoice[current.id].title}</span>
                                  </p>
                                  {appliedFixChoice[current.id].updatedFile && (
                                    <p className="text-[#6b6271] text-[10px] mt-1">
                                      Updated file: <span className="text-[#00ff41]">{appliedFixChoice[current.id].updatedFile}</span>
                                    </p>
                                  )}
                                  {appliedFixChoice[current.id].backupFile && (
                                    <p className="text-[#6b6271] text-[10px] mt-1">
                                      Backup file: <span className="text-[#00ff41]">{appliedFixChoice[current.id].backupFile}</span>
                                    </p>
                                  )}
                                  {appliedFixChoice[current.id].downloadedFileName && (
                                    <p className="text-[#6b6271] text-[10px] mt-1">
                                      Downloaded: <span className="text-[#00ff41]">{appliedFixChoice[current.id].downloadedFileName}</span>
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          ) : currentFixOptions.length > 0 ? (
                            <>
                              <div>
                                <p className="text-[9px] text-[#F4998D] font-bold tracking-wider mb-2">PROBLEM (AI):</p>
                                <p className="text-[#c8c0d0] leading-relaxed text-[11px]">
                                  {getAiProblemText(current) || 'AI-generated problem details are not available for this issue.'}
                                </p>
                              </div>

                              <div className="h-px bg-[#F40000]/10" />

                              <div>
                                <p className="text-[9px] text-[#00ff41] font-bold tracking-wider mb-2">SOLUTION (AI):</p>
                                <div className="p-3 rounded bg-[#00ff41]/3 border border-[#00ff41]/15 font-mono text-[10px] space-y-1">
                                  {(String(currentFixOptions[0].fix || '').trim() || 'AI-generated fix is not available.').split('\n').map((line, j) => (
                                    <p key={j} className="text-[#00ff41]">+ {line}</p>
                                  ))}
                                </div>
                                <p className="text-[#6b6271] text-[9px] mt-2">
                                  {currentFixOptions.length} AI/learned fix options available.
                                </p>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => openFixChooser(current)}
                                  className="btn-red flex-1 !py-2 !px-3 !text-[10px]"
                                >
                                  ❯ CHOOSE_FIX
                                </button>
                                <button className="btn-ghost flex-1 !py-2 !px-3 !text-[10px]">❯ SKIP</button>
                              </div>
                            </>
                          ) : (
                            <div className="p-3 rounded border border-[#6b6271]/20 text-center">
                              <p className="text-[#6b6271] text-[10px]">No AI fix available for this issue</p>
                            </div>
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
                                <p className="text-[#F4998D] font-bold text-sm">{vulns.length - Object.keys(fixApplied).length}</p>
                                <p className="text-[#6b6271] text-[8px]">REMAINING</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-[#6b6271] text-xs">No vulnerability selected</div>
                      )}
                    </div>
                  </div>

                  {/* ── BEST PRACTICES ─────────────────────────────────── */}
                  {bestPractices.length > 0 && (
                    <div className="terminal mt-4">
                      <div className="terminal-bar">
                        <div className="terminal-dot bg-[#F40000]" />
                        <div className="terminal-dot bg-[#F4998D]/40" />
                        <div className="terminal-dot bg-[#6b6271]/30" />
                        <span className="ml-2 text-[9px] text-[#6b6271]">best-practices</span>
                        <div className="ml-auto flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41]" />
                          <span className="text-[8px] text-[#00ff41] font-bold">AI RECOMMENDATIONS</span>
                        </div>
                      </div>
                      <div className="p-4 text-xs space-y-2">
                        <p className="text-[9px] text-[#6b6271] tracking-widest font-bold mb-2">❯ ai-sec --best-practices</p>
                        {bestPractices.map((practice, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded border border-[#00ff41]/10 bg-[#00ff41]/3">
                            <span className="text-[#00ff41] font-bold shrink-0">[{String(i + 1).padStart(2, '0')}]</span>
                            <p className="text-[#c8c0d0] text-[11px] leading-relaxed">{practice}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── ACTIVITY LOG ───────────────────────────────────── */}
              <div className="terminal mt-4">
                <div className="terminal-bar">
                  <div className="terminal-dot bg-[#F40000]" />
                  <div className="terminal-dot bg-[#F4998D]/40" />
                  <div className="terminal-dot bg-[#6b6271]/30" />
                  <span className="ml-2 text-[9px] text-[#6b6271]">activity-log — latest events</span>
                </div>
                <div className="p-4 text-[10px] space-y-1.5 font-mono max-h-[150px] overflow-y-auto">
                  <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#00ff41]">SCAN</span> Security scan completed in {scanTime}s</p>
                  {counts.crit > 0 && <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#F40000]">ALERT</span> {counts.crit} critical vulnerabilities detected</p>}
                  {counts.high > 0 && <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#F44E3F]">WARN</span> {counts.high} high-risk issues found</p>}
                  {counts.med > 0 && <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#F4998D]">INFO</span> {counts.med} medium-risk findings</p>}
                  <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#00ff41]">AI</span> Fix suggestions generated for {vulns.filter(v => v.fix).length} threats</p>
                  <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#6b6271]">SYS</span> AI engine: AWS Bedrock (Claude)</p>
                  <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#6b6271]">SYS</span> Score: {score}/100 | Predicted: {predictedScore}/100 | Risk: {riskBand}</p>
                  <p><span className="text-[#6b6271]">[{new Date().toLocaleTimeString()}]</span> <span className="text-[#6b6271]">SYS</span> Source: {repoUrl || uploadedFile?.name || 'uploaded'}</p>
                </div>
              </div>

              {/* ── SCAN HISTORY ───────────────────────────────────── */}
              {history.length > 1 && (
                <div className="terminal mt-4">
                  <div className="terminal-bar">
                    <div className="terminal-dot bg-[#F40000]" />
                    <div className="terminal-dot bg-[#F4998D]/40" />
                    <div className="terminal-dot bg-[#6b6271]/30" />
                    <span className="ml-2 text-[9px] text-[#6b6271]">scan-history — {history.length} scans</span>
                  </div>
                  <div className="p-4 text-[10px] space-y-1 font-mono max-h-[120px] overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[#6b6271]">{h.timestamp}</span>
                        <span className="text-white flex-1 truncate">{h.source}</span>
                        <span className="text-[#F4998D]">{h.issueCount} issues</span>
                        <span style={{ color: BAND_COLORS[h.riskBand] || '#6b6271' }} className="font-bold">{h.score}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {fixChooser.open && fixChooser.vuln && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="terminal w-full max-w-4xl max-h-[88vh] flex flex-col">
            <div className="terminal-bar">
              <div className="terminal-dot bg-[#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#6b6271]">fix-option-selector</span>
              <span className="ml-auto text-[9px] text-[#00ff41] font-bold">[{fixChooser.options.length} OPTIONS]</span>
            </div>

            <div className="p-4 border-b border-[#F40000]/10">
              <p className="text-[10px] text-[#6b6271] tracking-widest font-bold mb-1">❯ CHOOSE THE BEST FIX</p>
              <p className="text-white text-sm font-bold">{fixChooser.vuln.title}</p>
              <p className="text-[#6b6271] text-[10px] font-mono">{fixChooser.vuln.file}{fixChooser.vuln.line ? `:${fixChooser.vuln.line}` : ''}</p>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto">
              {fixChooser.options.map((option, idx) => {
                const isSelected = fixChooser.selected === idx
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFixChooser(prev => ({ ...prev, selected: idx, error: '' }))}
                    className={`w-full text-left p-3 rounded border transition-all ${
                      isSelected
                        ? 'border-[#00ff41]/40 bg-[#00ff41]/8'
                        : 'border-[#F40000]/12 bg-[#0d0c0e] hover:border-[#F40000]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={`text-[10px] font-bold tracking-wider ${isSelected ? 'text-[#00ff41]' : 'text-[#F4998D]'}`}>
                        {isSelected ? '●' : '○'} {option.title}
                      </p>
                      <span className="text-[8px] px-2 py-0.5 rounded border border-[#F40000]/20 text-[#6b6271] uppercase">
                        {option.source}
                      </span>
                    </div>

                    <div className="font-mono text-[10px] space-y-1">
                      {option.fix.split('\n').slice(0, 4).map((line, lineIndex) => (
                        <p key={lineIndex} className="text-[#00ff41]">+ {line}</p>
                      ))}
                      {option.fix.split('\n').length > 4 && (
                        <p className="text-[#6b6271]">...and more</p>
                      )}
                    </div>
                  </button>
                )
              })}

              {fixChooser.error && (
                <div className="p-3 rounded border border-[#F40000]/30 bg-[#F40000]/6">
                  <p className="text-[#F40000] text-[10px] font-bold">{fixChooser.error}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#F40000]/10 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={closeFixChooser}
                disabled={fixChooser.applying}
                className="btn-ghost flex-1 !py-2 !px-4 !text-[10px] disabled:opacity-40"
              >
                ❯ CANCEL
              </button>
              <button
                type="button"
                onClick={applySelectedFix}
                disabled={fixChooser.applying}
                className="btn-red flex-1 !py-2 !px-4 !text-[10px] disabled:opacity-40"
              >
                {fixChooser.applying ? '⏳ APPLYING_SELECTED_FIX...' : '❯ APPLY_SELECTED_FIX'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}

export default DashboardPage
