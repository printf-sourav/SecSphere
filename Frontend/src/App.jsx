import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import CleanBackground from './components/CleanBackground'
import LandingPage from './pages/LandingPage'
import DetailedPage from './pages/DetailedPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  // Global listener for liquid glass hover effects, keeping individual components clean
  useEffect(() => {
    const handleMouseMove = (e) => {
      document.querySelectorAll('.liquid-glass').forEach(el => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen relative">
      <CleanBackground />
      <div className="relative z-10">
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/details" element={<DetailedPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
