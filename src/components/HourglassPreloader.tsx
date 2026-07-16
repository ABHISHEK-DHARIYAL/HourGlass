import React from 'react';

interface HourglassPreloaderProps {
  loadingText?: string;
  onFinishedLoading?: () => void;
}

export default function HourglassPreloader({ loadingText = "Opening Hourglass..." }: HourglassPreloaderProps) {
  return (
    <div 
      id="hourglass-preloader-container" 
      className="fixed inset-0 z-50 flex flex-col justify-center items-center select-none"
      style={{ backgroundColor: '#0C1C15' }}
    >
      {/* Standalone Styling for keyframe animations */}
      <style>{`
        /* Container rotation and physical slide shift keyframes */
        @keyframes preloader-hourglass-flip {
          0% {
            transform: rotate(0deg) translateX(0);
          }
          /* Draining phase (0% - 65%): completely static */
          65% {
            transform: rotate(0deg) translateX(0);
          }
          /* Minor horizontal slide shift / settle shake (65% - 73%) */
          67% {
            transform: rotate(0deg) translateX(-6px);
          }
          69% {
            transform: rotate(0deg) translateX(6px);
          }
          71% {
            transform: rotate(0deg) translateX(-3px);
          }
          73% {
            transform: rotate(0deg) translateX(0);
          }
          /* Waiting moment before flip (73% - 76%) */
          76% {
            transform: rotate(0deg);
          }
          /* Smooth flip/rotation transition (76% - 90%) */
          90% {
            transform: rotate(180deg);
          }
          /* Pause before next loop */
          100% {
            transform: rotate(180deg);
          }
        }

        /* Top sand draining out keyframes */
        @keyframes preloader-sand-drain {
          0% {
            transform: scaleY(1);
          }
          /* Draining from 0% to 65% */
          65% {
            transform: scaleY(0);
          }
          100% {
            transform: scaleY(0);
          }
        }

        /* Bottom sand filling up keyframes */
        @keyframes preloader-sand-fill {
          0% {
            transform: scaleY(0);
          }
          /* Filling from 0% to 65% */
          65% {
            transform: scaleY(1);
          }
          100% {
            transform: scaleY(1);
          }
        }

        /* Continuous flow dash offset for sand stream */
        @keyframes preloader-sand-flow {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -20;
          }
        }

        /* Sand stream visibility keyframes */
        @keyframes preloader-stream-visibility {
          0% {
            opacity: 1;
            transform: scaleY(1);
          }
          63% {
            opacity: 1;
            transform: scaleY(1);
          }
          65% {
            opacity: 0;
            transform: scaleY(0);
          }
          100% {
            opacity: 0;
            transform: scaleY(0);
          }
        }

        /* Tiny sand impact particles at bottom neck entry */
        @keyframes preloader-sand-splash {
          0%, 100% {
            transform: scale(0.6) translateY(0);
            opacity: 0;
          }
          5%, 60% {
            transform: scale(1.1) translateY(1px);
            opacity: 0.8;
          }
          64% {
            transform: scale(0.6) translateY(0);
            opacity: 0;
          }
        }

        /* Apply animations to classes */
        .anim-hourglass-body {
          animation: preloader-hourglass-flip 4.5s cubic-bezier(0.77, 0, 0.175, 1) infinite;
          transform-origin: 50px 70px;
        }

        .anim-sand-drain {
          animation: preloader-sand-drain 4.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          transform-origin: 50px 66px;
        }

        .anim-sand-fill {
          animation: preloader-sand-fill 4.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          transform-origin: 50px 120px;
        }

        .anim-sand-stream {
          animation: 
            preloader-sand-flow 0.4s linear infinite,
            preloader-stream-visibility 4.5s ease-in-out infinite;
          transform-origin: 50px 66px;
        }

        .anim-sand-splash {
          animation: preloader-sand-splash 4.5s ease-in-out infinite;
          transform-origin: 50px 115px;
        }

        .glass-glow {
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.15));
        }
      `}</style>

      {/* Main Preloader Artwork Frame */}
      <div className="relative flex flex-col items-center">
        {/* Animated Hourglass Container */}
        <div className="w-[180px] h-[220px] flex items-center justify-center relative">
          <svg 
            width="100" 
            height="140" 
            viewBox="0 0 100 140" 
            className="anim-hourglass-body glass-glow"
          >
            <defs>
              {/* Golden shimmering sand linear gradient */}
              <linearGradient id="sand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF1B0" />
                <stop offset="50%" stopColor="#E5C158" />
                <stop offset="100%" stopColor="#B38D1E" />
              </linearGradient>
              
              {/* Subtle glass reflection gradient */}
              <linearGradient id="glass-reflection" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
                <stop offset="40%" stopColor="rgba(255, 255, 255, 0.02)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.25)" />
              </linearGradient>
            </defs>

            {/* Falling Sand Stream (Line with dash array moving) */}
            <line 
              x1="50" 
              y1="66" 
              x2="50" 
              y2="120" 
              stroke="url(#sand-gradient)" 
              strokeWidth="2.5" 
              strokeDasharray="6, 6" 
              className="anim-sand-stream"
            />

            {/* Top Sand (Drains out) */}
            <path 
              d="M 26 20
                 L 74 20
                 C 74 46, 53 60, 52 66
                 L 48 66
                 C 47 60, 26 46, 26 20
                 Z" 
              fill="url(#sand-gradient)"
              className="anim-sand-drain"
            />

            {/* Bottom Sand (Fills up) */}
            <path 
              d="M 26 120
                 L 74 120
                 C 74 94, 53 80, 52 74
                 L 48 74
                 C 47 80, 26 94, 26 120
                 Z" 
              fill="url(#sand-gradient)"
              className="anim-sand-fill"
            />

            {/* Shimmering sand mound splash at bottom center */}
            <ellipse 
              cx="50" 
              cy="116" 
              rx="9" 
              ry="4" 
              fill="#FFF1B0" 
              className="anim-sand-splash"
            />

            {/* Outer Glass Body (Symmetrical outline) */}
            <path 
              d="M 22 16
                 C 22 45, 45 62, 45 70
                 C 45 78, 22 95, 22 124
                 L 78 124
                 C 78 95, 55 78, 55 70
                 C 55 62, 78 45, 78 16
                 Z" 
              fill="url(#glass-reflection)" 
              stroke="#ffffff" 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />

            {/* Top Cap Rim */}
            <rect 
              x="14" 
              y="10" 
              width="72" 
              height="6" 
              rx="3" 
              fill="#ffffff" 
            />

            {/* Bottom Cap Rim */}
            <rect 
              x="14" 
              y="124" 
              width="72" 
              height="6" 
              rx="3" 
              fill="#ffffff" 
            />
          </svg>
        </div>

        {/* Loading Label and Subtitle */}
        <div className="mt-8 text-center px-4 animate-pulse">
          <h2 className="font-serif text-lg text-white font-medium tracking-wide">
            {loadingText}
          </h2>
          <p className="font-mono text-[9px] text-[#E5C158] uppercase tracking-widest mt-1.5 font-bold">
            Compiling Every Second
          </p>
        </div>
      </div>
    </div>
  );
}
