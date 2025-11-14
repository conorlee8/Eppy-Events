'use client'

import { useEffect, useRef, useState } from 'react'
import { Flame, MapPin, Calendar, SlidersHorizontal } from 'lucide-react'
import type { Event } from '@/types'

// Get busyness level and styling
function getBusynessLevel(popularity: number = 70) {
  if (popularity >= 86) {
    return {
      label: 'PACKED',
      color: '#ef4444', // red-500
      bgColor: 'rgba(239, 68, 68, 0.15)',
      pulseSpeed: '0.8s',
      emoji: '🔥'
    }
  } else if (popularity >= 66) {
    return {
      label: 'BUSY',
      color: '#f97316', // orange-500
      bgColor: 'rgba(249, 115, 22, 0.15)',
      pulseSpeed: '1.2s',
      emoji: '🔥'
    }
  } else if (popularity >= 41) {
    return {
      label: 'MODERATE',
      color: '#eab308', // yellow-500
      bgColor: 'rgba(234, 179, 8, 0.15)',
      pulseSpeed: '1.6s',
      emoji: '👥'
    }
  } else {
    return {
      label: 'QUIET',
      color: '#22c55e', // green-500
      bgColor: 'rgba(34, 197, 94, 0.15)',
      pulseSpeed: '2s',
      emoji: '✨'
    }
  }
}

interface ModernEventSidebarProps {
  events: Event[]
  neighborhoodEvents?: Event[]
  neighborhoodName?: string | null
  onFilterClick?: () => void
  hasActiveFilters?: boolean
  onEventClick?: (event: Event) => void
  onClearSelection?: (callback: () => void) => void
  isOpen?: boolean
}

export default function ModernEventSidebar({ events, neighborhoodEvents, neighborhoodName, onFilterClick, hasActiveFilters, onEventClick, onClearSelection, isOpen = true }: ModernEventSidebarProps) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)

  // Get hottest events (top 10 by popularity)
  const hottestEvents = [...events]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 10)

  // Display events (neighborhood events if available, otherwise all events)
  const displayEvents = neighborhoodEvents && neighborhoodEvents.length > 0
    ? neighborhoodEvents
    : events

  // Register clear selection callback with parent
  useEffect(() => {
    if (onClearSelection) {
      onClearSelection(() => {
        setSelectedEventId(null)
      })
    }
  }, [onClearSelection])

  // Manual scroll navigation
  const scrollCarousel = (direction: 'left' | 'right') => {
    const carousel = carouselRef.current
    if (!carousel) return

    const scrollAmount = 340 // Scroll 2 cards at a time
    const targetScroll = carousel.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount)

    carousel.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    })
  }

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const carousel = carouselRef.current
    if (!carousel) return

    setIsDragging(true)
    setHasDragged(false)

    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX
    setStartX(pageX - carousel.offsetLeft)
    setScrollLeft(carousel.scrollLeft)
  }

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return

    const carousel = carouselRef.current
    if (!carousel) return

    e.preventDefault()

    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX
    const x = pageX - carousel.offsetLeft
    const walk = (x - startX) * 2 // Multiply by 2 for faster scrolling

    // If moved more than 5px, consider it a drag (not a click)
    if (Math.abs(walk) > 5) {
      setHasDragged(true)
    }

    carousel.scrollLeft = scrollLeft - walk
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    // Reset hasDragged after a short delay to allow click prevention
    setTimeout(() => setHasDragged(false), 100)
  }

  // Auto-scroll carousel infinitely (pauses when user hovers or drags)
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    let scrollPosition = 0
    const scrollSpeed = 0.5 // pixels per frame
    let animationId: number
    let isPaused = false

    const animate = () => {
      // Pause when hovering OR dragging
      if (!isPaused && !isDragging) {
        scrollPosition += scrollSpeed

        // Reset when scrolled past half (seamless loop)
        if (scrollPosition >= carousel.scrollWidth / 2) {
          scrollPosition = 0
        }

        carousel.scrollLeft = scrollPosition
      }
      animationId = requestAnimationFrame(animate)
    }

    // Start animation
    animationId = requestAnimationFrame(animate)

    // Pause on hover
    const handleMouseEnter = () => { isPaused = true }
    const handleMouseLeave = () => { isPaused = false }

    carousel.addEventListener('mouseenter', handleMouseEnter)
    carousel.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      cancelAnimationFrame(animationId)
      carousel.removeEventListener('mouseenter', handleMouseEnter)
      carousel.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isDragging])

  return (
    <div
      className="hidden lg:flex fixed z-20 transition-all duration-300 ease-in-out rounded-2xl flex-col"
      style={{
        top: '56px',
        left: isOpen ? '16px' : '-400px',
        width: '360px',
        maxHeight: 'calc(100vh - 72px)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.3)',
        background: 'rgba(15,15,35,0.98)',
        backdropFilter: 'blur(40px)',
        border: '2px solid rgba(100,200,255,0.3)'
      }}
    >

      {/* Top: Infinite Auto-Scroll Carousel - "Trending Now" */}
      <div className="flex-shrink-0 group/carousel relative rounded-t-2xl" style={{ height: '140px', background: 'rgba(255,50,100,0.08)' }}>
        {/* Header */}
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2" style={{ background: 'rgba(255,50,100,0.15)', height: '40px' }}>
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-bold text-white">Trending Now</h3>
          <div className="ml-auto text-xs text-orange-400 font-semibold animate-pulse">LIVE</div>
        </div>

        {/* Left Arrow - Netflix Style */}
        <button
          onClick={() => scrollCarousel('left')}
          className="absolute left-0 top-[50%] translate-y-[-50%] z-10 w-10 h-20 bg-black/60 hover:bg-black/80 opacity-0 group-hover/carousel:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
          style={{ top: 'calc(50% + 20px)' }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Right Arrow - Netflix Style */}
        <button
          onClick={() => scrollCarousel('right')}
          className="absolute right-0 top-[50%] translate-y-[-50%] z-10 w-10 h-20 bg-black/60 hover:bg-black/80 opacity-0 group-hover/carousel:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
          style={{ top: 'calc(50% + 20px)' }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Infinite Scroll Carousel - Draggable */}
        <div
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto select-none items-center"
          style={{
            scrollBehavior: 'auto',
            cursor: isDragging ? 'grabbing' : 'grab',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '20px 16px',
            height: '100px'
          }}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Duplicate events for seamless infinite loop */}
          {[...hottestEvents, ...hottestEvents].map((event, idx) => {
            const isSelected = selectedEventId === event.id
            const busyness = getBusynessLevel(event.popularity)
            return (
              <div
                key={`${event.id}-${idx}`}
                onClick={(e) => {
                  // Prevent click if user was dragging
                  if (hasDragged) {
                    e.preventDefault()
                    return
                  }
                  setSelectedEventId(event.id)
                  onEventClick?.(event)
                }}
                className={`flex-shrink-0 w-[100px] h-[60px] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group relative ${
                  isSelected
                    ? 'scale-110 ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/50'
                    : 'hover:scale-[1.3] hover:z-10 hover:shadow-2xl'
                }`}
                style={{
                  backgroundImage: `url(${event.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:from-black/90" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <h4 className="text-[10px] font-bold text-white line-clamp-1 group-hover:text-orange-300 transition-colors mb-0.5">
                  {event.title}
                </h4>

                {/* Pulsing Popularity Indicator */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: busyness.color,
                      animation: `pulse-dot ${busyness.pulseSpeed} ease-in-out infinite`,
                      boxShadow: `0 0 8px ${busyness.color}`
                    }}
                  />
                  <span className="text-[9px] font-bold" style={{ color: busyness.color }}>
                    {busyness.label}
                  </span>
                </div>
              </div>

              {/* Top-right: Pulsing Dot Badge */}
              <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full backdrop-blur-md" style={{ backgroundColor: busyness.bgColor }}>
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: busyness.color,
                    animation: `pulse-dot ${busyness.pulseSpeed} ease-in-out infinite`,
                    boxShadow: `0 0 6px ${busyness.color}`
                  }}
                />
                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: busyness.color }}>
                  {busyness.label}
                </span>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {/* Bottom: Vertical Snap-Scroll Feed */}
      <div className="flex-1 overflow-hidden rounded-b-2xl"
        style={{
          background: 'transparent'
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-2 py-1 border-b border-white/10"
          style={{
            background: 'rgba(0,10,25,0.95)',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold text-white">
                {neighborhoodName || 'All Events'}
              </h3>
            </div>
            {/* Integrated Filter Button */}
            {onFilterClick && (
              <button
                onClick={onFilterClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-700 bg-[#1a1a1a]/90 hover:border-gray-600 hover:bg-[#222]/95 transition-all duration-200"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-gray-300" />
                <span className="text-xs font-semibold text-white">Filters</span>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">{displayEvents.length} events found</p>
        </div>

        {/* Snap-Scroll Vertical Feed */}
        <div
          className="overflow-y-auto h-[calc(100%-60px)] snap-y snap-mandatory custom-scrollbar"
          style={{
            scrollBehavior: 'smooth'
          }}
        >
          {displayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="text-6xl mb-4 opacity-20">🎭</div>
              <h3 className="text-lg font-bold text-white mb-2">No events found</h3>
              <p className="text-sm text-gray-400">Try exploring other neighborhoods</p>
            </div>
          ) : (
            displayEvents.map((event, idx) => {
              const isSelected = selectedEventId === event.id
              const busyness = getBusynessLevel(event.popularity)
              return (
                <div
                  key={event.id}
                  className={`snap-start p-4 border-b cursor-pointer transition-all duration-500 group ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-400/40 shadow-lg shadow-cyan-400/20 scale-[1.02]'
                      : 'border-white/5 hover:bg-white/5'
                  }`}
                  onClick={() => {
                    setSelectedEventId(event.id)
                    onEventClick?.(event)
                  }}
                >
                {/* Event Card */}
                <div className="flex gap-3">
                  {/* Image */}
                  <div
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden group-hover:scale-105 transition-transform"
                    style={{
                      backgroundImage: `url(${event.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200'})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    {/* Category Badge */}
                    <div className="w-full h-full bg-gradient-to-t from-black/60 to-transparent flex items-end p-1.5">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                        {event.category}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white line-clamp-2 group-hover:text-cyan-300 transition-colors mb-1">
                      {event.title}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span className="truncate">
                        {new Date(event.startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{event.venue}</span>
                    </div>
                  </div>

                  {/* Pulsing Popularity Indicator */}
                  <div className="flex-shrink-0 flex flex-col items-end justify-between">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg backdrop-blur-sm" style={{ backgroundColor: busyness.bgColor }}>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: busyness.color,
                          animation: `pulse-dot ${busyness.pulseSpeed} ease-in-out infinite`,
                          boxShadow: `0 0 10px ${busyness.color}`
                        }}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: busyness.color }}>
                        {busyness.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              )
            })
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(6,182,212,0.5), rgba(8,145,178,0.5));
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(6,182,212,0.7), rgba(8,145,178,0.7));
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  )
}
