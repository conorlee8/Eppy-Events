'use client'

import { useState } from 'react'
import type { Event } from '@/types'
import { getEventImage } from '@/lib/eventImages'

interface MobileEventCardProps {
  event: Event
  onClick?: () => void
  variant?: 'large' | 'compact'
}

export default function MobileEventCard({ event, onClick, variant = 'large' }: MobileEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = () => {
    setIsExpanded(!isExpanded)
    onClick?.()
  }

  const eventDate = new Date(event.startTime)
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

  return (
    <div
      className={`relative overflow-hidden rounded-xl cursor-pointer group ${
        isExpanded ? 'h-auto' : variant === 'large' ? 'h-[280px]' : 'h-[170px]'
      }`}
      onClick={handleClick}
      style={{
        background: 'linear-gradient(135deg, rgba(0,200,255,0.08), rgba(150,0,255,0.08))',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0,255,255,0.2)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,200,255,0.3), 0 0 20px rgba(0,200,255,0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
      }}
    >
      {/* Collapsed View */}
      <div className={`relative ${variant === 'large' ? 'h-[280px]' : 'h-[170px]'} flex flex-col`}>
        {/* Large Image Section - Top 60% */}
        <div className={`relative ${variant === 'large' ? 'h-[170px]' : 'h-[100px]'} w-full overflow-hidden`}>
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-105"
            style={{
              backgroundImage: `url(${getEventImage(event)})`,
              filter: 'brightness(0.85) contrast(1.1)',
            }}
          />
          {/* Gradient fade to content */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]" />

          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-cyan-500/80 text-white backdrop-blur-sm">
              {event.category}
            </span>
          </div>

          {/* Premium Badge */}
          {event.isPremium && (
            <div className="absolute top-3 right-3">
              <span className="text-[9px] px-2 py-1 bg-gradient-to-r from-purple-500/80 to-pink-500/80 rounded-full border border-purple-400/50 text-white backdrop-blur-sm">
                ⭐ PREMIUM
              </span>
            </div>
          )}
        </div>

        {/* Text Section - Bottom 40% */}
        <div className={`relative ${variant === 'large' ? 'p-4' : 'p-2'} flex flex-col justify-between flex-1`}>
          {/* Title */}
          <div>
            <h3 className={`${variant === 'large' ? 'text-base' : 'text-xs'} font-bold text-white line-clamp-${variant === 'large' ? '2' : '1'} leading-tight mb-1`}>
              {event.title}
            </h3>
          </div>

          {/* Date & Location */}
          <div className="space-y-0.5">
            <div className={`flex items-center gap-1 ${variant === 'large' ? 'text-xs' : 'text-[10px]'} text-gray-300`}>
              <span>📅</span>
              <span className="line-clamp-1">{formattedDate}</span>
            </div>
            {variant === 'large' && (
              <div className="flex items-center gap-1 text-xs text-gray-300 line-clamp-1">
                <span>📍</span>
                <span>{event.venue}</span>
              </div>
            )}
          </div>

          {/* Expand Indicator - only show on large variant */}
          {variant === 'large' && (
            <div className="absolute bottom-2 right-2 text-cyan-400 text-xs opacity-70 transition-transform group-hover:scale-110">
              {isExpanded ? '▲' : '▼'}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className="border-t border-cyan-500/20 p-4 space-y-3 animate-slideDown"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5))',
          }}
        >
          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
              About
            </h4>
            <p className="text-sm text-gray-200 leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Price */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
                Price
              </h4>
              <p className="text-sm text-white font-semibold">
                {event.price.isFree ? 'FREE' : event.price.min && event.price.max ? `$${event.price.min}-$${event.price.max}` : event.price.min ? `$${event.price.min}` : 'TBD'}
              </p>
            </div>

            {/* Popularity */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
                Popularity
              </h4>
              <p className="text-sm text-white font-semibold">
                {event.popularity > 80 ? '🔥 Hot' : event.popularity > 50 ? '⭐ Popular' : '✨ Trending'}
              </p>
            </div>

            {/* Venue */}
            <div className="col-span-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
                Venue
              </h4>
              <p className="text-sm text-white">
                {event.venue}
              </p>
            </div>
          </div>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            className="w-full py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-[1.02]"
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add action (e.g., navigate to event detail page, add to calendar, etc.)
              console.log('Action button clicked:', event.title)
            }}
          >
            View Full Details
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
