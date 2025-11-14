'use client'

import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline'
import type { Event } from '@/types'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  events?: Event[]
  onEventSelect?: (event: Event) => void
  compact?: boolean
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search events...",
  events = [],
  onEventSelect,
  compact = false
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [filteredResults, setFilteredResults] = useState<Event[]>([])
  const searchRef = useRef<HTMLDivElement>(null)

  // Filter events based on search query
  useEffect(() => {
    if (value.trim() && events.length > 0) {
      const query = value.toLowerCase()
      const results = events.filter(event =>
        event.title?.toLowerCase().includes(query) ||
        event.venue_name?.toLowerCase().includes(query) ||
        event.venue_address?.toLowerCase().includes(query)
      ).slice(0, 8) // Limit to 8 results

      setFilteredResults(results)
      setShowResults(results.length > 0)
    } else {
      setFilteredResults([])
      setShowResults(false)
    }
  }, [value, events])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClear = () => {
    onChange('')
    setShowResults(false)
  }

  const handleResultClick = (event: Event) => {
    onChange(event.title || '')
    setShowResults(false)
    setIsFocused(false)
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

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className={`
        relative flex items-center backdrop-blur-xl rounded-xl border transition-all duration-200
        ${isFocused
          ? 'bg-gray-900/95 border-cyan-500/50 ring-2 ring-cyan-500/20 shadow-lg shadow-cyan-500/10'
          : 'bg-gray-900/80 border-gray-700/50 hover:border-gray-600/50'
        }
        ${compact ? 'h-9' : 'h-10'}
      `}>
        <MagnifyingGlassIcon className={`absolute left-3 text-gray-400 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className={`
            w-full bg-transparent text-white placeholder-gray-500
            focus:outline-none focus:ring-0 border-0
            ${compact ? 'pl-9 pr-9 py-1.5 text-sm' : 'pl-10 pr-10 py-2 text-sm'}
          `}
        />

        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-0.5 text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/98 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[100] max-h-[400px] overflow-y-auto">
          {/* Results Header */}
          <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
            <span className="text-xs font-medium text-gray-400">
              {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'} found
            </span>
          </div>

          {/* Results List */}
          <div className="py-1">
            {filteredResults.map((event, index) => {
              const badge = getPopularityBadge(event.busyness || 50)

              return (
                <button
                  key={event.id}
                  onClick={() => handleResultClick(event)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-800/50 transition-colors text-left group"
                >
                  {/* Event Image or Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/20 to-cyan-600/20 border border-purple-500/20 flex items-center justify-center overflow-hidden">
                    {event.photo_url ? (
                      <img
                        src={event.photo_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MapPinIcon className="w-6 h-6 text-purple-400" />
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                        {event.title || event.venue_name}
                      </h4>
                      <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase border rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    {event.venue_name && event.venue_name !== event.title && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {event.venue_name}
                      </p>
                    )}

                    {event.venue_address && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3" />
                        {event.venue_address}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer Tip */}
          <div className="px-4 py-2 bg-gray-800/30 border-t border-gray-700/50">
            <span className="text-[10px] text-gray-500">
              💡 Click any result to view on map
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
