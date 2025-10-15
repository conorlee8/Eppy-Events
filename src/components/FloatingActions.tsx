'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FloatingActionsProps {
  onFindNearby?: () => void
  onVibeFilter?: (vibe: string) => void
  userLocation?: [number, number] | null
  showCompass?: boolean
}

const vibes = [
  { id: 'party', emoji: '🎉', label: 'Party', color: 'from-pink-500 to-rose-600' },
  { id: 'chill', emoji: '🎨', label: 'Chill', color: 'from-blue-500 to-cyan-600' },
  { id: 'active', emoji: '💪', label: 'Active', color: 'from-green-500 to-emerald-600' },
  { id: 'cultural', emoji: '🎭', label: 'Cultural', color: 'from-purple-500 to-violet-600' },
  { id: 'foodie', emoji: '🍕', label: 'Foodie', color: 'from-orange-500 to-amber-600' },
]

export function FloatingActions({
  onFindNearby,
  onVibeFilter,
  userLocation,
  showCompass = true
}: FloatingActionsProps) {
  const [vibeMenuOpen, setVibeMenuOpen] = useState(false)
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)

  const handleVibeSelect = (vibeId: string) => {
    setSelectedVibe(vibeId === selectedVibe ? null : vibeId)
    onVibeFilter?.(vibeId)
    setVibeMenuOpen(false)

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30)
    }
  }

  return (
    <>
      {/* Top Right: User Location Pulse */}
      {showCompass && (
        <div className="fixed top-20 right-4 z-40">
          <div className="relative">
            {/* Pulse rings */}
            <div className="absolute inset-0 bg-blue-500/30 rounded-full animate-ping" />
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse" />

            {/* Location indicator */}
            <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-full shadow-lg shadow-blue-500/50 border-2 border-white/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right: Action Buttons Stack */}
      <div className="fixed bottom-28 right-4 z-40 flex flex-col gap-3">
        {/* Find Nearby Button */}
        {onFindNearby && (
          <motion.button
            onClick={onFindNearby}
            whileTap={{ scale: 0.95 }}
            className="relative group"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />

            {/* Button */}
            <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-full shadow-xl border-2 border-white/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
          </motion.button>
        )}

        {/* Vibe Filter Button */}
        <motion.button
          onClick={() => setVibeMenuOpen(!vibeMenuOpen)}
          whileTap={{ scale: 0.95 }}
          className="relative group"
        >
          {/* Glow effect */}
          <div className={`absolute inset-0 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity ${
            selectedVibe
              ? 'bg-gradient-to-br from-purple-500 to-pink-600'
              : 'bg-gradient-to-br from-fuchsia-500 to-purple-600'
          }`} />

          {/* Button */}
          <div className={`relative p-4 rounded-full shadow-xl border-2 border-white/20 ${
            selectedVibe
              ? 'bg-gradient-to-br from-purple-500 to-pink-600'
              : 'bg-gradient-to-br from-fuchsia-500 to-purple-600'
          }`}>
            {selectedVibe ? (
              <span className="text-2xl">
                {vibes.find(v => v.id === selectedVibe)?.emoji}
              </span>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            )}
          </div>
        </motion.button>
      </div>

      {/* Vibe Menu */}
      <AnimatePresence>
        {vibeMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVibeMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-45 backdrop-blur-sm"
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-52 right-4 z-50 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl p-4"
            >
              <div className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                Select Vibe
              </div>

              <div className="flex flex-col gap-2">
                {vibes.map((vibe, index) => (
                  <motion.button
                    key={vibe.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleVibeSelect(vibe.id)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${selectedVibe === vibe.id
                        ? `bg-gradient-to-r ${vibe.color} text-white shadow-lg`
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                      }
                    `}
                  >
                    <span className="text-2xl">{vibe.emoji}</span>
                    <span className="font-medium">{vibe.label}</span>
                    {selectedVibe === vibe.id && (
                      <svg className="w-5 h-5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </motion.button>
                ))}
              </div>

              {selectedVibe && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setSelectedVibe(null)
                    onVibeFilter?.('all')
                    setVibeMenuOpen(false)
                  }}
                  className="w-full mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Clear Filter
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
