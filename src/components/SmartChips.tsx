'use client'

import { useState, useEffect } from 'react'
import type { Event } from '@/types'

interface SmartChipsProps {
  events: Event[]
  onFilterChange?: (filter: SmartFilter | null) => void
  className?: string
}

export type SmartFilter = {
  type: 'trending' | 'soon' | 'price' | 'indoor' | 'outdoor' | 'popular'
  label: string
  filter: (event: Event) => boolean
}

export default function SmartChips({ events, onFilterChange, className = '' }: SmartChipsProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [availableChips, setAvailableChips] = useState<SmartFilter[]>([])

  // Smart chip configurations
  const allChips: SmartFilter[] = [
    {
      type: 'trending',
      label: '🔥 Trending',
      filter: (event) => event.popularity > 70
    },
    {
      type: 'soon',
      label: '⏰ Starting Soon',
      filter: (event) => {
        const eventTime = new Date(event.startTime).getTime()
        const now = Date.now()
        const hoursUntil = (eventTime - now) / (1000 * 60 * 60)
        return hoursUntil >= 0 && hoursUntil <= 3
      }
    },
    {
      type: 'price',
      label: '💰 Under $20',
      filter: (event) => !event.price.isFree && (event.price.min || 0) < 20
    },
    {
      type: 'popular',
      label: '⭐ Popular',
      filter: (event) => event.popularity > 50 && event.popularity <= 70
    }
  ]

  // Contextually show chips based on available events
  useEffect(() => {
    const chips: SmartFilter[] = []

    // Only show chips if there are matching events
    allChips.forEach(chip => {
      const matchingEvents = events.filter(chip.filter)
      if (matchingEvents.length > 0) {
        chips.push(chip)
      }
    })

    setAvailableChips(chips)

    // Clear active filter if no longer relevant
    if (activeFilter) {
      const stillRelevant = chips.some(chip => chip.type === activeFilter)
      if (!stillRelevant) {
        setActiveFilter(null)
        onFilterChange?.(null)
      }
    }
  }, [events])

  const handleChipClick = (chip: SmartFilter) => {
    if (activeFilter === chip.type) {
      // Deactivate
      setActiveFilter(null)
      onFilterChange?.(null)
    } else {
      // Activate
      setActiveFilter(chip.type)
      onFilterChange?.(chip)
    }
  }

  if (availableChips.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {availableChips.map(chip => {
        const isActive = activeFilter === chip.type
        const count = events.filter(chip.filter).length

        return (
          <button
            key={chip.type}
            onClick={() => handleChipClick(chip)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200 hover:scale-105
              ${isActive
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-2 border-cyan-400/50 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-gray-800/40 border border-gray-600/30 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50'
              }
            `}
            style={{
              backdropFilter: 'blur(10px)',
            }}
          >
            <span>{chip.label}</span>
            <span className={`
              text-xs px-1.5 py-0.5 rounded-full font-bold
              ${isActive ? 'bg-cyan-400/30 text-cyan-200' : 'bg-gray-700/50 text-gray-400'}
            `}>
              {count}
            </span>
          </button>
        )
      })}

      {/* Clear all button - only show when filter is active */}
      {activeFilter && (
        <button
          onClick={() => {
            setActiveFilter(null)
            onFilterChange?.(null)
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all"
          style={{
            backdropFilter: 'blur(10px)',
          }}
        >
          <span>✕</span>
          <span>Clear</span>
        </button>
      )}
    </div>
  )
}
