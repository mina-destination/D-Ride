import { useTheme } from '../context/ThemeContext';

export default function BackgroundAnimation() {
  const { theme } = useTheme();

  // Render the transit animation in both themes, adjusting opacity and colors dynamically.

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1 }}>
      {/* Self-contained premium animations */}
      <style>{`
        .transit-grid-container {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0.85;
        }

        .transit-line-1 {
          stroke: var(--primary);
          stroke-width: 1.5;
          stroke-dasharray: 6 8;
          opacity: ${theme === 'dark' ? 0.15 : 0.22};
          animation: routeFlow 25s linear infinite;
        }

        .transit-line-2 {
          stroke: #A855F7; /* Purple express line */
          stroke-width: 1.5;
          stroke-dasharray: 6 8;
          opacity: ${theme === 'dark' ? 0.12 : 0.18};
          animation: routeFlow 35s linear infinite reverse;
        }

        @keyframes routeFlow {
          to {
            stroke-dashoffset: -200;
          }
        }

        .station-glow {
          fill: var(--background);
          stroke-width: 2;
          animation: stationPulse 3s ease-in-out infinite;
        }

        .station-glow-primary {
          stroke: var(--primary);
          box-shadow: 0 0 10px var(--glow-amber);
        }

        .station-glow-purple {
          stroke: #A855F7;
        }

        @keyframes stationPulse {
          0%, 100% {
            r: 4px;
            fill-opacity: 0.8;
            stroke-opacity: 0.6;
          }
          50% {
            r: 7px;
            fill-opacity: 1;
            stroke-opacity: 1;
          }
        }

        .station-ring {
          fill: none;
          stroke-width: 1;
          animation: ringExpand 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
        }

        .station-ring-primary {
          stroke: var(--primary);
        }

        .station-ring-purple {
          stroke: #A855F7;
        }

        @keyframes ringExpand {
          0% {
            r: 6px;
            opacity: 0.8;
          }
          100% {
            r: 22px;
            opacity: 0;
          }
        }

        .neon-bus {
          width: 28px;
          height: 28px;
          transform-origin: center;
        }

        .neon-bus-1 {
          offset-path: path('M-50,300 C300,100 500,600 800,400 C1100,200 1200,700 1490,500');
          animation: moveBus1 45s linear infinite;
          offset-rotate: auto;
        }

        .neon-bus-2 {
          offset-path: path('M1490,250 C1250,350 1050,600 750,450 C500,300 250,750 -50,550');
          animation: moveBus2 55s linear infinite;
          offset-rotate: auto;
        }

        @keyframes moveBus1 {
          0% {
            offset-distance: 0%;
          }
          100% {
            offset-distance: 100%;
          }
        }

        @keyframes moveBus2 {
          0% {
            offset-distance: 0%;
          }
          100% {
            offset-distance: 100%;
          }
        }
      `}</style>

      <svg className="transit-grid-container" viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Route 1: Yellow Main Line */}
        <path d="M-50,300 C300,100 500,600 800,400 C1100,200 1200,700 1490,500" className="transit-line-1" />

        {/* Route 2: Purple Express Line */}
        <path d="M1490,250 C1250,350 1050,600 750,450 C500,300 250,750 -50,550" className="transit-line-2" />

        {/* Stations / Checkpoints along Route 1 */}
        <g>
          {/* Station 1 */}
          <circle cx="380" cy="220" r="4" className="station-glow station-glow-primary" />
          <circle cx="380" cy="220" r="6" className="station-ring station-ring-primary" />

          {/* Station 2 */}
          <circle cx="720" cy="455" r="4" className="station-glow station-glow-primary" />
          <circle cx="720" cy="455" r="6" className="station-ring station-ring-primary" style={{ animationDelay: '1s' }} />

          {/* Station 3 */}
          <circle cx="1080" cy="265" r="4" className="station-glow station-glow-primary" />
          <circle cx="1080" cy="265" r="6" className="station-ring station-ring-primary" style={{ animationDelay: '2s' }} />
        </g>

        {/* Stations / Checkpoints along Route 2 */}
        <g>
          {/* Station 4 */}
          <circle cx="210" cy="620" r="4" className="station-glow station-glow-purple" />
          <circle cx="210" cy="620" r="6" className="station-ring station-ring-purple" style={{ animationDelay: '0.5s' }} />

          {/* Station 5 */}
          <circle cx="610" cy="385" r="4" className="station-glow station-glow-purple" />
          <circle cx="610" cy="385" r="6" className="station-ring station-ring-purple" style={{ animationDelay: '1.5s' }} />

          {/* Station 6 */}
          <circle cx="1180" cy="410" r="4" className="station-glow station-glow-purple" />
          <circle cx="1180" cy="410" r="6" className="station-ring station-ring-purple" style={{ animationDelay: '2.5s' }} />
        </g>
      </svg>

      {/* Glowing Neon Bus 1 (Yellow Line) */}
      <div className="absolute neon-bus neon-bus-1">
        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 6px var(--primary))' }}>
          {/* Bus Outline Wireframe */}
          <path d="M4 18h20V9c0-2-1.5-3-3.5-3h-13C5.5 6 4 7 4 9v9z" stroke="var(--primary)" strokeWidth="1.8" fill="var(--surface)" />
          {/* Wheels */}
          <circle cx="8" cy="20" r="2.5" stroke="var(--primary)" strokeWidth="1.5" fill="var(--surface)" />
          <circle cx="20" cy="20" r="2.5" stroke="var(--primary)" strokeWidth="1.5" fill="var(--surface)" />
          {/* Windows */}
          <path d="M6 9h4v3H6V9zm6 0h4v3h-4V9zm6 0h4v3h-4V9z" fill="var(--primary)" opacity="0.3" />
          {/* Headlight */}
          <circle cx="22" cy="15" r="1" fill="#FFF" style={{ filter: 'drop-shadow(0 0 3px #FFF)' }} />
        </svg>
      </div>

      {/* Glowing Neon Bus 2 (Purple Line) */}
      <div className="absolute neon-bus neon-bus-2">
        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 6px #A855F7)' }}>
          {/* Bus Outline Wireframe (Facing left/driving leftwards) */}
          <path d="M24 18H4V9c0-2 1.5-3 3.5-3h13c1.5 0 3.5 1 3.5 3v9z" stroke="#A855F7" strokeWidth="1.8" fill="var(--surface)" />
          {/* Wheels */}
          <circle cx="20" cy="20" r="2.5" stroke="#A855F7" strokeWidth="1.5" fill="var(--surface)" />
          <circle cx="8" cy="20" r="2.5" stroke="#A855F7" strokeWidth="1.5" fill="var(--surface)" />
          {/* Windows */}
          <path d="M22 9h-4v3h4V9zm-6 0h-4v3h4V9zm-6 0H6v3h4V9z" fill="#A855F7" opacity="0.3" />
          {/* Headlight */}
          <circle cx="6" cy="15" r="1" fill="#FFF" style={{ filter: 'drop-shadow(0 0 3px #FFF)' }} />
        </svg>
      </div>
    </div>
  );
}
