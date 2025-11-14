'use client'

import { useState, useEffect } from 'react'

interface ContextBarProps {
  className?: string
}

interface WeatherData {
  temp: number
  condition: string
  icon: string
  rainIn?: number // minutes until rain
}

interface TransitData {
  status: string
  delays?: number // minutes
  alerts?: string[]
}

export default function ContextBar({ className = '' }: ContextBarProps) {
  const [weather, setWeather] = useState<WeatherData>({
    temp: 68,
    condition: 'Clear',
    icon: '☀️'
  })
  const [transit, setTransit] = useState<TransitData>({
    status: 'Normal',
  })
  const [isCollapsed, setIsCollapsed] = useState(false)

  // TODO: Replace with real API calls
  // For now, using mock data with realistic updates
  useEffect(() => {
    // Simulate weather updates every 5 minutes
    const weatherInterval = setInterval(() => {
      const hour = new Date().getHours()
      const isClear = hour >= 6 && hour < 18

      setWeather({
        temp: 65 + Math.floor(Math.random() * 10),
        condition: isClear ? 'Clear' : 'Partly Cloudy',
        icon: isClear ? '☀️' : '🌤️',
        rainIn: Math.random() > 0.7 ? 20 + Math.floor(Math.random() * 40) : undefined
      })
    }, 300000) // 5 minutes

    // Simulate transit updates
    const transitInterval = setInterval(() => {
      const hasDelays = Math.random() > 0.8
      setTransit({
        status: hasDelays ? 'Delays' : 'Normal',
        delays: hasDelays ? 5 + Math.floor(Math.random() * 20) : undefined
      })
    }, 60000) // 1 minute

    return () => {
      clearInterval(weatherInterval)
      clearInterval(transitInterval)
    }
  }, [])

  // Auto-collapse on mobile if everything is normal
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile && !weather.rainIn && !transit.delays) {
      setIsCollapsed(true)
    }
  }, [weather.rainIn, transit.delays])

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 backdrop-blur-sm border border-cyan-500/20 rounded-full text-xs text-gray-300 hover:bg-gray-800/60 transition-all ${className}`}
      >
        <span>{weather.icon}</span>
        <span>{weather.temp}°F</span>
        {transit.status !== 'Normal' && (
          <span className="text-orange-400">🚇</span>
        )}
        <span className="text-cyan-400">▼</span>
      </button>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 px-3 py-2 rounded-lg text-xs"
        style={{
          background: 'linear-gradient(90deg, rgba(0,20,40,0.6), rgba(0,10,20,0.6))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,255,255,0.15)',
        }}
      >
        {/* Weather Info */}
        <div className="flex items-center gap-2">
          <span className="text-lg">{weather.icon}</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-white">{weather.temp}°F</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-300">{weather.condition}</span>
          </div>
          {weather.rainIn && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
              <span>🌧️</span>
              <span className="text-blue-300 font-medium">Rain in {weather.rainIn}min</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-cyan-500/20" />

        {/* Transit Info */}
        <div className="flex items-center gap-2">
          <span className="text-lg">🚇</span>
          <div className="flex items-center gap-1">
            <span className={`font-medium ${transit.status === 'Normal' ? 'text-green-400' : 'text-orange-400'}`}>
              {transit.status === 'Normal' ? 'BART Normal' : 'BART Delays'}
            </span>
            {transit.delays && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-orange-300">{transit.delays}min delays</span>
              </>
            )}
          </div>
        </div>

        {/* Collapse button - Desktop only */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="hidden sm:block ml-auto text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-xs">✕</span>
        </button>
      </div>

      {/* Impact indicator - show when rain affects events */}
      {weather.rainIn && weather.rainIn < 30 && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          💡 Showing +40% indoor events due to incoming rain
        </div>
      )}
    </div>
  )
}
