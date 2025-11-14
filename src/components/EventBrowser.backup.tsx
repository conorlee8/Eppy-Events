'use client'

import { useState, useEffect, useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { Drawer } from 'vaul'
import type { Event } from '@/types'
import MobileEventCard from './MobileEventCard'

interface EventBrowserProps {
  events: Event[]
  title?: string
  searchQuery?: string
}

export default function EventBrowser({ events, title = 'Top Events', searchQuery = '' }: EventBrowserProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Open drawer automatically when events change (e.g., from hexagon click) - MOBILE ONLY
  useEffect(() => {
    // Only auto-open on mobile when we have a filtered subset
    const isMobile = window.innerWidth < 1024
    if (isMobile && events.length > 0 && events.length < 100) {
      setIsOpen(true)
    }
  }, [events.length])

  // Separate featured vs regular events
  const featured = events.filter(e => e.popularity > 70).slice(0, 5)
  const regular = events.filter(e => !featured.includes(e))

  // Embla Carousel setup with autoplay
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      skipSnaps: false,
    },
    [Autoplay({ delay: 4000, stopOnInteraction: true })]
  )

  return (
    <>
      {/* DESKTOP: Glassmorphic sidebar - 280px */}
      <div className="hidden lg:block fixed left-0 top-[73px] h-[calc(100vh-73px)] w-[280px] z-30 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(0,20,40,0.85) 0%, rgba(0,0,0,0.9) 100%)',
          backdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(0,255,255,0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b"
          style={{
            borderBottom: '1px solid rgba(0,255,255,0.1)',
            background: 'linear-gradient(90deg, rgba(0,200,255,0.05), rgba(150,0,255,0.05))',
          }}
        >
          <h2 className="text-lg font-bold text-white mb-1">
            {searchQuery ? `Search: "${searchQuery}"` : title}
          </h2>
          <p className="text-xs text-gray-400">
            {events.length} event{events.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-72px)] overflow-y-auto p-4 space-y-5 custom-scrollbar">
          {/* Happening Now - Auto-rotating Carousel */}
          {featured.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-base">⚡</span>
                <span>Happening Now</span>
              </h3>

              {/* Embla Carousel */}
              <div className="overflow-hidden -mx-2" ref={emblaRef}>
                <div className="flex gap-3 px-2">
                  {featured.map(event => (
                    <div
                      key={event.id}
                      className="flex-[0_0_190px] min-w-0 transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        filter: 'drop-shadow(0 4px 12px rgba(0,200,255,0.2))',
                      }}
                    >
                      <MobileEventCard event={event} variant="compact" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Carousel indicators */}
              <div className="flex justify-center gap-1.5 mt-3">
                {featured.map((_, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-500/30 transition-all"
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Events Grid */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-base">🎯</span>
              <span>All Events</span>
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {regular.map(event => (
                <div
                  key={event.id}
                  className="transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                  }}
                >
                  <MobileEventCard event={event} variant="compact" />
                </div>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="text-5xl mb-3 opacity-20">🎭</div>
              <h3 className="text-base font-bold text-white mb-2">No events found</h3>
              <p className="text-xs text-gray-400">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE: Floating Orb Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-24 right-6 w-16 h-16 rounded-full flex items-center justify-center z-40 transition-all duration-300 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)',
          boxShadow: '0 0 30px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 100, 255, 0.3), 0 4px 20px rgba(0,0,0,0.4)',
          animation: 'orb-pulse 2s ease-in-out infinite',
        }}
      >
        <div className="text-2xl">🎭</div>
        {events.length > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-900">
            {events.length > 99 ? '99+' : events.length}
          </div>
        )}
      </button>

      {/* MOBILE: Vaul Drawer with Snap Points */}
      <Drawer.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPoints={[0.33, 0.66, 0.9]}
        fadeFromIndex={0}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl outline-none"
            style={{
              background: 'linear-gradient(180deg, rgba(10,20,40,0.98) 0%, rgba(0,0,0,0.98) 100%)',
              backdropFilter: 'blur(40px)',
              boxShadow: '0 -10px 50px rgba(0, 0, 0, 0.5), 0 -2px 0 rgba(0, 255, 255, 0.3)',
              maxHeight: '90vh',
            }}
          >
            {/* Accessible title for screen readers */}
            <Drawer.Title className="sr-only">
              {searchQuery ? `Search: "${searchQuery}"` : title}
            </Drawer.Title>

            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{
                borderBottom: '1px solid rgba(0,255,255,0.2)',
              }}
            >
              <div>
                <h2 className="text-xl font-bold text-white">
                  {searchQuery ? `Search: "${searchQuery}"` : title}
                </h2>
                <p className="text-sm text-gray-400">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Happening Now - Mobile Carousel */}
              {featured.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <span>Happening Now</span>
                  </h3>
                  <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory -mx-4 px-4">
                    {featured.map(event => (
                      <div key={event.id} className="snap-start flex-shrink-0 w-[200px]">
                        <MobileEventCard event={event} variant="compact" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Events */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <span>All Events</span>
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {regular.map(event => (
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
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes orb-pulse {
          0%, 100% {
            box-shadow: 0 0 30px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 100, 255, 0.3), 0 4px 20px rgba(0,0,0,0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 200, 255, 0.8), 0 0 80px rgba(0, 100, 255, 0.5), 0 4px 20px rgba(0,0,0,0.4);
          }
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,200,255,0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,200,255,0.5);
        }
      `}} />
    </>
  )
}
