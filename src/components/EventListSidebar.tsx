'use client'

import { useState, useEffect } from 'react'
import type { Event } from '@/types'
import MobileEventCard from './MobileEventCard'
import { getEventImage } from '@/lib/eventImages'

interface EventListSidebarProps {
  events: Event[]
  isVisible: boolean
  onClose: () => void
  title?: string
}

export default function EventListSidebar({
  events,
  isVisible,
  onClose,
  title = 'Events'
}: EventListSidebarProps) {
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([])
  const [regularEvents, setRegularEvents] = useState<Event[]>([])

  useEffect(() => {
    // Separate high-popularity events for featured carousel
    const featured = events
      .filter(e => e.popularity > 70)
      .slice(0, 5) // Max 5 featured

    const regular = events.filter(e => !featured.includes(e))

    setFeaturedEvents(featured)
    setRegularEvents(regular)
  }, [events])

  if (!isVisible || events.length === 0) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div
        className="fixed top-0 left-0 h-full w-full sm:w-[400px] z-50 bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl shadow-2xl transition-transform duration-500 ease-out overflow-hidden"
        style={{
          transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
          borderRight: '1px solid rgba(0,255,255,0.2)',
        }}
      >
        {/* Header */}
        <div className="relative p-4 border-b border-cyan-500/20">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-xl font-bold text-white mb-1 ml-10">
            {title}
          </h2>
          <p className="text-sm text-gray-400 ml-10">
            {events.length} event{events.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-80px)] overflow-y-auto p-4 space-y-6">
          {/* Netflix-Style Horizontal Carousel */}
          {featuredEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <span>Featured Events</span>
              </h3>

              <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent -mx-4 px-4">
                {featuredEvents.map(event => (
                  <div key={event.id} className="snap-start flex-shrink-0 w-[300px]">
                    <MobileEventCard event={event} variant="large" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Browse All Events - Vertical Grid */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span>All Events</span>
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {regularEvents.map(event => (
                <MobileEventCard key={event.id} event={event} variant="large" />
              ))}
            </div>
          </div>

          {/* Empty State */}
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="text-6xl mb-4 opacity-20">🎭</div>
              <h3 className="text-lg font-bold text-white mb-2">No events found</h3>
              <p className="text-sm text-gray-400">
                Try selecting a different neighborhood or adjusting your filters
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 255, 0.3);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 255, 0.5);
        }
      `}</style>
    </>
  )
}
