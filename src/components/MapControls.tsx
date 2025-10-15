'use client'

import { useState } from 'react'
import { ChevronDownIcon, Cog6ToothIcon, GlobeAltIcon, MapPinIcon } from '@heroicons/react/24/outline'
import type { ClusteringMode } from '@/types'

interface MapControlsProps {
  clusteringMode: ClusteringMode
  onClusteringModeChange: (mode: ClusteringMode) => void
  isMapLoaded: boolean
  onZoomToOverview?: () => void
  isLocating?: boolean
  onFindNearbyEvents?: () => void
  onShowSavedEvents?: () => void
  onResetToSF?: () => void
  userLocation?: [number, number] | null
  showNearbyEvents?: boolean
}

export function MapControls({
  clusteringMode,
  onClusteringModeChange,
  isMapLoaded,
  onZoomToOverview,
  isLocating = false,
  onFindNearbyEvents,
  onShowSavedEvents,
  onResetToSF,
  userLocation,
  showNearbyEvents = false
}: MapControlsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [lastClickTime, setLastClickTime] = useState(0)

  const clusteringModes: { value: ClusteringMode; label: string; description: string }[] = [
    {
      value: 'hybrid',
      label: 'Hybrid Clustering',
      description: 'Geographic + Category (Recommended)'
    },
    {
      value: 'geographic',
      label: 'Geographic Regions',
      description: 'SF neighborhoods and areas'
    },
    {
      value: 'category',
      label: 'Category Based',
      description: 'Group by event type'
    },
    {
      value: 'native',
      label: 'Native Clustering',
      description: 'Mapbox default clustering'
    },
    {
      value: 'dynamic',
      label: 'Dynamic SVG',
      description: 'Zoom-based clustering'
    }
  ]

  // Advanced interaction handlers
  const handleAdvancedClick = (e: React.MouseEvent) => {
    const currentTime = Date.now()
    const timeDiff = currentTime - lastClickTime

    if (timeDiff < 300) {
      // Double click detected
      console.log('Double click: Show saved events')
      onShowSavedEvents?.()
    } else {
      // Single click - normal overview behavior
      onZoomToOverview?.()
    }

    setLastClickTime(currentTime)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Start long press timer
    const timer = setTimeout(() => {
      console.log('Long press: Find events near me')
      onFindNearbyEvents?.()
      // Add haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    }, 800) // 800ms for long press

    setLongPressTimer(timer)
  }

  const handleMouseUp = () => {
    // Cancel long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    console.log('Right click: Show context menu')

    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  const closeContextMenu = () => {
    setShowContextMenu(false)
  }

  if (!isMapLoaded) return null

  return (
    <div className="absolute top-4 right-4 z-10 max-w-[calc(100vw-2rem)]">
      <div className="flex flex-col lg:flex-row items-end lg:items-center space-y-2 lg:space-y-0 lg:space-x-2 mb-2">
        {/* Enhanced Smart Overview Button */}
        {onZoomToOverview && (
          <button
            onClick={handleAdvancedClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleRightClick}
            disabled={isLocating}
            className={`
              group relative overflow-hidden flex items-center space-x-2 px-3 py-2 rounded-lg text-white
              backdrop-blur-sm border transition-all duration-300 shadow-lg
              transform hover:scale-105 active:scale-95
              ${isLocating
                ? 'bg-gradient-to-r from-orange-600/90 to-yellow-600/90 border-orange-500/30 animate-pulse'
                : showNearbyEvents
                ? 'bg-gradient-to-r from-green-600/90 to-emerald-600/90 border-green-500/30 shadow-green-500/25'
                : 'bg-gradient-to-r from-blue-600/90 to-purple-600/90 border-blue-500/30 hover:from-blue-500/90 hover:to-purple-500/90 hover:border-blue-400/50 hover:shadow-blue-500/25'
              }
            `}
            title={
              isLocating ? "Finding your location..." :
              showNearbyEvents ? "Showing events near you" :
              `Smart Overview ${process.env.NODE_ENV === 'development' ? '(🧪 DEV MODE: Simulates SF location)' : ''} • Click: Overview • Long press: Find nearby • Double click: Saved events • Right click: More options`
            }
          >
            {/* Animated Background Effect */}
            {isLocating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-pulse"></div>
            )}

            {/* Dynamic Icon */}
            {isLocating ? (
              <div className="relative">
                <MapPinIcon className="h-4 w-4 animate-bounce" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
              </div>
            ) : (
              <GlobeAltIcon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            )}

            {/* Dynamic Text */}
            <span className="text-sm font-medium relative z-10">
              {isLocating ? 'Locating...' : 'Smart Overview'}
            </span>

            {/* Subtle Particle Effect */}
            {!isLocating && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full animate-ping delay-75"></div>
                <div className="absolute bottom-1 left-2 w-0.5 h-0.5 bg-blue-300 rounded-full animate-ping delay-150"></div>
                <div className="absolute top-2 left-1/2 w-0.5 h-0.5 bg-purple-300 rounded-full animate-ping delay-300"></div>
              </div>
            )}
          </button>
        )}

        {/* Context Menu */}
        {showContextMenu && (
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={closeContextMenu}
            />
            <div
              className="fixed z-[101] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl py-2 min-w-48"
              style={{
                left: Math.min(contextMenuPos.x, window.innerWidth - 200),
                top: Math.min(contextMenuPos.y, window.innerHeight - 200)
              }}
            >
              <div className="px-3 py-2 border-b border-gray-700">
                <div className="text-xs font-medium text-gray-300">Smart Overview Options</div>
              </div>

              <button
                onClick={() => {
                  onFindNearbyEvents?.()
                  closeContextMenu()
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800 transition-colors flex items-center"
              >
                <MapPinIcon className="h-4 w-4 mr-2 text-green-400" />
                Find Events Near Me
                {process.env.NODE_ENV === 'development' ?
                  <span className="ml-auto text-xs text-orange-400">(🧪 SF simulation)</span> :
                  !userLocation && <span className="ml-auto text-xs text-gray-500">(needs location)</span>
                }
              </button>

              <button
                onClick={() => {
                  onShowSavedEvents?.()
                  closeContextMenu()
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800 transition-colors flex items-center"
              >
                <svg className="h-4 w-4 mr-2 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Show Saved Events
                <span className="ml-auto text-xs text-gray-500">(mock: all events)</span>
              </button>

              <div className="border-t border-gray-700 my-1"></div>

              <button
                onClick={() => {
                  onResetToSF?.()
                  closeContextMenu()
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800 transition-colors flex items-center"
              >
                <GlobeAltIcon className="h-4 w-4 mr-2 text-blue-400" />
                Reset to San Francisco
              </button>

              <button
                onClick={() => {
                  // Future: Find parking functionality
                  console.log('Find parking (coming soon)')
                  closeContextMenu()
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-800 transition-colors flex items-center"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Find Parking
                <span className="ml-auto text-xs text-gray-500">Coming Soon</span>
              </button>

              <button
                onClick={() => {
                  // Future: Show transit functionality
                  console.log('Show transit (coming soon)')
                  closeContextMenu()
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-800 transition-colors flex items-center"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Show Transit Options
                <span className="ml-auto text-xs text-gray-500">Coming Soon</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`
            flex items-center space-x-2 px-3 py-2 bg-gray-900/90 backdrop-blur-sm
            border border-gray-700 rounded-lg text-white hover:bg-gray-800/90
            transition-all duration-200 shadow-lg
            ${isSettingsOpen ? 'bg-gray-800/90' : ''}
          `}
        >
          <Cog6ToothIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Clustering</span>
          <ChevronDownIcon className={`
            h-4 w-4 transition-transform duration-200
            ${isSettingsOpen ? 'rotate-180' : ''}
          `} />
        </button>

        {/* Settings Panel */}
        {isSettingsOpen && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-sm font-medium text-white">Clustering Mode</h3>
              <p className="text-xs text-gray-400 mt-1">
                Choose how events are grouped on the map
              </p>
            </div>

            <div className="p-2">
              {clusteringModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => {
                    onClusteringModeChange(mode.value)
                    setIsSettingsOpen(false)
                  }}
                  className={`
                    w-full text-left p-3 rounded-lg transition-colors mb-1
                    ${clusteringMode === mode.value
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'hover:bg-gray-800/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`
                        text-sm font-medium
                        ${clusteringMode === mode.value ? 'text-blue-400' : 'text-white'}
                      `}>
                        {mode.label}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {mode.description}
                      </div>
                    </div>
                    {clusteringMode === mode.value && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-gray-700 bg-gray-800/50">
              <div className="text-xs text-gray-400">
                Current mode: <span className="text-blue-400 font-medium">
                  {clusteringModes.find(m => m.value === clusteringMode)?.label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  )
}