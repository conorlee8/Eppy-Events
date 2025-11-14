'use client'

import { Event } from '@/types'

interface MobileVenueListProps {
  events: Event[]
  onEventClick: (event: Event) => void
  selectedEventId?: string | null
}

export default function MobileVenueList({
  events,
  onEventClick,
  selectedEventId
}: MobileVenueListProps) {

  // Get busyness indicator
  const getBusynessColor = (busyness?: number) => {
    if (!busyness) return 'bg-gray-500'
    if (busyness >= 80) return 'bg-red-500'
    if (busyness >= 60) return 'bg-orange-500'
    if (busyness >= 40) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getBusynessLabel = (busyness?: number) => {
    if (!busyness) return 'Unknown'
    if (busyness >= 80) return 'LIVE'
    if (busyness >= 60) return 'Busy'
    if (busyness >= 40) return 'Moderate'
    return 'Quiet'
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 pb-20">
      {/* Summary Header */}
      <div className="sticky top-0 bg-gradient-to-b from-gray-900 to-gray-900/95 backdrop-blur-sm py-3 mb-2 z-10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing <span className="text-white font-bold">{events.length}</span> venues
          </p>
          <button className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
            Filter
          </button>
        </div>
      </div>

      {/* Venue List */}
      <div className="space-y-2">
        {events.map((event) => {
          const isSelected = selectedEventId === event.id
          const busyness = event.busyness || 50

          return (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className={`w-full text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                  : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800/80 hover:border-gray-600'
              } border rounded-xl p-3 active:scale-[0.98]`}
            >
              <div className="flex items-start gap-3">
                {/* Venue Image/Icon */}
                <div className="flex-shrink-0">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                      <span className="text-2xl">🎵</span>
                    </div>
                  )}
                </div>

                {/* Venue Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-white text-sm line-clamp-1">
                      {event.title}
                    </h3>

                    {/* Busyness Badge */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${getBusynessColor(busyness)} ${busyness >= 80 ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-bold ${
                        busyness >= 80 ? 'text-red-400' :
                        busyness >= 60 ? 'text-orange-400' :
                        busyness >= 40 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {getBusynessLabel(busyness)}
                      </span>
                    </div>
                  </div>

                  {/* Address */}
                  <p className="text-xs text-gray-400 line-clamp-1 mb-1">
                    {event.address || event.venue}
                  </p>

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                      {event.category}
                    </span>
                    {event.subcategory && event.subcategory !== 'UNKNOWN' && (
                      <span className="text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded-full">
                        {event.subcategory}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="mt-2 pt-2 border-t border-cyan-500/30">
                  <p className="text-xs text-cyan-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    Viewing on map
                  </p>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Empty State */}
      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No venues found</h3>
          <p className="text-sm text-gray-400">Try zooming out or moving the map</p>
        </div>
      )}
    </div>
  )
}
