import { useEffect, useRef } from 'react'

const SpaceBackground = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animationFrameId
    let particles = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    const initParticles = () => {
      particles = []
      // 80-120 particles based on screen size, but bounded
      let numParticles = Math.floor((canvas.width * canvas.height) / 15000)
      if (numParticles < 80) numParticles = 80
      if (numParticles > 120) numParticles = 120

      for (let i = 0; i < numParticles; i++) {
        const size = Math.random() * 2 + 1 // 1px to 3px
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: size,
          // Float upward generally, with some horizontal drift.
          // Parallax: bigger particles move slightly faster
          speedX: (Math.random() - 0.5) * 0.2 * size,
          speedY: (Math.random() * -0.2 - 0.1) * size, // Negative Y is up
          baseOpacity: Math.random() * 0.6 + 0.2, // 0.2 to 0.8 opacity
          pulseSpeed: Math.random() * 0.02 + 0.01,
          pulseTime: Math.random() * Math.PI * 2,
        })
      }
    }

    window.addEventListener('resize', resize)
    resize()

    const draw = () => {
      // Clear canvas instead of painting solid background to let CSS layers show through
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update & Draw particles
      particles.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        p.pulseTime += p.pulseSpeed

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Soft flicker/pulse effect
        const pulse = Math.abs(Math.sin(p.pulseTime)) * 0.3
        const currentOpacity = Math.min(1, p.baseOpacity + pulse)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        
        // Soft glow effect using shadowBlur
        ctx.shadowBlur = p.size * 5 // glowing red (#ff2a2a)
        ctx.shadowColor = `rgba(255, 42, 42, ${currentOpacity})`
        ctx.fillStyle = `rgba(255, 42, 42, ${currentOpacity})`
        
        ctx.fill()
        
        // Reset shadow for performance
        ctx.shadowBlur = 0
      })

      animationFrameId = requestAnimationFrame(draw)
    }
    
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none overflow-hidden bg-black">
      {/* 1. Base Gradient: black -> very dark red -> black */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#000000] via-[#1a0005] to-[#000000]" />

      {/* 2. Radial Glow (top-left) */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-[#ff2a2a] opacity-[0.03] blur-[120px]" />

      {/* 5. Optional Light Effect: haze streak */}
      <div className="absolute top-[20%] right-[-5%] w-[40vw] h-[10vw] rounded-full bg-[#ff2a2a] opacity-[0.02] blur-[100px] transform rotate-45" />

      {/* Canvas for Particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 3. Depth Layer: Vignette (Darker edges) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_#000000_100%)] opacity-80" />

      {/* 4. Subtle Texture: Light noise/grain */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
    </div>
  )
}

export default SpaceBackground
