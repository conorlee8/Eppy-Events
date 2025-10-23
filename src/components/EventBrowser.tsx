'use client'

import { useState, useEffect, useMemo } from 'react'
import { Drawer } from 'vaul'
import type { Event } from '@/types'
import MobileEventCard from './MobileEventCard'
import SimpleFilters, { type FilterState } from './SimpleFilters'

interface EventBrowserProps {
  events: Event[]
  title?: string
  searchQuery?: string
}

export default function EventBrowser({ events, title = 'Top Events', searchQuery = '' }: EventBrowserProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    dateRange: 'anytime',
    priceRange: [0, 100]
  })

  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    if (isMobile && events.length > 0 && events.length < 100) {
      setIsOpen(true)
    }
  }, [events.length])

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.categories.length > 0) {
        const eventCat = event.category.toLowerCase()
        const hasMatch = filters.categories.some(filterCat => {
          const fCat = filterCat.toLowerCase()
          return eventCat === fCat || (fCat === 'art' && eventCat === 'arts') || (fCat === 'markets' && eventCat === 'markets')
        })
        if (!hasMatch) return false
      }
      if (filters.priceRange[1] < 100) {
        if (event.price > filters.priceRange[1]) return false
      }
      return true
    })
  }, [events, filters])

  const eventCounts = useMemo(() => {
    return {
      music: events.filter(e => e.category.toLowerCase() === 'music').length,
      food: events.filter(e => e.category.toLowerCase() === 'food').length,
      art: events.filter(e => e.category.toLowerCase() === 'arts').length,
      sports: events.filter(e => e.category.toLowerCase() === 'sports').length,
      markets: events.filter(e => e.category.toLowerCase() === 'markets').length,
      community: events.filter(e => e.category.toLowerCase() === 'community').length,
    }
  }, [events])

  return (
    <>
      <div className="hidden lg:block fixed left-0 top-[73px] h-[calc(100vh-73px)] w-[220px] z-30 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(0,20,40,0.85) 0%, rgba(0,0,0,0.9) 100%)',
          backdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(0,255,255,0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <SimpleFilters onFilterChange={setFilters} eventCounts={eventCounts} />
      </div>
      <div className="hidden lg:block fixed left-[220px] top-[73px] w-[280px] h-[calc(100vh-73px)] z-20 overflow-y-auto custom-scrollbar"
        style={{
          background: 'linear-gradient(180deg, rgba(0,10,25,0.75) 0%, rgba(0,0,0,0.85) 100%)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(0,255,255,0.1)',
        }}
      >
        <div className="p-4 border-b sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(0,255,255,0.1)', background: 'rgba(0,10,25,0.95)', backdropFilter: 'blur(20px)' }}>
          <h2 className="text-base font-bold text-white mb-1">{filteredEvents.length} Events Found</h2>
        </div>
        <div className="p-3 space-y-3">
          {filteredEvents.map(event => (<div key={event.id} className="transition-all duration-200 hover:scale-[1.02]" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}><MobileEventCard event={event} variant="compact" /></div>))}
          {filteredEvents.length === 0 && (<div className="flex flex-col items-center justify-center text-center p-8 mt-12"><div className="text-5xl mb-3 opacity-20">ðŸŽ­</div><h3 className="text-base font-bold text-white mb-2">No events found</h3><p className="text-xs text-gray-400">Try adjusting your filters</p></div>)}
        </div>
      </div>
      <button onClick={() => setIsOpen(true)} className="lg:hidden fixed bottom-24 right-6 w-16 h-16 rounded-full flex items-center justify-center z-40 transition-all duration-300 active:scale-95" style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)', boxShadow: '0 0 30px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 100, 255, 0.3), 0 4px 20px rgba(0,0,0,0.4)', animation: 'orb-pulse 2s ease-in-out infinite' }}>
        <div className="text-2xl">ðŸŽ­</div>
        {filteredEvents.length > 0 && (<div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-900">{filteredEvents.length > 99 ? '99+' : filteredEvents.length}</div>)}
      </button>
      <Drawer.Root open={isOpen} onOpenChange={setIsOpen} snapPoints={[0.33, 0.66, 0.9]} fadeFromIndex={0}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl outline-none" style={{ background: 'linear-gradient(180deg, rgba(10,20,40,0.98) 0%, rgba(0,0,0,0.98) 100%)', backdropFilter: 'blur(40px)', boxShadow: '0 -10px 50px rgba(0, 0, 0, 0.5), 0 -2px 0 rgba(0, 255, 255, 0.3)', maxHeight: '90vh' }}>
            <Drawer.Title className="sr-only">{searchQuery ? `Search: "${searchQuery}"` : title}</Drawer.Title>
            <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1.5 bg-gray-600 rounded-full" /></div>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,255,255,0.2)' }}>
              <div><h2 className="text-xl font-bold text-white">{filteredEvents.length} Events</h2></div>
              <button onClick={() => setIsOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="border-b" style={{ borderBottom: '1px solid rgba(0,255,255,0.1)' }}><SimpleFilters onFilterChange={setFilters} eventCounts={eventCounts} /></div>
              <div className="p-4 space-y-3">
                {filteredEvents.map(event => (<MobileEventCard key={event.id} event={event} variant="large" />))}
                {filteredEvents.length === 0 && (<div className="flex flex-col items-center justify-center h-full text-center p-8"><div className="text-6xl mb-4 opacity-20">ðŸŽ­</div><h3 className="text-lg font-bold text-white mb-2">No events found</h3><p className="text-sm text-gray-400">Try adjusting your filters</p></div>)}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes orb-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(0, 200, 255, 0.6), 0 0 60px rgba(0, 100, 255, 0.3), 0 4px 20px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 40px rgba(0, 200, 255, 0.8), 0 0 80px rgba(0, 100, 255, 0.5), 0 4px 20px rgba(0,0,0,0.4); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,200,255,0.5); }
      `}} />
    </>
  )
}


