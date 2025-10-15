'use client'

import { useEffect, useRef, useState } from 'react'
import type { Event } from '@/types'
import { getEventImage } from '@/lib/eventImages'

interface HolographicEventCardProps {
  event: Event
  onClose: () => void
  spritePosition: { x: number; y: number }
}

export function HolographicEventCard({ event, onClose, spritePosition }: HolographicEventCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5

    setTilt({ x: -y * 15, y: x * 15 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 600) // Wait for close animation
  }

  // Format date
  const eventDate = new Date(event.startTime)
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const timeStr = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-all duration-500 ${
          isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'
        }`}
        onClick={handleClose}
        style={{ transform: 'none' }}
      />

      {/* Holographic Beam from sprite position */}
      <div
        className={`fixed z-[65] pointer-events-none transition-all duration-800 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: spritePosition.x,
          top: spritePosition.y,
          width: '2px',
          height: '100vh',
          background: 'linear-gradient(to top, rgba(0,255,255,0.8), rgba(0,255,255,0) 40%)',
          boxShadow: '0 0 20px rgba(0,255,255,0.8), 0 0 40px rgba(0,200,255,0.4)',
          transform: 'translateX(-1px)',
        }}
      />

      {/* Holographic Card Container */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
        <div
          ref={cardRef}
          className={`transition-all duration-800 pointer-events-auto ${
            isVisible ? 'holoVisible' : 'holoHidden'
          }`}
          style={{
            transform: `
              rotateX(${tilt.x}deg)
              rotateY(${tilt.y}deg)
              translateZ(50px)
              scale(${isVisible ? 1 : 0.3})
            `,
            width: 'min(420px, 90vw)',
            height: 'min(600px, 85vh)',
            transformStyle: 'preserve-3d',
            perspective: '1000px',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Main card container with holographic effect */}
        <div className="relative w-full h-full rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(150,0,255,0.15))',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(0,255,255,0.3)',
            boxShadow: `
              0 0 60px rgba(0,200,255,0.4),
              inset 0 0 60px rgba(0,255,255,0.1),
              0 20px 80px rgba(0,0,0,0.5)
            `,
          }}
        >
          {/* Scan line removed per user request */}

          {/* Static/glitch texture overlay */}
          <div className="absolute inset-0 opacity-5 pointer-events-none mix-blend-overlay">
            <div className="staticNoise" />
          </div>

          {/* RGB Chromatic aberration edges */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: 'inset 2px 0 0 rgba(255,0,0,0.3), inset -2px 0 0 rgba(0,255,255,0.3)',
            }}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-red-500/20 border border-red-400/50 text-red-300 hover:bg-red-500/40 transition-all duration-300 flex items-center justify-center backdrop-blur-sm"
            style={{
              boxShadow: '0 0 20px rgba(255,0,100,0.4)',
            }}
          >
            ✕
          </button>

          {/* Content */}
          <div className="relative w-full h-full p-4 sm:p-6 flex flex-col overflow-y-auto">
            {/* Event Image - Floating Layer */}
            <div
              className="relative w-full h-40 sm:h-48 rounded-xl overflow-hidden mb-4 sm:mb-6 holoLayer1 flex-shrink-0"
              style={{
                boxShadow: '0 0 30px rgba(0,200,255,0.3)',
                border: '1px solid rgba(0,255,255,0.2)',
              }}
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${getEventImage(event)})`,
                  filter: 'brightness(0.8) contrast(1.2)',
                }}
              />
              {/* Image overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {/* Category badge */}
              <div
                className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2 sm:px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md categoryBadge"
                style={{
                  background: getCategoryGradient(event.category),
                  boxShadow: `0 0 20px ${getCategoryColor(event.category)}`,
                  border: `1px solid ${getCategoryColor(event.category)}`,
                }}
              >
                {event.category.toUpperCase()}
              </div>
            </div>

            {/* Event Details - Floating Layer */}
            <div className="flex-1 flex flex-col space-y-3 sm:space-y-4 holoLayer2 min-h-0">
              {/* Title */}
              <h2
                className="text-xl sm:text-2xl font-bold text-white leading-tight"
                style={{
                  textShadow: '0 0 20px rgba(0,255,255,0.5)',
                }}
              >
                {event.title}
              </h2>

              {/* Date & Time */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-cyan-300 text-sm sm:text-base">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className="text-base sm:text-xl">📅</span>
                  <span className="font-semibold">{dateStr}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-cyan-400" />
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className="text-base sm:text-xl">🕐</span>
                  <span className="font-semibold">{timeStr}</span>
                </div>
              </div>

              {/* Venue */}
              <div className="flex items-center space-x-2 text-purple-300 text-sm sm:text-base">
                <span className="text-base sm:text-xl">📍</span>
                <span className="font-semibold">{event.venue}</span>
              </div>

              {/* Description */}
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed flex-1 overflow-y-auto min-h-0">
                {event.description}
              </p>

              {/* Price */}
              {event.price && (
                <div className="flex items-center space-x-2">
                  <span className="text-base sm:text-xl">💰</span>
                  <span className="text-emerald-400 font-bold text-base sm:text-lg">
                    {event.price === 'Free' ? 'FREE' : `$${event.price}`}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons - Floating Layer */}
            <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6 holoLayer3 flex-shrink-0">
              <button
                className="flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-cyan-500 to-blue-500 border border-cyan-400 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                style={{
                  boxShadow: '0 0 30px rgba(0,200,255,0.4)',
                }}
              >
                Get Tickets
              </button>
              <button
                className="w-12 sm:w-14 py-2.5 sm:py-3 rounded-xl font-bold text-white bg-gradient-to-r from-pink-500 to-purple-500 border border-pink-400 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                style={{
                  boxShadow: '0 0 30px rgba(255,0,150,0.4)',
                }}
              >
                ❤️
              </button>
              <button
                className="w-12 sm:w-14 py-2.5 sm:py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-500 border border-purple-400 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                style={{
                  boxShadow: '0 0 30px rgba(150,0,255,0.4)',
                }}
              >
                🔗
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .holoVisible {
          opacity: 1;
          animation: holoProject 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .holoHidden {
          opacity: 0;
          transform: rotateX(-90deg) scale(0.3) !important;
        }

        @keyframes holoProject {
          0% {
            opacity: 0;
            transform: translateY(100px) scale(0.3) rotateX(-90deg);
          }
          60% {
            opacity: 0.7;
            transform: translateY(-20px) scale(1.05) rotateX(5deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotateX(0deg);
          }
        }

        .scanLine {
          position: absolute;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0,255,255,0.8), transparent);
          box-shadow: 0 0 10px rgba(0,255,255,0.8);
          animation: scan 2s linear infinite;
          pointer-events: none;
          z-index: 10;
        }

        @keyframes scan {
          0% { top: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        .staticNoise {
          width: 100%;
          height: 100%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          animation: staticFlicker 0.1s infinite;
        }

        @keyframes staticFlicker {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.08; }
        }

        .hexGrid {
          width: 100%;
          height: 100%;
          background-image:
            linear-gradient(30deg, rgba(0,255,255,0.05) 12%, transparent 12.5%, transparent 87%, rgba(0,255,255,0.05) 87.5%, rgba(0,255,255,0.05)),
            linear-gradient(150deg, rgba(0,255,255,0.05) 12%, transparent 12.5%, transparent 87%, rgba(0,255,255,0.05) 87.5%, rgba(0,255,255,0.05)),
            linear-gradient(30deg, rgba(0,255,255,0.05) 12%, transparent 12.5%, transparent 87%, rgba(0,255,255,0.05) 87.5%, rgba(0,255,255,0.05)),
            linear-gradient(150deg, rgba(0,255,255,0.05) 12%, transparent 12.5%, transparent 87%, rgba(0,255,255,0.05) 87.5%, rgba(0,255,255,0.05)),
            linear-gradient(60deg, rgba(0,200,255,0.03) 25%, transparent 25.5%, transparent 75%, rgba(0,200,255,0.03) 75%, rgba(0,200,255,0.03)),
            linear-gradient(60deg, rgba(0,200,255,0.03) 25%, transparent 25.5%, transparent 75%, rgba(0,200,255,0.03) 75%, rgba(0,200,255,0.03));
          background-size: 80px 140px;
          background-position: 0 0, 0 0, 40px 70px, 40px 70px, 0 0, 40px 70px;
          animation: hexPulse 4s ease-in-out infinite;
        }

        @keyframes hexPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        .holoLayer1 {
          animation: layerFloat1 3s ease-in-out infinite;
        }

        .holoLayer2 {
          animation: layerFloat2 3.5s ease-in-out infinite;
        }

        .holoLayer3 {
          animation: layerFloat3 4s ease-in-out infinite;
        }

        @keyframes layerFloat1 {
          0%, 100% { transform: translateZ(0px); }
          50% { transform: translateZ(20px); }
        }

        @keyframes layerFloat2 {
          0%, 100% { transform: translateZ(0px); }
          50% { transform: translateZ(10px); }
        }

        @keyframes layerFloat3 {
          0%, 100% { transform: translateZ(0px); }
          50% { transform: translateZ(5px); }
        }

        .categoryBadge {
          animation: badgeSpin 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes badgeSpin {
          0% {
            transform: rotateY(-180deg) scale(0);
            opacity: 0;
          }
          100% {
            transform: rotateY(0deg) scale(1);
            opacity: 1;
          }
        }
      `}} />
    </>
  )
}

function getCategoryColor(category: string): string {
  switch(category.toLowerCase()) {
    case 'music': return 'rgba(255,0,100,0.8)'
    case 'food': return 'rgba(255,150,0,0.8)'
    case 'sports': return 'rgba(0,255,150,0.8)'
    case 'arts': return 'rgba(200,0,255,0.8)'
    case 'technology': return 'rgba(0,200,255,0.8)'
    default: return 'rgba(255,255,0,0.8)'
  }
}

function getCategoryGradient(category: string): string {
  switch(category.toLowerCase()) {
    case 'music': return 'linear-gradient(135deg, rgba(255,0,100,0.3), rgba(255,0,150,0.3))'
    case 'food': return 'linear-gradient(135deg, rgba(255,150,0,0.3), rgba(255,100,0,0.3))'
    case 'sports': return 'linear-gradient(135deg, rgba(0,255,150,0.3), rgba(0,200,100,0.3))'
    case 'arts': return 'linear-gradient(135deg, rgba(200,0,255,0.3), rgba(150,0,200,0.3))'
    case 'technology': return 'linear-gradient(135deg, rgba(0,200,255,0.3), rgba(0,150,255,0.3))'
    default: return 'linear-gradient(135deg, rgba(255,255,0,0.3), rgba(200,200,0,0.3))'
  }
}
