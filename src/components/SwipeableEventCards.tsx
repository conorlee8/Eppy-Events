'use client'

import { useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import type { Event } from '@/types'
import { ClockIcon, MapPinIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'

interface SwipeableEventCardsProps {
  events: Event[]
  onEventSave: (event: Event) => void
  onEventSkip: (event: Event) => void
  onEventDetails: (event: Event) => void
}

export function SwipeableEventCards({
  events,
  onEventSave,
  onEventSkip,
  onEventDetails
}: SwipeableEventCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-25, 0, 25])
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0])

  // Swipe indicator opacities - must be declared before early return
  const saveOpacity = useTransform(x, [0, 100], [0, 1])
  const skipOpacity = useTransform(x, [-100, 0], [1, 0])

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 100
    const swipeVelocity = 500

    if (Math.abs(info.offset.x) > swipeThreshold || Math.abs(info.velocity.x) > swipeVelocity) {
      if (info.offset.x > 0) {
        // Swiped right - Save
        onEventSave(events[currentIndex])
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50)
        }
      } else {
        // Swiped left - Skip
        onEventSkip(events[currentIndex])
      }

      // Move to next card
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % events.length)
        x.set(0)
      }, 200)
    } else {
      // Snap back
      x.set(0)
    }
  }

  const handleSwipeUp = () => {
    onEventDetails(events[currentIndex])
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatPrice = (price: Event['price']) => {
    if (price.isFree) return 'Free'
    if (price.min && price.max) return `$${price.min}-$${price.max}`
    return price.min ? `$${price.min}` : 'Free'
  }

  const getCategoryGradient = (category: string) => {
    const gradients = {
      'Music': 'from-red-500 to-pink-600',
      'Sports': 'from-teal-500 to-cyan-600',
      'Food': 'from-orange-500 to-yellow-600',
      'Arts': 'from-green-500 to-emerald-600',
      'Technology': 'from-blue-500 to-indigo-600',
      'Community': 'from-purple-500 to-pink-600',
      'Markets': 'from-indigo-500 to-purple-600',
      'Fitness': 'from-violet-500 to-fuchsia-600'
    }
    return gradients[category as keyof typeof gradients] || 'from-gray-500 to-gray-600'
  }

  if (events.length === 0 || currentIndex >= events.length) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-gray-400">No events in this area</p>
          <p className="text-sm text-gray-500 mt-2">Try exploring a different neighborhood</p>
        </div>
      </div>
    )
  }

  const currentEvent = events[currentIndex]

  return (
    <div className="relative h-full w-full p-4 flex items-center justify-center">
      {/* Card Stack Background (show next 2 cards) */}
      {currentIndex + 1 < events.length && (
        <div className="absolute inset-4 bg-gray-800/40 rounded-2xl scale-95 -z-10" />
      )}
      {currentIndex + 2 < events.length && (
        <div className="absolute inset-4 bg-gray-800/20 rounded-2xl scale-90 -z-20" />
      )}

      {/* Active Card */}
      <motion.div
        className="w-full max-w-sm cursor-grab active:cursor-grabbing"
        style={{ x, rotate, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        onClick={handleSwipeUp}
        whileTap={{ scale: 0.98 }}
      >
        <div className={`relative bg-gradient-to-br ${getCategoryGradient(currentEvent.category)} rounded-3xl overflow-hidden shadow-2xl`}>
          {/* Glassmorphic Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Content */}
          <div className="relative p-6 h-80 flex flex-col justify-between">
            {/* Category Badge */}
            <div className="flex items-start justify-between">
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
                <span className="text-white text-sm font-medium">{currentEvent.category}</span>
              </div>
              {currentEvent.popularity >= 90 && (
                <div className="bg-orange-500/80 backdrop-blur-md px-3 py-1 rounded-full border border-orange-400/50 animate-pulse">
                  <span className="text-white text-sm font-bold">🔥 Hot</span>
                </div>
              )}
            </div>

            {/* Event Title */}
            <div className="flex-1 flex items-center justify-center">
              <h2 className="text-3xl font-bold text-white text-center leading-tight">
                {currentEvent.title}
              </h2>
            </div>

            {/* Event Details */}
            <div className="space-y-3">
              <div className="flex items-center text-white/90">
                <MapPinIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm truncate">{currentEvent.venue}</span>
              </div>
              <div className="flex items-center text-white/90">
                <ClockIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{formatDate(currentEvent.startTime)}</span>
              </div>
              <div className="flex items-center text-white/90">
                <CurrencyDollarIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">{formatPrice(currentEvent.price)}</span>
              </div>
            </div>
          </div>

          {/* Swipe Indicators */}
          <motion.div
            className="absolute left-8 top-1/2 -translate-y-1/2 bg-green-500/80 backdrop-blur-md px-6 py-3 rounded-2xl rotate-12 border-4 border-green-400"
            style={{ opacity: saveOpacity }}
          >
            <span className="text-white text-2xl font-bold">SAVE</span>
          </motion.div>

          <motion.div
            className="absolute right-8 top-1/2 -translate-y-1/2 bg-red-500/80 backdrop-blur-md px-6 py-3 rounded-2xl -rotate-12 border-4 border-red-400"
            style={{ opacity: skipOpacity }}
          >
            <span className="text-white text-2xl font-bold">SKIP</span>
          </motion.div>
        </div>
      </motion.div>

      {/* Swipe Instructions */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span>←</span>
          <span>Skip</span>
        </div>
        <div className="w-1 h-1 bg-gray-600 rounded-full" />
        <div className="flex items-center gap-1">
          <span>Tap for Details</span>
        </div>
        <div className="w-1 h-1 bg-gray-600 rounded-full" />
        <div className="flex items-center gap-1">
          <span>Save</span>
          <span>→</span>
        </div>
      </div>

      {/* Card Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-md px-4 py-1 rounded-full border border-gray-700">
        <span className="text-white text-sm font-medium">
          {currentIndex + 1} / {events.length}
        </span>
      </div>
    </div>
  )
}
