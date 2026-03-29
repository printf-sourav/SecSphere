import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import MatrixRain from './components/MatrixRain'
import LandingPage from './pages/LandingPage'
import DetailedPage from './pages/DetailedPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <div className="min-h-screen bg-[#090809] crt-overlay">
      <MatrixRain />
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
