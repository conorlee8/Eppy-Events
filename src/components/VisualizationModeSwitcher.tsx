'use client'

import { useState } from 'react'
import { Map, Layers, TrendingUp } from 'lucide-react'

export type VisualizationMode = 'markers' | 'density' | 'foottraffic'

interface VisualizationModeSwitcherProps {
  currentMode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
}

export default function VisualizationModeSwitcher({
  currentMode,
  onModeChange
}: VisualizationModeSwitcherProps) {
  const modes = [
    {
      id: 'markers' as VisualizationMode,
      label: 'Markers',
      icon: Map,
      description: 'Individual venue markers with clustering'
    },
    {
      id: 'density' as VisualizationMode,
      label: 'Density',
      icon: Layers,
      description: 'Venue density heat map'
    },
    {
      id: 'foottraffic' as VisualizationMode,
      label: 'Live Traffic',
      icon: TrendingUp,
      description: 'Live foot-traffic heat map'
    }
  ]

  return (
    <div className="fixed top-32 right-6 z-30 flex flex-col gap-2">
      {/* Mode Selector */}
      <div
        className="rounded-xl overflow-hidden backdrop-blur-md"
        style={{
          background: 'linear-gradient(135deg, rgba(0,10,25,0.95), rgba(0,0,0,0.95))',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        {/* Header */}
        <div className="px-4 py-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">View Mode</h3>
        </div>

        {/* Mode Options */}
        <div className="p-2 space-y-1">
          {modes.map((mode) => {
            const Icon = mode.icon
            const isActive = currentMode === mode.id

            return (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-500/20 border border-cyan-400/50'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
                style={isActive ? {
                  boxShadow: '0 0 20px rgba(6,182,212,0.3)'
                } : {}}
              >
                <div className={`flex-shrink-0 ${
                  isActive ? 'text-cyan-400' : 'text-gray-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 text-left">
                  <div className={`text-sm font-semibold ${
                    isActive ? 'text-white' : 'text-gray-300'
                  }`}>
                    {mode.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {mode.description}
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Info box based on current mode */}
      <div
        className="px-4 py-3 rounded-xl backdrop-blur-md"
        style={{
          background: 'linear-gradient(135deg, rgba(0,10,25,0.95), rgba(0,0,0,0.95))',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        {currentMode === 'markers' && (
          <div className="text-xs text-gray-400">
            <div className="font-semibold text-white mb-1">Marker Mode</div>
            Click markers to see details. Zoom to decluster.
          </div>
        )}
        {currentMode === 'density' && (
          <div className="text-xs text-gray-400">
            <div className="font-semibold text-white mb-1">Density Mode</div>
            Red = high venue concentration, Blue = sparse.
          </div>
        )}
        {currentMode === 'foottraffic' && (
          <div className="text-xs text-gray-400">
            <div className="font-semibold text-white mb-1">Live Traffic</div>
            Red = busy venues, Blue = quiet. Updates hourly.
          </div>
        )}
      </div>
    </div>
  )
}
