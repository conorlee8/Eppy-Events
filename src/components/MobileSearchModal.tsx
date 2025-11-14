'use client'

import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, MapPinIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import type { Event } from '@/types'

interface MobileSearchModalProps {
  isOpen: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  events?: Event[]
  onEventSelect?: (event: Event) => void
}

export function MobileSearchModal({
  isOpen,
  onClose,
  value,
  onChange,
  events = [],
  onEventSelect
}: MobileSearchModalProps) {
  const [filteredResults, setFilteredResults] = useState<Event[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Filter events based on search query
  useEffect(() => {
    if (value.trim() && events.length > 0) {
      const query = value.toLowerCase()
      const results = events.filter(event =>
        event.title?.toLowerCase().includes(query) ||
        event.venue_name?.toLowerCase().includes(query) ||
        event.venue_address?.toLowerCase().includes(query)
      ).slice(0, 20) // More results on mobile full screen

      setFilteredResults(results)
    } else {
      setFilteredResults([])
    }
  }, [value, events])

  const handleClear = () => {
    onChange('')
    setFilteredResults([])
  }

  const handleResultClick = (event: Event) => {
    onChange(event.title || '')
    onClose()
    if (onEventSelect) {
      onEventSelect(event)
    }
  }

  const getPopularityBadge = (busyness: number) => {
    if (busyness >= 86) return { label: 'PACKED', color: 'bg-red-500/20 text-red-300 border-red-500/30' }
    if (busyness >= 66) return { label: 'BUSY', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' }
    if (busyness >= 41) return { label: 'MODERATE', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }
    return { label: 'QUIET', color: 'bg-green-500/20 text-green-300 border-green-500/30' }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex flex-col bg-gray-950">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>

            {/* Search Input */}
            <div className="flex-1 relative">
              <div className="relative flex items-center bg-gray-800 rounded-xl border border-gray-700/50 focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
                <MagnifyingGlassIcon className="absolute left-3 h-5 w-5 text-gray-400" />

                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Search events, venues..."
                  className="w-full pl-10 pr-10 py-2.5 bg-transparent text-white placeholder-gray-500 focus:outline-none text-base"
                />

                {value && (
                  <button
                    onClick={handleClear}
                    className="absolute right-3 p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {value.trim() === '' ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <MagnifyingGlassIcon className="w-16 h-16 text-gray-700 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">Search for events</h3>
              <p className="text-sm text-gray-600">
                Find events by name, venue, or location
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            // No Results
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <span className="text-3xl">😕</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No results found</h3>
              <p className="text-sm text-gray-600">
                Try searching for something else
              </p>
            </div>
          ) : (
            // Results List
            <div className="py-2">
              <div className="px-4 py-2">
                <span className="text-xs font-medium text-gray-500">
                  {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
                </span>
              </div>

              {filteredResults.map((event) => {
                const badge = getPopularityBadge(event.busyness || 50)

                return (
                  <button
                    key={event.id}
                    onClick={() => handleResultClick(event)}
                    className="w-full px-4 py-4 flex items-start gap-3 hover:bg-gray-900/50 active:bg-gray-900 transition-colors text-left border-b border-gray-900/50"
                  >
                    {/* Event Image */}
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-purple-600/20 to-cyan-600/20 border border-purple-500/20 flex items-center justify-center overflow-hidden">
                      {event.photo_url ? (
                        <img
                          src={event.photo_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <MapPinIcon className="w-7 h-7 text-purple-400" />
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-base font-semibold text-white line-clamp-2">
                          {event.title || event.venue_name}
                        </h4>
                      </div>

                      {event.venue_name && event.venue_name !== event.title && (
                        <p className="text-sm text-gray-400 mb-1 truncate">
                          {event.venue_name}
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        {event.venue_address && (
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{event.venue_address}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-2">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase border rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Tip */}
        {filteredResults.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 bg-gray-900/50 backdrop-blur-xl border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              💡 Tap any result to view on map
            </p>
          </div>
        )}
      </div>
    </>
  )
}
