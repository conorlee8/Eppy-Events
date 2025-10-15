'use client'

import { useState, useEffect } from 'react'
import {
  CloudIcon,
  ChartBarIcon,
  FireIcon,
  SunIcon,
  MoonIcon,
  EyeSlashIcon,
  EyeIcon,
  MapIcon
} from '@heroicons/react/24/outline'
import { generateMockHeatmapData, getLocationIntensity } from '@/lib/mockHeatmapData'

interface DevStatsPanelProps {
  isMapLoaded: boolean
  userLocation?: [number, number] | null
  eventCount: number
  viewportEventCount: number
  onHeatmapToggle?: (visible: boolean, options?: any) => void
  heatmapVisible?: boolean
}

export function DevStatsPanel({
  isMapLoaded,
  userLocation,
  eventCount,
  viewportEventCount,
  onHeatmapToggle,
  heatmapVisible = false
}: DevStatsPanelProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [currentWeather, setCurrentWeather] = useState<string>('sunny')
  const [eventDensity, setEventDensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'night'>('day')
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(0)
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [heatmapPoints, setHeatmapPoints] = useState<number>(0)

  // Advanced heatmap controls (2025 trends)
  const [heatmapStyle, setHeatmapStyle] = useState<'classic' | 'neon' | 'glassmorphic' | 'neumorphic'>('glassmorphic')
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.8)
  const [heatmapRadius, setHeatmapRadius] = useState<number>(30)
  const [heatmapBlur, setHeatmapBlur] = useState<number>(15)
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)

  // Simulate weather changes for testing
  const toggleWeather = () => {
    const weathers = ['sunny', 'cloudy', 'rainy', 'foggy']
    const currentIndex = weathers.indexOf(currentWeather)
    const nextWeather = weathers[(currentIndex + 1) % weathers.length]
    setCurrentWeather(nextWeather)
    console.log(`🌤️ Weather changed to: ${nextWeather}`)
  }

  // Simulate density changes
  const toggleDensity = () => {
    const densities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high']
    const currentIndex = densities.indexOf(eventDensity)
    const nextDensity = densities[(currentIndex + 1) % densities.length]
    setEventDensity(nextDensity)
    console.log(`🔥 Event density changed to: ${nextDensity}`)
  }

  // Toggle day/night theme
  const toggleTimeOfDay = () => {
    const newTime = timeOfDay === 'day' ? 'night' : 'day'
    setTimeOfDay(newTime)
    console.log(`🌅 Time changed to: ${newTime}`)
  }

  // Modern heatmap style configurations (2025 trends)
  const getHeatmapConfig = () => {
    const baseConfig = {
      opacity: heatmapOpacity,
      radius: heatmapRadius,
      blur: heatmapBlur
    }

    switch (heatmapStyle) {
      case 'neon':
        return {
          ...baseConfig,
          colors: [
            'rgba(0,255,255,0)',      // Cyan transparent
            'rgba(0,255,255,0.3)',    // Cyan glow
            'rgba(255,0,255,0.6)',    // Magenta core
            'rgba(255,255,0,0.8)',    // Yellow hot
            'rgba(255,0,0,1)'         // Red maximum
          ],
          glowEffect: true
        }
      case 'glassmorphic':
        return {
          ...baseConfig,
          colors: [
            'rgba(59,130,246,0)',     // Blue transparent
            'rgba(59,130,246,0.1)',   // Blue subtle
            'rgba(139,69,193,0.3)',   // Purple mid
            'rgba(239,68,68,0.6)',    // Red warm
            'rgba(248,113,113,0.9)'   // Red bright
          ],
          backdropBlur: true,
          glassmorphic: true
        }
      case 'neumorphic':
        return {
          ...baseConfig,
          colors: [
            'rgba(75,85,99,0)',       // Gray transparent
            'rgba(107,114,128,0.2)',  // Gray subtle
            'rgba(156,163,175,0.4)',  // Gray mid
            'rgba(209,213,219,0.7)',  // Gray warm
            'rgba(229,231,235,0.9)'   // Gray bright
          ],
          softShadows: true
        }
      default: // classic
        return {
          ...baseConfig,
          colors: [
            'rgba(33,102,172,0)',
            'rgb(103,169,207)',
            'rgb(209,229,240)',
            'rgb(253,219,199)',
            'rgb(239,138,98)',
            'rgb(178,24,43)'
          ]
        }
    }
  }

  // Toggle heatmap display with modern configurations
  const toggleHeatmap = () => {
    const newEnabled = !heatmapEnabled
    setHeatmapEnabled(newEnabled)

    // Call parent callback with modern styling options
    if (onHeatmapToggle) {
      onHeatmapToggle(newEnabled, newEnabled ? getHeatmapConfig() : null)
    }

    if (newEnabled) {
      // Generate fresh heatmap data
      const heatmapData = generateMockHeatmapData()
      setHeatmapPoints(heatmapData.length)

      // Calculate average intensity for current location
      if (userLocation) {
        const intensity = getLocationIntensity(userLocation[1], userLocation[0])
        setHeatmapIntensity(intensity)
      } else {
        // Default SF downtown intensity
        const intensity = getLocationIntensity(37.7749, -122.4194)
        setHeatmapIntensity(intensity)
      }

      console.log(`🔥 Heatmap enabled: ${heatmapData.length} points generated with ${heatmapStyle} style`)
    } else {
      setHeatmapPoints(0)
      setHeatmapIntensity(0)
      console.log(`🔥 Heatmap disabled`)
    }
  }

  // Live update heatmap when style options change
  const updateHeatmapStyle = () => {
    if (heatmapEnabled && onHeatmapToggle) {
      onHeatmapToggle(true, getHeatmapConfig())
      console.log(`🎨 Heatmap style updated: ${heatmapStyle}`)
    }
  }

  // Auto-detect real time of day
  useEffect(() => {
    const hour = new Date().getHours()
    setTimeOfDay(hour >= 6 && hour < 18 ? 'day' : 'night')
  }, [])

  // Sync heatmap state with parent
  useEffect(() => {
    setHeatmapEnabled(heatmapVisible)
  }, [heatmapVisible])

  if (!isMapLoaded) return null

  const getWeatherIcon = () => {
    switch (currentWeather) {
      case 'sunny': return '☀️'
      case 'cloudy': return '☁️'
      case 'rainy': return '🌧️'
      case 'foggy': return '🌫️'
      default: return '☀️'
    }
  }

  const getDensityColor = () => {
    switch (eventDensity) {
      case 'low': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'high': return 'text-red-400'
    }
  }

  const getTimeIcon = () => {
    return timeOfDay === 'day' ? SunIcon : MoonIcon
  }

  if (!isVisible) {
    return (
      <div className="hidden lg:block absolute top-4 left-[340px] z-10">
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center space-x-1 px-2 py-1 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded text-white hover:bg-gray-800/80 transition-all text-xs"
        >
          <EyeIcon className="h-3 w-3" />
          <span>Stats</span>
        </button>
      </div>
    )
  }

  return (
    <div className="hidden lg:block absolute top-4 left-[340px] z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl max-w-xs">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ChartBarIcon className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Dev Stats</span>
            {process.env.NODE_ENV === 'development' && (
              <span className="text-xs bg-orange-600 text-white px-1 py-0.5 rounded">DEV</span>
            )}
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <EyeSlashIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Event Counts */}
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-xs text-gray-400">Total Events</div>
            <div className="text-lg font-bold text-white">{eventCount}</div>
          </div>

          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-xs text-gray-400">In Viewport</div>
            <div className="text-lg font-bold text-blue-400">{viewportEventCount}</div>
          </div>

          {/* Location Status */}
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-xs text-gray-400">Location</div>
            <div className="text-xs font-medium text-green-400">
              {userLocation ? '📍 Available' : '❌ None'}
            </div>
          </div>

          {/* Dev Mode Status */}
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-xs text-gray-400">Mode</div>
            <div className="text-xs font-medium text-orange-400">
              {process.env.NODE_ENV === 'development' ? '🧪 SF Sim' : '🌍 Live'}
            </div>
          </div>

          {/* Heatmap Stats */}
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-xs text-gray-400">Heatmap</div>
            <div className="text-xs font-medium">
              {heatmapEnabled ? (
                <span className="text-red-400">🔥 {heatmapPoints} points</span>
              ) : (
                <span className="text-gray-500">⭕ Disabled</span>
              )}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-xs text-gray-400">Cell Density</div>
            <div className="text-lg font-bold">
              {heatmapEnabled ? (
                <span className={`${
                  heatmapIntensity >= 70 ? 'text-red-400' :
                  heatmapIntensity >= 40 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {heatmapIntensity}%
                </span>
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Testing Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-300 mb-1">Testing Controls</div>

          {/* Weather Toggle */}
          <button
            onClick={toggleWeather}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-xs transition-colors"
          >
            <div className="flex items-center space-x-2">
              <CloudIcon className="h-3 w-3 text-blue-400" />
              <span className="text-white">Weather</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>{getWeatherIcon()}</span>
              <span className="text-gray-300 capitalize">{currentWeather}</span>
            </div>
          </button>

          {/* Density Toggle */}
          <button
            onClick={toggleDensity}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-xs transition-colors"
          >
            <div className="flex items-center space-x-2">
              <FireIcon className="h-3 w-3 text-red-400" />
              <span className="text-white">Density</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className={`font-medium ${getDensityColor()}`}>
                {eventDensity.toUpperCase()}
              </span>
            </div>
          </button>

          {/* Time of Day Toggle */}
          <button
            onClick={toggleTimeOfDay}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-xs transition-colors"
          >
            <div className="flex items-center space-x-2">
              {timeOfDay === 'day' ?
                <SunIcon className="h-3 w-3 text-yellow-400" /> :
                <MoonIcon className="h-3 w-3 text-purple-400" />
              }
              <span className="text-white">Theme</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-gray-300 capitalize">
                {timeOfDay === 'day' ? '☀️ Day' : '🌙 Night'}
              </span>
            </div>
          </button>

          {/* Heatmap Toggle */}
          <button
            onClick={toggleHeatmap}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-xs transition-colors"
          >
            <div className="flex items-center space-x-2">
              <MapIcon className="h-3 w-3 text-red-400" />
              <span className="text-white">Heatmap</span>
            </div>
            <div className="flex items-center space-x-1">
              {heatmapEnabled ? (
                <span className="text-red-400 font-medium">
                  🔥 ON ({heatmapIntensity}%)
                </span>
              ) : (
                <span className="text-gray-500">
                  ⭕ OFF
                </span>
              )}
            </div>
          </button>

          {/* Advanced Heatmap Controls (2025 Modern UI) */}
          {heatmapEnabled && (
            <div className="mt-2 p-3 bg-gradient-to-br from-gray-800/30 via-gray-700/20 to-gray-600/30 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl">
              {/* Glassmorphic header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white/90">🎨 Advanced Controls</span>
                <button
                  onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showAdvancedControls ? '▲ Less' : '▼ More'}
                </button>
              </div>

              {/* Style Selector */}
              <div className="mb-2">
                <label className="text-xs text-gray-300 mb-1 block">Visual Style</label>
                <div className="grid grid-cols-2 gap-1">
                  {(['classic', 'glassmorphic', 'neon', 'neumorphic'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setHeatmapStyle(style)
                        setTimeout(updateHeatmapStyle, 100)
                      }}
                      className={`
                        px-2 py-1 text-xs rounded transition-all duration-300
                        ${heatmapStyle === style
                          ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-500/25 backdrop-blur-sm border border-blue-400/30'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/30'
                        }
                      `}
                    >
                      {style === 'glassmorphic' ? '🔮 Glass' :
                       style === 'neon' ? '⚡ Neon' :
                       style === 'neumorphic' ? '🌊 Neu' : '🔥 Classic'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Controls (Collapsible) */}
              {showAdvancedControls && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  {/* Opacity Slider */}
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block flex justify-between">
                      <span>Opacity</span>
                      <span className="text-blue-400">{Math.round(heatmapOpacity * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={heatmapOpacity}
                      onChange={(e) => {
                        setHeatmapOpacity(parseFloat(e.target.value))
                        setTimeout(updateHeatmapStyle, 100)
                      }}
                      className="w-full h-1 bg-gray-600/50 rounded-lg appearance-none cursor-pointer slider-modern"
                    />
                  </div>

                  {/* Radius Slider */}
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block flex justify-between">
                      <span>Radius</span>
                      <span className="text-purple-400">{heatmapRadius}px</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="5"
                      value={heatmapRadius}
                      onChange={(e) => {
                        setHeatmapRadius(parseInt(e.target.value))
                        setTimeout(updateHeatmapStyle, 100)
                      }}
                      className="w-full h-1 bg-gray-600/50 rounded-lg appearance-none cursor-pointer slider-modern"
                    />
                  </div>

                  {/* Blur Slider */}
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block flex justify-between">
                      <span>Blur</span>
                      <span className="text-pink-400">{heatmapBlur}px</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={heatmapBlur}
                      onChange={(e) => {
                        setHeatmapBlur(parseInt(e.target.value))
                        setTimeout(updateHeatmapStyle, 100)
                      }}
                      className="w-full h-1 bg-gray-600/50 rounded-lg appearance-none cursor-pointer slider-modern"
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="pt-2 border-t border-white/10">
                    <label className="text-xs text-gray-300 mb-1 block">Quick Presets</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setHeatmapOpacity(0.6)
                          setHeatmapRadius(15)
                          setHeatmapBlur(10)
                          setTimeout(updateHeatmapStyle, 100)
                        }}
                        className="px-2 py-1 text-xs bg-green-600/30 hover:bg-green-600/50 text-green-300 rounded border border-green-500/30 transition-all"
                      >
                        🌿 Subtle
                      </button>
                      <button
                        onClick={() => {
                          setHeatmapOpacity(0.8)
                          setHeatmapRadius(30)
                          setHeatmapBlur(15)
                          setTimeout(updateHeatmapStyle, 100)
                        }}
                        className="px-2 py-1 text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded border border-blue-500/30 transition-all"
                      >
                        🔮 Balanced
                      </button>
                      <button
                        onClick={() => {
                          setHeatmapOpacity(1.0)
                          setHeatmapRadius(45)
                          setHeatmapBlur(25)
                          setTimeout(updateHeatmapStyle, 100)
                        }}
                        className="px-2 py-1 text-xs bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded border border-red-500/30 transition-all"
                      >
                        🔥 Intense
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Future Integration Placeholders */}
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500">Coming Soon: Live weather API, map visualization, real-time sync</div>
        </div>
      </div>
    </div>
  )
}