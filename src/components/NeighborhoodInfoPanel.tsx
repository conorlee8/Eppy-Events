'use client'

interface NeighborhoodInfoPanelProps {
  neighborhoodName: string | null
  eventCount: number
  onFilter: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function NeighborhoodInfoPanel({
  neighborhoodName,
  eventCount,
  onFilter,
  onMouseEnter,
  onMouseLeave
}: NeighborhoodInfoPanelProps) {
  if (!neighborhoodName) return null

  return (
    <div
      className="fixed bottom-36 sm:bottom-8 left-4 right-20 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-35 pointer-events-none animate-in slide-in-from-bottom-4 duration-300"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl border border-blue-500/30 rounded-xl sm:rounded-2xl shadow-2xl shadow-blue-500/20 px-3 sm:px-6 py-2 sm:py-4 w-full sm:min-w-[320px] sm:max-w-md pointer-events-auto">
        {/* Compact Mobile Layout */}
        <div className="flex items-center justify-between gap-3">
          {/* Neighborhood Info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
              Neighborhood
            </div>
            <div className="text-base sm:text-lg font-bold text-white flex items-center space-x-1.5">
              <span className="text-blue-400">📍</span>
              <span className="truncate">{neighborhoodName}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {eventCount} event{eventCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Action Button - Compact on mobile */}
          <button
            onClick={onFilter}
            className="flex-shrink-0 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium py-2 px-3 sm:px-4 rounded-lg transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 active:scale-95 text-sm"
          >
            <span>🔍</span>
            <span className="hidden sm:inline">View</span>
          </button>
        </div>

        {/* Tip */}
        <div className="mt-3 text-xs text-gray-500 text-center hidden sm:block">
          Click to filter events • Hover to explore
        </div>
      </div>
    </div>
  )
}
