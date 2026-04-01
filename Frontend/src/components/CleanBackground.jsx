import React from 'react';

const CleanBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#050002] transition-colors duration-1000">
      {/* 1. Base smooth dark gradient (black -> very dark red -> black) with slow smooth movement */}
      {/* The background uses a 200% size to slowly shift across the screen for the ambient motion */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(135deg,#050002_0%,#1a0408_50%,#050002_100%)] bg-[length:200%_200%] animate-[gradientSlow_15s_ease-in-out_infinite_alternate]" 
      />
      
      {/* 2. Soft Red Radial Glow Behind Main Content (cinematic, low opacity) */}
      {/* Top Center Glow (behind Header/Hero) */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(244,0,0,0.06)_0%,transparent_60%)] pointer-events-none mix-blend-screen"
      />
      
      {/* Bottom Right Glow (ambient) */}
      <div 
        className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(200,0,0,0.04)_0%,transparent_70%)] pointer-events-none mix-blend-screen"
      />
      
      {/* Middle Left Glow (ambient) */}
      <div 
        className="absolute top-1/2 left-0 -translate-y-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle_at_center,rgba(244,0,0,0.03)_0%,transparent_60%)] pointer-events-none mix-blend-screen"
      />

      {/* 5. Depth Overlay: Vignette to gracefully sink the edges into deeper black */}
      <div 
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)] z-10" 
      />
    </div>
  );
};

export default CleanBackground;
