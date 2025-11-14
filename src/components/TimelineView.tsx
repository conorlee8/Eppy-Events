'use client'

import { useMemo } from 'react'
import type { Event } from '@/types'
import MobileEventCard from './MobileEventCard'

interface TimelineViewProps {
  events: Event[]
  variant?: 'desktop' | 'mobile'
}

interface TimeSlot {
  label: string
  icon: string
  time: Date
  events: Event[]
  isNow?: boolean
  isPast?: boolean
}

export default function TimelineView({ events, variant = 'desktop' }: TimelineViewProps) {
  // Group events by time slots
  const timeSlots = useMemo(() => {
    const now = new Date()
    const currentHour = now.getHours()

    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    // Define time slots - show ALL events (for demo with mock data)
    const slots: TimeSlot[] = []

    // Use all events (don't filter by date for demo purposes with old mock data)
    const upcomingEvents = sortedEvents

    // Group by day
    const eventsByDay = new Map<string, Event[]>()
    upcomingEvents.forEach(event => {
      const eventDate = new Date(event.startTime)
      const dayKey = eventDate.toDateString()
      if (!eventsByDay.has(dayKey)) {
        eventsByDay.set(dayKey, [])
      }
      eventsByDay.get(dayKey)!.push(event)
    })

    // Create slots for each day
    eventsByDay.forEach((dayEvents, dayKey) => {
      const dayDate = new Date(dayKey)
      const isToday = dayDate.toDateString() === now.toDateString()
      const isTomorrow = dayDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()

      // Morning (6 AM - 12 PM)
      const morningEvents = dayEvents.filter(event => {
        const hour = new Date(event.startTime).getHours()
        return hour >= 6 && hour < 12
      })

      if (morningEvents.length > 0) {
        slots.push({
          label: isToday ? 'This Morning' : isTomorrow ? 'Tomorrow Morning' : `${dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Morning`,
          icon: '🌅',
          time: dayDate,
          events: morningEvents
        })
      }

      // Afternoon (12 PM - 5 PM)
      const afternoonEvents = dayEvents.filter(event => {
        const hour = new Date(event.startTime).getHours()
        return hour >= 12 && hour < 17
      })

      if (afternoonEvents.length > 0) {
        slots.push({
          label: isToday ? 'This Afternoon' : isTomorrow ? 'Tomorrow Afternoon' : `${dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Afternoon`,
          icon: '☀️',
          time: dayDate,
          events: afternoonEvents
        })
      }

      // Evening (5 PM - 9 PM)
      const eveningEvents = dayEvents.filter(event => {
        const hour = new Date(event.startTime).getHours()
        return hour >= 17 && hour < 21
      })

      if (eveningEvents.length > 0) {
        slots.push({
          label: isToday ? 'This Evening' : isTomorrow ? 'Tomorrow Evening' : `${dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Evening`,
          icon: '🌆',
          time: dayDate,
          events: eveningEvents
        })
      }

      // Night (9 PM - 2 AM)
      const nightEvents = dayEvents.filter(event => {
        const hour = new Date(event.startTime).getHours()
        return hour >= 21 || hour < 2
      })

      if (nightEvents.length > 0) {
        slots.push({
          label: isToday ? 'Tonight' : isTomorrow ? 'Tomorrow Night' : `${dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Night`,
          icon: '🌙',
          time: dayDate,
          events: nightEvents
        })
      }

      // Late Night (2 AM - 6 AM)
      const lateNightEvents = dayEvents.filter(event => {
        const hour = new Date(event.startTime).getHours()
        return hour >= 2 && hour < 6
      })

      if (lateNightEvents.length > 0) {
        slots.push({
          label: isToday ? 'Late Night' : `${dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Late Night`,
          icon: '🦉',
          time: dayDate,
          events: lateNightEvents
        })
      }
    })

    // Check if first slot is happening now
    if (slots.length > 0) {
      const firstSlot = slots[0]
      const firstEventTime = new Date(firstSlot.events[0].startTime)
      const hourDiff = Math.abs(firstEventTime.getHours() - currentHour)

      if (firstEventTime.toDateString() === now.toDateString() && hourDiff <= 1) {
        firstSlot.isNow = true
        firstSlot.label = 'Happening Now'
        firstSlot.icon = '⚡'
      }
    }

    return slots
  }, [events])

  if (timeSlots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-6xl mb-4 opacity-20">⏰</div>
        <h3 className="text-lg font-bold text-white mb-2">No upcoming events</h3>
        <p className="text-sm text-gray-400">
          Check back later or adjust your filters
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {timeSlots.map((slot, index) => (
        <div key={index} className="space-y-3">
          {/* Time Slot Header */}
          <div className="flex items-center gap-3 sticky top-0 z-10 pb-2"
            style={{
              background: variant === 'desktop'
                ? 'linear-gradient(180deg, rgba(0,20,40,0.95) 0%, rgba(0,20,40,0.8) 100%)'
                : 'linear-gradient(180deg, rgba(10,20,40,0.98) 0%, rgba(10,20,40,0.9) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{
                background: slot.isNow
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(0,100,200,0.2))',
                border: slot.isNow ? '2px solid #fca5a5' : '1px solid rgba(0,200,255,0.3)',
                boxShadow: slot.isNow ? '0 0 20px rgba(239,68,68,0.4)' : 'none',
              }}
            >
              {slot.icon}
            </div>

            <div className="flex-1">
              <h3 className={`text-base font-bold ${slot.isNow ? 'text-red-400' : 'text-white'}`}>
                {slot.label}
              </h3>
              <p className="text-xs text-gray-400">
                {slot.events.length} event{slot.events.length !== 1 ? 's' : ''}
              </p>
            </div>

            {slot.isNow && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-300 font-medium">LIVE</span>
              </div>
            )}
          </div>

          {/* Events in this time slot */}
          <div className={`grid ${variant === 'desktop' ? 'grid-cols-1' : 'grid-cols-1'} gap-3`}>
            {slot.events.map(event => (
              <div
                key={event.id}
                className="transition-all duration-200 hover:scale-[1.01]"
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                }}
              >
                <MobileEventCard event={event} variant={variant === 'desktop' ? 'compact' : 'large'} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
