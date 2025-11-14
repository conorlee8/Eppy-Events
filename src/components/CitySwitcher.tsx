'use client'

import { useState, useEffect } from 'react'
import { CITIES, getOrDetectCity, saveSelectedCity, type City } from '@/lib/cityDetection'

interface CitySwitcherProps {
  onCityChange: (city: City) => void
  currentCity?: City
}

export default function CitySwitcher({ onCityChange, currentCity }: CitySwitcherProps) {
  const [selectedCity, setSelectedCity] = useState<City | null>(currentCity || null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!selectedCity) {
      getOrDetectCity().then(city => {
        setSelectedCity(city)
        onCityChange(city)
      })
    }
  }, [])

  const handleCityChange = (city: City) => {
    setSelectedCity(city)
    saveSelectedCity(city.slug)
    onCityChange(city)
    setIsOpen(false)
  }

  if (!selectedCity) {
    return (
      <div className="px-3 py-2 text-sm text-gray-400">
        Detecting location...
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 transition-colors"
      >
        <span className="text-sm font-medium text-gray-200">{selectedCity.name}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          {CITIES.filter(c => c.active).map(city => (
            <button
              key={city.id}
              onClick={() => handleCityChange(city)}
              className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                city.slug === selectedCity.slug
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="font-medium">{city.name}</div>
              {city.slug === selectedCity.slug && (
                <div className="text-xs text-cyan-400 mt-0.5">Current location</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
