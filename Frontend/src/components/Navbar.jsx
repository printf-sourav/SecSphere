import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [location])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-[#090809]/95 backdrop-blur-sm border-b border-[#F40000]/10' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-[#F40000] font-bold text-lg">[</span>
          <span className="text-white font-bold text-sm tracking-wider">SecSphere</span>
          <span className="text-[#F40000] font-bold text-lg">]</span>
          <span className="w-2 h-4 bg-[#F40000] animate-[blink_1s_step-end_infinite] ml-0.5" />
        </Link>

        <div className="hidden md:flex items-center gap-6 text-xs">
          <Link to="/" className="text-[#6b6271] hover:text-[#F40000] transition-colors">~/home</Link>
          <Link to="/details" className="text-[#6b6271] hover:text-[#F40000] transition-colors">~/details</Link>
          <Link to="/dashboard" className="text-[#6b6271] hover:text-[#F40000] transition-colors">~/dashboard</Link>
          <Link to="/dashboard" className="btn-red !py-2 !px-5 !text-xs">./SCAN</Link>
        </div>

        <button className="md:hidden text-[#F40000]" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="text-sm">{menuOpen ? '[✕]' : '[≡]'}</span>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[#0d0c0e]/98 backdrop-blur-sm border-t border-[#F40000]/10 px-6 py-4 space-y-3 text-xs animate-slide-up">
          <Link to="/" className="block text-[#6b6271] hover:text-[#F40000]">❯ cd ~/home</Link>
          <Link to="/details" className="block text-[#6b6271] hover:text-[#F40000]">❯ cd ~/details</Link>
          <Link to="/dashboard" className="block text-[#6b6271] hover:text-[#F40000]">❯ cd ~/dashboard</Link>
          <Link to="/dashboard" className="btn-red !py-2 w-full !text-xs mt-2 block text-center">./SCAN</Link>
        </div>
      )}
    </nav>
  )
}

export default Navbar
