import React, { useState, useEffect, useRef } from 'react';

interface AnimatedHourglassProps {
  className?: string;
  size?: number;
  isActive?: boolean;
}

export default function AnimatedHourglass({ className = '', size = 36, isActive = false }: AnimatedHourglassProps) {
  const [rotation, setRotation] = useState(0);
  const [pourProgress, setPourProgress] = useState(1); // 1 = fully poured to bottom, 0 = all at top
  const [isPouring, setIsPouring] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Trigger flip and pour
  const triggerFlip = () => {
    if (isPouring) return; // Prevent double taps during animation
    
    setRotation(prev => prev + 180);
    setIsPouring(true);
    setPourProgress(0); // Reset progress so it starts pouring from the new top
    
    startTimeRef.current = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      const duration = 2000; // Total animation duration: 2 seconds
      
      if (elapsed < duration) {
        // Linear or ease-in-out progress from 0 to 1
        const p = Math.min(elapsed / duration, 1);
        
        // Custom easing: delay sand start until mid-flip (around 25% of duration)
        // Mid-flip of 180 deg is 500ms into the 2000ms animation.
        // Rotation takes about 800ms visually via CSS transition.
        let sandP = 0;
        if (p > 0.2) {
          // Map 0.2..1.0 to 0.0..1.0
          sandP = (p - 0.2) / 0.8;
        }
        
        setPourProgress(sandP);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setPourProgress(1);
        setIsPouring(false);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Auto-flip on load
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerFlip();
    }, 400); // Small initial delay for perfect visual entrance
    return () => {
      clearTimeout(timer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Determine which bulb is top and bottom inside SVG coordinates based on rotation
  const isOddFlip = (rotation / 180) % 2 === 1;

  // Let's compute the clip heights
  // Top sand starts at y=12, ends at y=31. Height is 19.
  // Bottom sand starts at y=33, ends at y=52. Height is 19.
  // If isOddFlip is true:
  //   We are draining SVG bottom (y=33..52) and filling SVG top (y=12..31).
  //   So top sand level (filling) goes from empty to full: progress = pourProgress
  //   Bottom sand level (draining) goes from full to empty: progress = 1 - pourProgress
  // If isOddFlip is false:
  //   We are draining SVG top (y=12..31) and filling SVG bottom (y=33..52).
  //   So top sand level (draining) goes from full to empty: progress = 1 - pourProgress
  //   Bottom sand level (filling) goes from empty to full: progress = pourProgress

  const topProgress = isOddFlip ? pourProgress : 1 - pourProgress;
  const bottomProgress = isOddFlip ? 1 - pourProgress : pourProgress;

  // Clipping rect coordinates
  const topClipY = 31 - (19 * topProgress);
  const topClipHeight = 19 * topProgress;

  const bottomClipY = 52 - (19 * bottomProgress);
  const bottomClipHeight = 19 * bottomProgress;

  // Show stream only between 15% and 98% of progress
  const showStream = isPouring && pourProgress > 0.02 && pourProgress < 0.98;

  return (
    <div 
      className={`relative inline-block cursor-pointer select-none ${className} ${isActive ? 'hourglass-active-breathe' : ''}`}
      onClick={triggerFlip}
      style={{ width: size, height: size, perspective: '300px' }}
      title="Click to flip Hourglass"
    >
      {/* Self-contained breathing keyframe style */}
      {isActive && (
        <style>{`
          @keyframes hourglass-breathe {
            0%, 100% {
              transform: scale(1);
              filter: drop-shadow(0 0 1px rgba(229, 107, 85, 0.2));
            }
            50% {
              transform: scale(1.06);
              filter: drop-shadow(0 0 6px rgba(229, 107, 85, 0.65));
            }
          }
          .hourglass-active-breathe {
            animation: hourglass-breathe 2.4s ease-in-out infinite;
          }
        `}</style>
      )}
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="transition-transform ease-in-out"
        style={{ 
          transform: `rotateX(${rotation}deg)`,
          transitionDuration: '800ms', // Visual glass flip speed
          transformStyle: 'preserve-3d'
        }}
      >
        <defs>
          {/* Clip path for the top bulb sand */}
          <clipPath id="top-sand-clip">
            <rect x="18" y={topClipY} width="28" height={topClipHeight} />
          </clipPath>
          
          {/* Clip path for the bottom bulb sand */}
          <clipPath id="bottom-sand-clip">
            <rect x="18" y={bottomClipY} width="28" height={bottomClipHeight} />
          </clipPath>

          {/* Sand gradient: Warm gold/amber tones */}
          <linearGradient id="sand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f2d072" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#a67c1e" />
          </linearGradient>

          {/* Base/Plate gradient: Ink-green palette */}
          <linearGradient id="base-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#263d32" />
            <stop offset="100%" stopColor="#0d1a13" />
          </linearGradient>

          {/* Pillar gradient: Coral palette */}
          <linearGradient id="pillar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e56b55" />
            <stop offset="100%" stopColor="#b84e3a" />
          </linearGradient>
        </defs>

        {/* Support columns / Base plates: Ink-green palette */}
        <rect x="12" y="6" width="40" height="4" rx="1.5" fill="url(#base-gradient)" stroke="#0d1a13" strokeWidth="1.5" />
        <rect x="12" y="54" width="40" height="4" rx="1.5" fill="url(#base-gradient)" stroke="#0d1a13" strokeWidth="1.5" />
        
        {/* Support Pillars (side rails): Coral accent palette */}
        <line x1="15" y1="10" x2="15" y2="54" stroke="url(#pillar-gradient)" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <line x1="49" y1="10" x2="49" y2="54" stroke="url(#pillar-gradient)" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />

        {/* Semi-transparent Glass vessel background */}
        <path 
          d="M 20 10 C 20 22, 29 27, 29 32 C 29 37, 20 42, 20 54 L 44 54 C 44 42, 35 37, 35 32 C 35 27, 44 22, 44 10 Z" 
          fill="rgba(38, 61, 50, 0.2)" 
          stroke="#d5cdb8" 
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Sand in top bulb */}
        <path 
          d="M 21 12 C 21 21, 29 26, 29 31.5 L 35 31.5 C 35 26, 43 21, 43 12 Z" 
          fill="url(#sand-gradient)"
          clipPath="url(#top-sand-clip)"
        />

        {/* Sand in bottom bulb */}
        <path 
          d="M 21 52 C 21 43, 29 37.5, 29 32.5 L 35 32.5 C 35 37.5, 43 43, 43 52 Z" 
          fill="url(#sand-gradient)"
          clipPath="url(#bottom-sand-clip)"
        />

        {/* Falling Sand Stream */}
        {showStream && (
          <g>
            {/* Main falling stream */}
            <line 
              x1="32" 
              y1="31.5" 
              x2="32" 
              y2="52.5" 
              stroke="#d4af37" 
              strokeWidth="1.5" 
              strokeDasharray="4 2"
              className="animate-pulse"
              style={{
                strokeDashoffset: (pourProgress * 150) % 20,
                animationDuration: '0.2s'
              }}
            />
            {/* Center drip stream splash dots */}
            <circle cx="32" cy="33" r="1" fill="#f2d072" opacity="0.9" />
            <circle cx="32" cy="42" r="0.8" fill="#d4af37" opacity="0.8" />
            <circle cx="32" cy="49" r="1" fill="#a67c1e" opacity="0.9" />
          </g>
        )}

        {/* Reflection highlights on glass */}
        <path 
          d="M 22 13 Q 25 22 28 25" 
          stroke="white" 
          strokeWidth="1" 
          strokeLinecap="round" 
          fill="none" 
          opacity="0.3" 
        />
        <path 
          d="M 42 51 Q 39 42 36 39" 
          stroke="white" 
          strokeWidth="0.75" 
          strokeLinecap="round" 
          fill="none" 
          opacity="0.2" 
        />
      </svg>
    </div>
  );
}
