import React, { useEffect, useState } from 'react';

/**
 * Animated splash/loading screen with Tallyfy logo.
 */
export default function SplashScreen({ onFinish, duration = 800 }) {
  const [phase, setPhase] = useState('in'); // 'in' | 'out'

  useEffect(() => {
    // start fade-out
    const t2 = setTimeout(() => setPhase('out'), duration - 300);
    // after fade-out animation, call onFinish
    const t3 = setTimeout(() => onFinish && onFinish(), duration);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onFinish]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '32px',
      opacity: phase === 'out' ? 0 : 1,
      transition: phase === 'out' ? 'opacity 0.3s ease' : 'none',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        animation: 'splash-fade-in 0.4s ease-out forwards',
      }}>
        <img
          src="/logo.png"
          alt="Tallyfy"
          width="120"
          height="120"
          fetchPriority="high"
          style={{
            width: '120px',
            filter: 'drop-shadow(0 0 32px rgba(255,214,0,0.35))',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700, fontSize: '12px',
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: '#555',
        }}>
          APLIKASI KASIR MODERN & MUDAH
        </p>
      </div>

      {/* Animated loading bar */}
      <div style={{
        width: '180px', height: '3px',
        background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden',
        position: 'relative',
        animation: 'splash-fade-in 0.4s ease-out forwards',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent, #FFD600, transparent)',
          animation: 'splash-sweep 1s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes splash-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes splash-fade-in {
          0%   { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
