const Footer = () => {
  return (
    <footer className="border-t border-[#F40000]/8 py-10 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#F40000] font-bold">[</span>
              <span className="text-white font-bold text-sm">SecSphere</span>
              <span className="text-[#F40000] font-bold">]</span>
            </div>
            <p className="text-[#6b6271] leading-relaxed">
              Enterprise-grade AI-powered security<br />
              for code, cloud, and access.
            </p>
          </div>
          <div>
            <p className="text-[#F40000] font-bold mb-3 uppercase tracking-wider text-[10px]">// Links</p>
            <ul className="space-y-2">
              <li><a href="#" className="text-[#6b6271] hover:text-[#F40000] transition-colors">❯ github</a></li>
              <li><a href="#" className="text-[#6b6271] hover:text-[#F40000] transition-colors">❯ documentation</a></li>
              <li><a href="#" className="text-[#6b6271] hover:text-[#F40000] transition-colors">❯ contact</a></li>
            </ul>
          </div>
          <div className="md:text-right">
            <p className="text-[#F40000] font-bold mb-3 uppercase tracking-wider text-[10px]">// Status</p>
            <div className="flex items-center gap-2 md:justify-end mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: '0 0 6px #00ff41' }} />
              <span className="text-[#00ff41] text-[10px]">ALL_SYSTEMS_OPERATIONAL</span>
            </div>
            <p className="text-[#6b6271]/50 text-[10px]">© 2026 SecSphere. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
