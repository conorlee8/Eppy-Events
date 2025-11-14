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

  if (!isMapLoaded) return null

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col-reverse gap-3">
      {/* Locate Me FAB */}
      {onFindNearbyEvents && (
        <div className="group relative">
          <button
            onClick={onFindNearbyEvents}
            disabled={isLocating}
            className={`
              relative overflow-hidden w-14 h-14 rounded-full text-white
              backdrop-blur-md border transition-all duration-300 shadow-2xl
              flex items-center justify-center
              ${isLocating
                ? 'bg-cyan-500/90 border-cyan-400/50 animate-pulse'
                : showNearbyEvents
                ? 'bg-green-500/90 border-green-400/50'
                : 'bg-blue-500/90 border-blue-400/50 hover:bg-blue-400/90 hover:scale-110'
              }
            `}
            title={isLocating ? "Finding your location..." : "Find my location"}
          >
            {isLocating ? (
              <div className="relative">
                <MapPinIcon className="h-6 w-6 animate-bounce" />
              </div>
            ) : (
              <MapPinIcon className="h-6 w-6" />
            )}
          </button>

          {/* Hover Label */}
          <div className="absolute right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-gray-900/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-700 whitespace-nowrap">
              <span className="text-xs font-medium text-white">
                {isLocating ? 'Locating...' : 'Locate Me'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Clustering FAB */}
      <div className="group relative">
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`
            w-14 h-14 rounded-full bg-gray-900/90 backdrop-blur-md
            border border-gray-700 text-white hover:bg-gray-800/90
            transition-all duration-300 shadow-2xl hover:scale-110
            flex items-center justify-center
            ${isSettingsOpen ? 'bg-gray-800/90 scale-110' : ''}
          `}
          title="Clustering Settings"
        >
          <Cog6ToothIcon className="h-6 w-6" />
        </button>

        {/* Hover Label */}
        <div className="absolute right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-gray-900/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-700 whitespace-nowrap">
            <span className="text-xs font-medium text-white">Clustering</span>
          </div>
        </div>

        {/* Settings Panel */}
        {isSettingsOpen && (
          <div className="absolute bottom-full right-0 mb-3 w-72 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl">
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