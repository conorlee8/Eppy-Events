'use client'

import { useState, useEffect } from 'react'
import type { Event } from '@/types'

interface GetThereProps {
  event: Event
  isExpanded: boolean
  onToggle?: () => void
}

interface TransitOption {
  mode: string
  icon: string
  duration: string
  cost?: string
  details?: string
  color: string
}

export default function GetThere({ event, isExpanded, onToggle }: GetThereProps) {
  const [transitOptions, setTransitOptions] = useState<TransitOption[]>([])
  const [loading, setLoading] = useState(false)

  // Mock transit data calculation
  // TODO: Replace with real API calls (Google Maps, Uber, Lyft, etc.)
  useEffect(() => {
    if (!isExpanded) return

    setLoading(true)

    // Simulate API call
    setTimeout(() => {
      const baseTime = 15 + Math.floor(Math.random() * 20)

      setTransitOptions([
        {
          mode: 'BART',
          icon: '🚇',
          duration: `${baseTime}min`,
          cost: '$3.20',
          details: 'Montgomery St → Powell St',
          color: 'from-blue-500 to-blue-600'
        },
        {
          mode: 'Uber',
          icon: '🚗',
          duration: `${Math.floor(baseTime * 0.7)}min`,
          cost: `$${12 + Math.floor(Math.random() * 10)}-${18 + Math.floor(Math.random() * 10)}`,
          details: '3min pickup',
          color: 'from-gray-700 to-gray-800'
        },
        {
          mode: 'Lyft',
          icon: '🚙',
          duration: `${Math.floor(baseTime * 0.75)}min`,
          cost: `$${11 + Math.floor(Math.random() * 10)}-${17 + Math.floor(Math.random() * 10)}`,
          details: '5min pickup',
          color: 'from-pink-600 to-pink-700'
        },
        {
          mode: 'Parking',
          icon: '🅿️',
          duration: `${Math.floor(baseTime * 0.9)}min`,
          cost: `$${8 + Math.floor(Math.random() * 8)}/hr`,
          details: '2 garages nearby',
          color: 'from-green-600 to-green-700'
        },
        {
          mode: 'Bike',
          icon: '🚴',
          duration: `${Math.floor(baseTime * 1.3)}min`,
          cost: '$4.50',
          details: 'BayWheels available',
          color: 'from-cyan-600 to-cyan-700'
        }
      ])

      setLoading(false)
    }, 500)
  }, [isExpanded])

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-gray-800/40 to-gray-700/40 border border-gray-600/30 hover:border-cyan-500/40 transition-all group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🚇</span>
          <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
            Get There
          </span>
        </div>
        <svg className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    )
  }

  return (
    <div className="space-y-3 animate-slideDown">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🚇</span>
          <span className="text-xs font-medium text-white">
            Get There
          </span>
        </div>
        <svg className="w-4 h-4 text-cyan-400 transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Transit Options */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {transitOptions.map((option, index) => (
            <button
              key={index}
              className="group flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-600/30 hover:border-cyan-500/50 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${option.color} flex items-center justify-center text-base shadow-lg`}>
                  {option.icon}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {option.mode}
                  </div>
                  {option.details && (
                    <div className="text-xs text-gray-400">
                      {option.details}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-cyan-400">
                  {option.duration}
                </div>
                {option.cost && (
                  <div className="text-xs text-gray-300">
                    {option.cost}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Powered by note */}
      <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-700/50">
        Live estimates • Tap to navigate
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
