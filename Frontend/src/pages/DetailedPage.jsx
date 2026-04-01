import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const HowItWorksLive = () => {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 6);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { step: '01', label: 'User uploads code or repository', icon: '⬆', color: '#F4998D' },
    { step: '02', label: 'System scans using rule-based tools', icon: '🔍', color: '#F44E3F' },
    { step: '03', label: 'Vulnerabilities detected and categorized', icon: '⚠', color: '#F40000' },
    { step: '04', label: 'AI explains each issue in plain language', icon: '🧠', color: '#F4998D' },
    { step: '05', label: 'AI suggests production-ready fixes', icon: '🛠', color: '#00ff41' },
    { step: '06', label: 'Dashboard displays all results', icon: '📊', color: '#00ff41' },
  ];

  const statusLogs = [
    "Uploading target repository payload...",
    "Running static analysis nodes...",
    "Categorizing identified threat vectors...",
    "AI generating semantic threat models...",
    "Synthesizing zero-day secure patches...",
    "Finalizing security telemetry payload..."
  ];

  return (
    <div className="terminal relative border border-[#F40000]/10 shadow-[0_0_40px_rgba(244,0,0,0.05)]">
      <div className="terminal-bar relative z-10 bg-[#0d0c0e]/80 backdrop-blur">
        <div className="terminal-dot bg-[#F40000]" />
        <div className="terminal-dot bg-[#F4998D]/40" />
        <div className="terminal-dot bg-[#6b6271]/30" />
        <span className="ml-2 text-[9px] text-[#6b6271]">execution-flow // system.log</span>
        <div className="ml-auto flex items-center gap-1.5 border border-[#00ff41]/20 rounded-full px-2 py-0.5 bg-[#00ff41]/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse glow-green shadow-[0_0_8px_#00ff41]" />
          <span className="text-[9px] text-[#00ff41] tracking-wider font-bold">LIVE PROCESS</span>
        </div>
      </div>
      <div className="terminal-body text-xs space-y-4 relative z-10">
        <p className="text-[#6b6271]">❯ ai-sec --show-pipeline</p>
        <p className="text-white font-bold text-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"># 🧠 HOW_IT_WORKS</p>

        <div className="space-y-3 relative p-2">
          {steps.map((s, i) => {
            const isActive = activeStep === i;
            const isPassed = i < activeStep;
            return (
              <div key={i} className={`flex items-start gap-4 transition-all duration-500 p-2 rounded relative outline-none ${isActive ? 'bg-[#131114] border border-[#F40000]/30 shadow-[0_0_20px_rgba(244,0,0,0.15)] scale-[1.02] translate-x-1' : (isPassed ? 'opacity-70 grayscale-[50%]' : 'opacity-30 border border-transparent')}`}>
                <span className={`font-bold shrink-0 transition-colors duration-300 ${isActive ? 'text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]' : 'text-[#F40000]'}`}>[{s.step}]</span>
                <span className={`shrink-0 transition-all duration-300 text-lg ${isActive ? 'scale-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] animate-bounce' : ''}`}>{s.icon}</span>
                <span className={`transition-colors duration-300 mt-0.5 ${isActive ? 'text-white font-bold tracking-wide' : ''}`} style={{ color: isActive ? 'white' : s.color }}>{s.label}</span>
                {i < 5 && (
                  <div className="absolute left-[38px] top-8 w-0.5 h-[18px] bg-[#F40000]/20 overflow-hidden">
                    <div className={`w-full h-full bg-gradient-to-b from-transparent via-[#F40000] to-transparent ${isActive ? 'animate-[flowDown_1s_ease-in-out_infinite]' : 'opacity-0'}`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="h-px bg-[#F40000]/20 my-5" />
        <div className="bg-[#00ff41]/5 border border-[#00ff41]/10 rounded p-2.5">
          <p className="text-[#00ff41] flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse shadow-[0_0_8px_#00ff41]" />
            <span className="animate-pulse font-mono tracking-wide">{statusLogs[activeStep]}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

const WhyUsLive = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % 6);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    { tag: '01', title: 'AI-Powered Explanation', desc: 'Makes security understandable for everyone', hl: 'AI-Powered' },
    { tag: '02', title: 'Auto-Fix Suggestions', desc: 'Not just detection — solution provided instantly', hl: 'Auto-Fix' },
    { tag: '03', title: 'Unified Platform', desc: 'Code + Config + IAM — all in one place', hl: 'Unified Platform' },
    { tag: '04', title: 'Beginner-Friendly', desc: 'No deep security knowledge required', hl: '' },
    { tag: '05', title: 'Faster Workflow', desc: 'Reduces review time from days → seconds', hl: 'Faster Workflow' },
    { tag: '06', title: 'Shift-Left Security', desc: 'Prevent vulnerabilities before deployment', hl: '' },
  ];

  return (
    <div className="terminal border border-[#00ff41]/20 shadow-[0_10px_40px_rgba(0,255,65,0.05)] bg-[#030d06] relative overflow-hidden group">
      <div className="absolute inset-0 bg-[#00ff41]/[0.02] animate-[pulse_4s_infinite] pointer-events-none" />
      
      <div className="terminal-bar bg-[#0d0c0e]/90 backdrop-blur border-b border-[#00ff41]/10">
        <div className="terminal-dot bg-[#F40000]" />
        <div className="terminal-dot bg-[#F4998D]/40" />
        <div className="terminal-dot bg-[#6b6271]/30" />
        <span className="ml-2 text-[9px] text-[#6b6271]">competitive-advantage</span>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#00ff41] font-bold tracking-wider px-2 py-0.5 rounded bg-[#00ff41]/10 border border-[#00ff41]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-[pulse_1s_ease-in-out_infinite] glow-green" />
          [WINNING]
        </span>
      </div>
      <div className="terminal-body text-xs space-y-4 relative z-10">
        <p className="text-[#6b6271]">❯ ai-sec --why-us</p>
        <p className="text-white font-bold text-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] flex items-center gap-2">
            <span className="text-[#00ff41] animate-pulse"># 🚀</span> WHAT_MAKES_US_BETTER
        </p>

        <div className="space-y-2.5 relative">
          {features.map((item, i) => {
             const isActive = activeIndex === i;
             return (
            <div key={i} className={`flex items-start gap-4 p-3 rounded transition-all duration-500 border ${isActive ? 'bg-[#00ff41]/10 border-[#00ff41]/50 shadow-[0_5px_20px_rgba(0,255,65,0.2)] scale-[1.03] translate-x-2' : 'bg-[#00ff41]/[0.02] border-[#00ff41]/10 opacity-60 hover:opacity-100 hover:border-[#00ff41]/30 hover:-translate-y-0.5'}`}>
              <span className={`font-bold shrink-0 transition-colors ${isActive ? 'text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.8)] scale-110' : 'text-[#F40000]/70'}`}>[{item.tag}]</span>
              <div className="transform transition-transform duration-300 w-full">
                <span className={`font-bold transition-colors duration-300 flex items-center gap-2 ${isActive ? 'text-white' : 'text-[#00ff41]'}`}>
                    <span className={`transition-transform duration-300 ${isActive ? 'scale-125 drop-shadow-[0_0_5px_#fff]' : ''}`}>✅</span> 
                    {item.hl ? (
                        <span>
                            {item.title.split(item.hl)[0]}
                            <span className={isActive ? "text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.5)] bg-[#00ff41]/10 px-1 rounded" : "text-white"}>{item.hl}</span>
                            {item.title.split(item.hl)[1]}
                        </span>
                    ) : item.title}
                </span>
                <p className={`mt-1 transition-colors ${isActive ? 'text-[#c8c0d0]' : 'text-[#6b6271]'}`}>{item.desc}</p>
              </div>
            </div>
          )})}
        </div>

        <div className="border border-[#00ff41]/30 rounded p-4 bg-[#00ff41]/[0.05] text-center mt-5 shadow-[0_0_15px_rgba(0,255,65,0.1)] relative overflow-hidden group/quote">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00ff41]/10 to-transparent translate-x-[-100%] group-hover/quote:animate-[flowRight_2s_linear_infinite]" />
          <p className="text-[#00ff41] text-[11px] italic font-medium relative z-10">
            "Traditional tools detect problems. Our system detects, explains,
          </p>
          <p className="text-[#00ff41] text-[11px] italic font-medium mt-1 relative z-10">
            and <span className="text-white font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] px-1 rounded bg-[#00ff41]/20">fixes them using AI</span> — all in one platform."
          </p>
        </div>
      </div>
    </div>
  )
}

const DetailedPage = () => {
  const headerRef = useRef(null)

  useEffect(() => {
    // Dynamically apply scroll-reveal and liquid-glass hover effects to all terminals natively 
    const terminals = document.querySelectorAll('.detailed-page-terminals .terminal');
    terminals.forEach((el) => {
      el.classList.add('group', 'transition-all', 'duration-300', 'hover:-translate-y-1.5', 'hover:shadow-[0_12px_40px_rgba(244,0,0,0.2)]', 'hover:border-[#F40000]/50', 'relative', 'overflow-hidden');

      if (!el.querySelector('.scanner-grad')) {
        const grad = document.createElement('div');
        grad.className = "scanner-grad absolute inset-0 bg-gradient-to-b from-transparent via-[#F40000]/[0.02] to-transparent h-[200%] animate-[scanVertical_5s_linear_infinite] pointer-events-none -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0";
        el.prepend(grad);
      }

      const bar = el.querySelector('.terminal-bar')
      const body = el.querySelector('.terminal-body')
      if (bar) bar.classList.add('relative', 'z-10');
      if (body) body.classList.add('relative', 'z-10');

      el.classList.add('scroll-hidden');
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('scroll-visible');
          el.classList.remove('scroll-hidden');
          observer.unobserve(el);
        }
      }, { threshold: 0.1 });
      observer.observe(el);
    });

    // Header reveal
    if (headerRef.current) {
      const el = headerRef.current;
      el.classList.add('scroll-title-hidden');
      const obs = new IntersectionObserver(([ent]) => {
        if (ent.isIntersecting) {
          el.classList.add('scroll-title-visible');
          el.classList.remove('scroll-title-hidden');
          obs.unobserve(el);
        }
      }, { threshold: 0.1 });
      obs.observe(el);
    }

    // Stagger list items
    const listItems = document.querySelectorAll('.detailed-page-terminals .terminal-body .flex.items-start');
    listItems.forEach((el, i) => {
      el.classList.add('animate-fade-in', 'opacity-0');
      el.style.animationDelay = `${0.3 + ((i % 6) * 0.15)}s`;
      el.style.animationFillMode = 'forwards';
    });
  }, []);
  return (
    <>
      <div className="pt-20 pb-16 px-4 md:px-6 detailed-page-terminals">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Page header */}
          <div ref={headerRef} className="text-center mb-10">
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
          <div className="terminal relative border border-[#F40000]/30 shadow-[0_0_30px_rgba(244,0,0,0.15)] bg-[#130000]">
            {/* Ambient terminal background pulse for alert mode */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,0,0,0.05)_0%,transparent_80%)] animate-pulse pointer-events-none z-0" />

            <div className="terminal-bar bg-[#F40000]/10 border-b border-[#F40000]/30 relative z-10">
              <div className="terminal-dot bg-[#F40000] shadow-[0_0_8px_#F40000]" />
              <div className="terminal-dot bg-[#F4998D]/40" />
              <div className="terminal-dot bg-[#6b6271]/30" />
              <span className="ml-2 text-[9px] text-[#F4998D] font-bold tracking-widest uppercase animate-pulse">sys.alert // error.log</span>
              <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#F40000] font-bold tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-[pulse_0.5s_ease-in-out_infinite] glow-red" />
                [CRITICAL]
              </span>
            </div>
            <div className="terminal-body text-xs space-y-4 relative z-10">
              <p className="text-[#6b6271]">❯ cat /logs/security_diagnostic.log</p>

              <p className="text-white font-bold text-sm flex items-center gap-2">
                <span className="text-[#F40000] animate-[bounce_1s_infinite] drop-shadow-[0_0_8px_rgba(244,0,0,0.8)]">⚠</span>
                <span className="text-[#F40000] drop-shadow-[0_0_12px_rgba(244,0,0,0.6)] tracking-widest uppercase animate-pulse">SYSTEM ALERT: SECURITY RISKS DETECTED</span>
              </p>

              <p className="text-[#F4998D] italic opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                Modern software development is fast, but security is slow, complex, and prone to human error.
              </p>

              <div className="border border-[#F40000]/20 rounded p-3 bg-[#0d0c0e] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#F40000]/[0.05] to-transparent pointer-events-none" />
                <div className="space-y-3 relative z-10">
                  {[
                    { text: 'Developers push insecure code unknowingly', hl: 'insecure code' },
                    { text: 'Security reviews take DAYS or weeks, blocking CI/CD pipelines', hl: 'DAYS', isMetric: true },
                    { text: '80%+ cloud breaches are due to simple misconfigurations', hl: '80%+', isMetric: true },
                    { text: 'IAM policies are overly permissive ("it works, ship it")', hl: 'overly permissive' },
                    { text: 'Existing tools generate complex, unreadable, and noisy reports', hl: 'noisy reports' }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 opacity-0 animate-[fade-in_0.5s_ease-out_forwards] transition-transform hover:translate-x-1"
                      style={{ animationDelay: `${0.8 + (idx * 0.4)}s`, animationFillMode: 'forwards' }}
                    >
                      <div className="w-1.5 h-1.5 mt-1 rounded-full bg-[#F40000] shadow-[0_0_5px_#F40000] animate-[pulse_1s_infinite] shrink-0" />
                      <p className="text-[#c8c0d0]">
                        {item.text.split(item.hl).map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <span className={`font-bold ${item.isMetric ? 'text-[#F44E3F] px-1 bg-[#F44E3F]/10 rounded border border-[#F44E3F]/30' : 'text-[#F40000] drop-shadow-[0_0_3px_rgba(244,0,0,0.4)]'}`}>
                                {item.hl}
                              </span>
                            )}
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Problem Animation Container */}
              <div className="border border-[#F40000]/30 rounded p-3 bg-[#F40000]/10 relative min-h-[90px] overflow-hidden opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '3s', animationFillMode: 'forwards' }}>
                <div className="absolute inset-0 flex items-center pl-3 bg-[#0d0c0e] animate-fade-out" style={{ animationDelay: '4.5s', animationFillMode: 'forwards' }}>
                  <p className="text-[#F4998D] italic flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full border-2 border-[#F4998D] border-t-transparent animate-spin" />
                    Analyzing root cause...
                  </p>
                </div>

                <div className="opacity-0 animate-[fade-in_0.5s_ease-out_forwards] absolute inset-0 p-3" style={{ animationDelay: '5s', animationFillMode: 'forwards' }}>
                  <p className="text-[#F40000] font-bold text-[10px] tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-[#F40000] rounded-full animate-pulse shadow-[0_0_5px_#F40000]" />
                    CORE PROBLEM DIAGNOSED:
                  </p>
                  <p className="text-[#F4998D]">There is no simple, developer-friendly tool that not only detects</p>
                  <p className="text-[#F4998D]">vulnerabilities but also <span className="text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">explains and fixes them automatically</span>.</p>
                </div>
              </div>

              <div className="h-px bg-[#F40000]/20 opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '5.5s', animationFillMode: 'forwards' }} />

              <p className="text-[#F44E3F] font-bold italic border-l-2 border-[#F44E3F] pl-3 py-1 opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '6s', animationFillMode: 'forwards' }}>
                ⚠ Multiple critical security issues detected in modern workflows
              </p>
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
              <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#00ff41] font-bold tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] shadow-[0_0_8px_#00ff41] animate-[pulse_1.5s_infinite]" />
                [SOLVED]
              </span>
            </div>
            <div className="terminal-body text-xs space-y-4">
              <p className="text-[#6b6271]">❯ cat /docs/solution.md</p>
              <p className="text-white font-bold text-sm drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"># 💡 OUR_SOLUTION</p>

              <div className="space-y-1 border-l-2 border-[#00ff41]/30 pl-3">
                <p className="text-[#6b6271] opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>An AI-powered Security Review Agent that scans code, configurations,</p>
                <p className="text-[#6b6271] opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>and IAM policies — explains vulnerabilities in simple terms — and</p>
                <p className="text-[#6b6271] opacity-0 animate-[fade-in_0.5s_ease-out_forwards]" style={{ animationDelay: '1s', animationFillMode: 'forwards' }}>generates secure fixes instantly.</p>
              </div>

              <div className="border border-[#00ff41]/20 rounded p-5 bg-[#00ff41]/5 text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00ff41]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-[flowRight_2s_linear_infinite]" />

                <p className="text-[#00ff41] font-bold text-sm tracking-wider flex items-center justify-center gap-2 relative z-10">
                  <span className="opacity-0 animate-[fade-in_0.3s_forwards]" style={{ animationDelay: '1.5s' }}>Detect <span className="text-white drop-shadow-[0_0_3px_#fff]">✔</span></span>
                  <span className="text-[#00ff41]/50 opacity-0 animate-[fade-in_0.3s_forwards]" style={{ animationDelay: '1.8s' }}>→</span>
                  <span className="opacity-0 animate-[fade-in_0.3s_forwards]" style={{ animationDelay: '2.1s' }}>Explain <span className="text-white drop-shadow-[0_0_3px_#fff]">✔</span></span>
                  <span className="text-[#00ff41]/50 opacity-0 animate-[fade-in_0.3s_forwards]" style={{ animationDelay: '2.4s' }}>→</span>
                  <span className="opacity-0 animate-[fade-in_0.3s_forwards]" style={{ animationDelay: '2.7s' }}>Fix <span className="text-white drop-shadow-[0_0_3px_#fff]">✔</span></span>
                </p>
                <p className="text-[#00ff41]/70 text-[10px] mt-2 opacity-0 animate-[fade-in_0.5s_forwards] uppercase tracking-widest" style={{ animationDelay: '3.2s' }}>
                  — all in seconds using AI —
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
              <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#F40000] font-bold tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-pulse glow-red" />
                [6 MODULES]
              </span>
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
                  <span className="text-[#00ff41] text-[9px] font-bold ml-2 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-[#00ff41] animate-pulse" />
                    [KEY FEATURE]
                  </span>
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
    │     (Node.js / Express)             │
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
    │         (AWS Bedrock / Claude)                │
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
          <HowItWorksLive />

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'FRONTEND', main: 'React + Tailwind CSS', sub: 'Responsive dashboard UI', icon: '⚛️', status: 'Active' },
                  { title: 'BACKEND', main: 'Node.js (Express)', sub: 'REST API + orchestration', icon: '🟢', status: 'Running' },
                  { title: 'AI LAYER', main: 'AWS Bedrock (Claude)', sub: 'Explanation + fix generation', icon: '🧠', status: 'Online' },
                  { title: 'SECURITY', main: 'Semgrep + Logic Core', sub: 'Custom rules (config + IAM)', icon: '🛡️', status: 'Secured' }
                ].map((tech, i) => (
                  <div key={i} className="border border-[#F40000]/10 rounded p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1.5 hover:border-[#F40000]/40 hover:shadow-[0_10px_30px_rgba(244,0,0,0.15)] bg-[#0d0c0e]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F40000]/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <p className="text-[#F40000] font-bold text-[10px] tracking-widest flex items-center gap-2">
                        <span className="text-sm group-hover:scale-110 transition-transform">{tech.icon}</span>
                        {tech.title}
                      </p>
                      <span className="text-[8px] uppercase tracking-wider font-bold text-[#00ff41] bg-[#00ff41]/10 px-1.5 py-0.5 rounded border border-[#00ff41]/20 flex items-center gap-1 group-hover:shadow-[0_0_8px_rgba(0,255,65,0.4)] transition-shadow">
                        <div className="w-1 h-1 rounded-full bg-[#00ff41] animate-pulse" />
                        {tech.status}
                      </span>
                    </div>

                    <div className="relative z-10">
                      <p className="text-white font-bold tracking-wide drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">{tech.main}</p>
                      <p className="text-[#6b6271] mt-1 text-[11px] group-hover:text-[#c8c0d0] transition-colors">{tech.sub}</p>
                    </div>
                  </div>
                ))}
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

              <div className="border border-[#F40000]/20 rounded p-4 space-y-2 relative group hover:border-[#F40000]/40 transition-all bg-[#0d0c0e]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(244,0,0,0.05)_0%,transparent_60%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="text-[#6b6271] font-bold text-[10px] tracking-wider mb-2 uppercase border-b border-[#F40000]/20 pb-1">Legacy Competitors:</p>
                <div className="flex flex-wrap gap-2 pt-1 relative z-10">
                    <span className="text-white bg-[#1a0505] border border-[#F40000]/30 px-2 py-1 rounded text-[10px] font-mono shadow-[0_0_10px_rgba(244,0,0,0.1)]">Snyk</span>
                    <span className="text-white bg-[#1a0505] border border-[#F40000]/30 px-2 py-1 rounded text-[10px] font-mono shadow-[0_0_10px_rgba(244,0,0,0.1)]">SonarQube</span>
                    <span className="text-white bg-[#1a0505] border border-[#F40000]/30 px-2 py-1 rounded text-[10px] font-mono shadow-[0_0_10px_rgba(244,0,0,0.1)]">AWS Security Hub</span>
                    <span className="text-white bg-[#1a0505] border border-[#F40000]/30 px-2 py-1 rounded text-[10px] font-mono shadow-[0_0_10px_rgba(244,0,0,0.1)]">Amazon GuardDuty</span>
                </div>
              </div>

              <p className="text-white font-bold mt-6 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#F40000] animate-pulse shadow-[0_0_8px_#F40000]" />
                # ❌ PROBLEMS WITH EXISTING TOOLS:
              </p>
              
              <div className="border border-[#F40000]/30 rounded p-4 space-y-3.5 bg-[#130000] relative overflow-hidden shadow-[0_0_30px_rgba(244,0,0,0.1)]">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.03] text-[150px] pointer-events-none font-bold leading-none">⚠</div>
                
                {[
                  { tag: 'Complex Reports', text: 'Hard for beginners and non-security engineers to understand' },
                  { tag: 'No Clear Explanations', text: 'Vulnerabilities are flagged without meaningful context' },
                  { tag: 'No AI Fix', text: 'Only detects issues, provides no auto-fix production patches', hl: 'no auto-fix' },
                  { tag: 'Fragmented', text: 'Requires separate tools for Code / Cloud / IAM' },
                  { tag: 'Detection Only', text: 'Data generated is not actionable immediately' }
                ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3.5 opacity-0 animate-[fade-in_0.5s_ease-out_forwards] transition-all hover:translate-x-1.5 group/item" style={{animationDelay: `${0.3 + idx * 0.3}s`}}>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-[pulse_1s_infinite] shrink-0 shadow-[0_0_5px_#F40000] group-hover/item:scale-150 transition-transform" />
                        <span className="bg-[#F40000] text-black px-2 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider min-w-[130px] text-center shrink-0 shadow-[0_0_8px_rgba(244,0,0,0.6)] group-hover/item:bg-white group-hover/item:text-[#F40000] transition-colors">
                            {item.tag}
                        </span>
                        <span className="text-[#c8c0d0] text-[10px] md:text-xs">
                            {item.hl ? (
                                <span>
                                    {item.text.split(item.hl)[0]}
                                    <span className="text-[#F40000] font-bold bg-[#F40000]/10 border border-[#F40000]/40 px-1 rounded">{item.hl}</span>
                                    {item.text.split(item.hl)[1]}
                                </span>
                            ) : item.text.replace('80%+', '').split('complex').map((part, i, arr) => (
                                <span key={i}>
                                    {part}
                                    {i < arr.length - 1 && <span className="text-[#F40000] font-bold drop-shadow-[0_0_5px_rgba(244,0,0,0.5)]">complex</span>}
                                </span>
                            ))}
                        </span>
                    </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* COMPETITIVE ADVANTAGE */}
          {/* ══════════════════════════════════════════════════════════ */}
          <WhyUsLive />

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
                <span className="text-[#6b6271] mr-1 hidden sm:inline animate-[pulse_3s_ease-in-out_infinite] font-normal lowercase italic tracking-normal">recording node</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#F40000] animate-[pulse_1s_ease-in-out_infinite] glow-red" />
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
