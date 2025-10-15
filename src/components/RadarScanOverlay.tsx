'use client'

import { useEffect, useState } from 'react'

interface RadarScanOverlayProps {
  progress: number // 0 to 1
  userLocation: [number, number]
  onComplete?: () => void
}

export function RadarScanOverlay({ progress, userLocation, onComplete }: RadarScanOverlayProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (progress >= 1 && onComplete) {
      onComplete()
    }
  }, [progress, onComplete])

  if (!mounted) return null

  // Use CSS animations for smooth, hardware-accelerated rendering
  const animationDuration = '3s'

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Dark overlay that fades out */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          animation: `fadeOut ${animationDuration} ease-out forwards`,
        }}
      />

      {/* Radar sweep effect */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {/* Expanding ring - pure CSS animation */}
        <div
          className="absolute rounded-full border-2 border-blue-400"
          style={{
            width: '0vh',
            height: '0vh',
            animation: `expandRing ${animationDuration} ease-out forwards`,
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)',
          }}
        />

        {/* Rotating radar beam - pure CSS animation */}
        <div
          className="absolute w-[300vh] h-[300vh]"
          style={{
            animation: `rotate360 ${animationDuration} linear forwards`,
          }}
        >
          {/* Radar beam gradient */}
          <div
            className="absolute top-1/2 left-1/2 origin-left -translate-y-1/2"
            style={{
              width: '150vh',
              height: '2px',
              background: 'linear-gradient(to right, rgba(59, 130, 246, 0.9), transparent)',
            }}
          />
        </div>

        {/* Center pulse point */}
        <div className="absolute">
          <div
            className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"
            style={{
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.9)',
            }}
          />
        </div>

        {/* Scanning text overlay */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <div className="bg-gray-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-blue-500/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md animate-pulse" />
                <div className="relative w-2 h-2 bg-blue-500 rounded-full" />
              </div>
              <span className="text-blue-400 text-sm font-medium tracking-wider">
                {progress < 0.3 && 'INITIALIZING SCAN...'}
                {progress >= 0.3 && progress < 0.6 && 'DETECTING EVENTS...'}
                {progress >= 0.6 && progress < 0.9 && 'ANALYZING ZONES...'}
                {progress >= 0.9 && 'SCAN COMPLETE'}
              </span>
              <span className="text-blue-300 text-xs font-mono">
                {Math.round(progress * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Completion flash */}
        {progress >= 0.98 && (
          <div
            className="absolute inset-0 bg-blue-500/20"
            style={{
              animation: 'flash 0.3s ease-out',
            }}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes fadeOut {
          0% { opacity: 0.7; }
          100% { opacity: 0; }
        }

        @keyframes expandRing {
          0% {
            width: 0vh;
            height: 0vh;
            opacity: 0.8;
          }
          100% {
            width: 300vh;
            height: 300vh;
            opacity: 0;
          }
        }

        @keyframes rotate360 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 0.3; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
