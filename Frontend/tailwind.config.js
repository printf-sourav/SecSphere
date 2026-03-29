/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        cyber: {
          black: '#090809',
          dark: '#0d0c0e',
          panel: '#111013',
          surface: '#1a181c',
          border: '#2a272d',
          muted: '#6b6271',
        },
        red: {
          primary: '#F40000',
          hot: '#F44E3F',
          warm: '#F4998D',
          glow: '#ff1a1a',
          dim: '#3d0000',
        },
      },
      backgroundImage: {
        'gradient-red': 'linear-gradient(135deg, #F44E3F, #F4998D)',
        'gradient-red-dark': 'linear-gradient(135deg, #F40000, #F44E3F)',
        'gradient-surface': 'linear-gradient(180deg, #0d0c0e, #090809)',
      },
      boxShadow: {
        'red-glow': '0 0 20px rgba(244, 0, 0, 0.3), 0 0 60px rgba(244, 0, 0, 0.1)',
        'red-glow-lg': '0 0 40px rgba(244, 0, 0, 0.4), 0 0 80px rgba(244, 0, 0, 0.15)',
        'red-glow-sm': '0 0 10px rgba(244, 0, 0, 0.25)',
        'card': '0 4px 30px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-red': 'pulseRed 2.5s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'blink': 'blink 1s step-end infinite',
        'code-scroll': 'codeScroll 20s linear infinite',
        'grid-pulse': 'gridPulse 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(244, 0, 0, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(244, 0, 0, 0.5), 0 0 60px rgba(244, 0, 0, 0.2)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        codeScroll: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        gridPulse: {
          '0%, 100%': { opacity: '0.03' },
          '50%': { opacity: '0.08' },
        },
      },
    },
  },
  plugins: [],
}
