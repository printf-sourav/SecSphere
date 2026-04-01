import { useState, useEffect, useRef } from 'react'
import useScrollReveal from '../hooks/useScrollReveal'

// Component to handle number counting
const AnimatedCounter = ({ target, duration = 1500, trigger }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!trigger) return;
    let startTime = null;
    let animationFrame;

    const updateCounter = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // Easing function for smoother slowdown at the end
      const easeOutQuart = 1 - Math.pow(1 - percentage, 4);
      setCount(Math.floor(easeOutQuart * target));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(updateCounter);
      }
    };

    animationFrame = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, trigger]);

  return <>{count}%</>
}

// Component to handle the DAYS -> SEC text cycle
const TimeReducerText = ({ trigger }) => {
  const [text, setText] = useState('DAYS...')
  
  useEffect(() => {
    if (!trigger) return;
    const sequence = ['DAYS', 'HOURS', 'MINS', 'SEC'];
    let idx = 0;
    
    const interval = setInterval(() => {
      idx++;
      if (idx < sequence.length) {
        setText(sequence[idx] + (idx === sequence.length - 1 ? '' : '...'));
      } else {
        clearInterval(interval);
      }
    }, 400); // changes every 400ms

    return () => clearInterval(interval);
  }, [trigger]);

  return <>{text}</>
}

const ImpactSection = () => {
  const headerRef = useScrollReveal({ variant: 'title' })
  const terminalRef = useScrollReveal({ threshold: 0.1 })
  const statsRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  // Observer specifically to trigger the counters and bars when the stats container is in view
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.3 })

    if (statsRef.current) {
      observer.observe(statsRef.current)
    }
    return () => observer.disconnect()
  }, [])

  const stats = [
    { value: 80, isNum: true, label: 'of breaches caused by misconfigurations', bar: 80, icon: '⚠' },
    { value: 'time', isNum: false, label: 'security review time reduction', bar: 95, icon: '⚡' },
    { value: 100, isNum: true, label: 'AI-powered prevention, not just detection', bar: 100, icon: '🛡' },
  ]

  return (
    <section className="py-20 px-4 md:px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,0,0,0.015)_0%,transparent_70%)] pointer-events-none" />
      <div className="max-w-5xl mx-auto">
        <div ref={headerRef}>
          <p className="section-tag">// METRICS</p>
          <h2 className="section-heading">IMPACT_REPORT</h2>
          <p className="section-desc">Why automated security analysis matters.</p>
        </div>

        <div ref={terminalRef} className="mt-12 terminal shadow-[0_10px_50px_rgba(244,0,0,0.05)] border border-[#F40000]/20">
          <div className="terminal-bar bg-[#0d0c0e]/80 backdrop-blur">
            <div className="terminal-dot bg-[#F40000]" />
            <div className="terminal-dot bg-[#F4998D]/40" />
            <div className="terminal-dot bg-[#6b6271]/30" />
            <span className="ml-2 text-[9px] text-[#6b6271]">impact-metrics</span>
            
            <div className="ml-auto flex items-center gap-1.5 text-[9px] text-[#00ff41] font-bold tracking-wider">
              <span className="text-[#6b6271] mr-1 hidden sm:inline font-normal lowercase italic tracking-normal">live telemetry</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse shadow-[0_0_8px_#00ff41]" />
              [TRACKING]
            </div>
          </div>
          
          <div className="terminal-body text-xs space-y-7 relative overflow-hidden bg-[#0d0c0e]">
            {/* Background scanner */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F40000]/[0.02] to-transparent h-[200%] animate-[scanVertical_5s_linear_infinite] pointer-events-none -translate-y-1/2 opacity-50 z-0" />
            
            <p className="text-[#6b6271] relative z-10 mb-2 font-bold uppercase tracking-widest text-[10px]">❯ ai-sec --show-impact</p>
            
            <div ref={statsRef} className="space-y-6 relative z-10">
              {stats.map((stat, i) => (
                <div 
                  key={i} 
                  className="group transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 p-3 -mx-3 rounded cursor-default border border-transparent hover:border-[#F40000]/20 hover:bg-[#F40000]/[0.02]"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl text-[#F4998D] opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform duration-300">{stat.icon}</span>
                      <span className="text-[#F40000] font-bold text-xl md:text-2xl drop-shadow-[0_0_8px_rgba(244,0,0,0.5)] transition-all duration-300 group-hover:text-[#F44E3F] tracking-wide inline-block w-[100px]">
                        {stat.isNum ? (
                           <AnimatedCounter target={stat.value} trigger={isVisible} />
                        ) : (
                           isVisible ? <TimeReducerText trigger={isVisible} /> : 'DAYS'
                        )}
                      </span>
                    </div>
                    <span className="text-[#c8c0d0] text-[10px] md:text-xs font-medium uppercase tracking-wider group-hover:text-white transition-colors text-right max-w-[200px] md:max-w-none ml-4 relative top-1">
                      {stat.label}
                    </span>
                  </div>
                  
                  <div className="h-2.5 md:h-3 bg-[#1a181c] rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-[#332b35]/50 relative">
                    <div
                      className="h-full rounded-full transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] relative overflow-hidden flex items-center justify-end"
                      style={{
                        width: isVisible ? `${stat.bar}%` : '0%',
                        background: 'linear-gradient(90deg, #F40000, #F44E3F, #ff8c7d)',
                        boxShadow: isVisible ? '0 0 15px rgba(244,78,63,0.5)' : 'none',
                      }}
                    >
                      {/* Animated inner reflection/shine */}
                      <div className="absolute top-0 bottom-0 left-[-100%] w-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[flowRight_2s_linear_infinite] opacity-0 group-hover:opacity-100 mix-blend-overlay" />
                      
                      <div className="w-1.5 h-full bg-white/50 rounded-full mr-0.5 opacity-50 shadow-[0_0_5px_white]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="h-px bg-[#F40000]/20 my-5 relative z-10" />
            
            <div className="relative z-10 bg-[#00ff41]/5 border border-[#00ff41]/20 p-3 rounded flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-[#00ff41] animate-[pulse_2s_infinite] shadow-[0_0_10px_#00ff41]" />
               <p className={`text-[#00ff41] font-bold tracking-widest uppercase transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0 drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]' : 'opacity-0 translate-y-4'}`}>
                 ✓ Security posture: SIGNIFICANTLY IMPROVED
               </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ImpactSection
