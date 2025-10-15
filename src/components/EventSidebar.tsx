'use client'

import { Fragment, useState, useMemo } from 'react'
import { XMarkIcon, MapPinIcon, ClockIcon, CurrencyDollarIcon, StarIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import type { Event } from '@/types'

interface EventSidebarProps {
  events: Event[]
  selectedEvent: Event | null
  selectedCluster: Event[] | null
  onEventSelect: (event: Event) => void
  onClusterClose: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function EventSidebar({
  events,
  selectedEvent,
  selectedCluster,
  onEventSelect,
  onClusterClose,
  searchQuery = '',
  onSearchChange
}: EventSidebarProps) {
  const [sortBy, setSortBy] = useState<'time' | 'popularity' | 'price' | 'category'>('popularity')
  const [filterBy, setFilterBy] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'size'>('size')
  const [isMobileOpen, setIsMobileOpen] = useState(false)

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
    if (price.min && price.max) {
      return `$${price.min}-$${price.max}`
    }
    return price.min ? `$${price.min}` : 'Free'
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      'Music': 'bg-red-500',
      'Sports': 'bg-teal-500',
      'Food': 'bg-blue-500',
      'Arts': 'bg-green-500',
      'Technology': 'bg-yellow-500',
      'Community': 'bg-pink-500',
      'Markets': 'bg-indigo-500',
      'Fitness': 'bg-purple-500'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-500'
  }

  const getEventSize = (event: Event) => {
    const maxPrice = event.price.max || 0
    const popularity = event.popularity || 0

    if (maxPrice > 300 || popularity >= 90) return 'major' // Stadium/Arena level
    if (maxPrice > 80 || popularity >= 60) return 'medium' // Theater/Club level
    return 'local' // Community/Bar level
  }

  const getSizeLabel = (size: string) => {
    switch (size) {
      case 'major': return 'Major Events'
      case 'medium': return 'Mid-Size Events'
      case 'local': return 'Local Events'
      default: return 'Events'
    }
  }

  const getSizeIcon = (size: string) => {
    switch (size) {
      case 'major': return <StarIcon className="h-4 w-4 text-yellow-400" />
      case 'medium': return <UserGroupIcon className="h-4 w-4 text-blue-400" />
      case 'local': return <MapPinIcon className="h-4 w-4 text-green-400" />
      default: return null
    }
  }

  // Smart sorting and filtering
  const processedEvents = useMemo(() => {
    let eventList = selectedCluster || events

    // Filter by category
    if (filterBy !== 'all') {
      eventList = eventList.filter(event => event.category === filterBy)
    }

    // Sort events
    const sorted = [...eventList].sort((a, b) => {
      switch (sortBy) {
        case 'time':
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0)
        case 'price':
          const aPrice = a.price.isFree ? 0 : (a.price.min || 0)
          const bPrice = b.price.isFree ? 0 : (b.price.min || 0)
          return aPrice - bPrice
        case 'category':
          return a.category.localeCompare(b.category)
        default:
          return 0
      }
    })

    // Group events
    if (groupBy === 'none') {
      return [{ title: 'All Events', events: sorted, key: 'all' }]
    } else if (groupBy === 'category') {
      const grouped = sorted.reduce((acc, event) => {
        const key = event.category
        if (!acc[key]) acc[key] = []
        acc[key].push(event)
        return acc
      }, {} as Record<string, Event[]>)

      return Object.entries(grouped).map(([category, events]) => ({
        title: category,
        events,
        key: category
      }))
    } else if (groupBy === 'size') {
      const grouped = sorted.reduce((acc, event) => {
        const size = getEventSize(event)
        if (!acc[size]) acc[size] = []
        acc[size].push(event)
        return acc
      }, {} as Record<string, Event[]>)

      return ['major', 'medium', 'local']
        .filter(size => grouped[size]?.length > 0)
        .map(size => ({
          title: getSizeLabel(size),
          events: grouped[size],
          key: size
        }))
    }

    return [{ title: 'All Events', events: sorted, key: 'all' }]
  }, [events, selectedCluster, sortBy, filterBy, groupBy])

  const categories = useMemo(() => {
    const eventList = selectedCluster || events
    const cats = ['all', ...new Set(eventList.map(e => e.category))]
    return cats
  }, [events, selectedCluster])

  return (
    <>
      {/* Mobile Toggle Button - More Prominent */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-full shadow-2xl shadow-blue-600/50 transition-all active:scale-95 flex flex-col items-center justify-center w-16 h-16"
      >
        <svg className="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-xs font-bold">{events.length}</span>
      </button>

      {/* Sidebar Container - Responsive */}
      <div className={`
        fixed lg:relative
        inset-y-0 left-0
        w-full sm:w-96 lg:w-80
        bg-gray-900/98 backdrop-blur-sm border-r border-gray-800
        flex flex-col h-full shadow-2xl
        transition-transform duration-300 ease-in-out
        z-40
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">
            {selectedCluster ? `${selectedCluster.length} Events` : `${events.length} Events Found`}
          </h2>
          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile Search Bar */}
        {onSearchChange && (
          <div className="mb-2 lg:hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search events..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
        )}

        {selectedCluster && (
          <button
            onClick={onClusterClose}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Back to all events
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 border-b border-gray-800 space-y-3">
        {/* Quick Category Filter */}
        <div className="flex flex-wrap gap-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setFilterBy(category)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filterBy === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>

        {/* Sort & Group */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
          >
            <option value="popularity">Sort: Popular</option>
            <option value="time">Sort: Time</option>
            <option value="price">Sort: Price</option>
            <option value="category">Sort: Category</option>
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="flex-1 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
          >
            <option value="size">Group: Size</option>
            <option value="category">Group: Category</option>
            <option value="none">Group: None</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {processedEvents.map((group) => (
          <div key={group.key}>
            {/* Group Header */}
            {groupBy !== 'none' && (
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
                <div className="flex items-center">
                  {groupBy === 'size' && getSizeIcon(group.key)}
                  <h3 className="text-sm font-medium text-white ml-2">
                    {group.title} ({group.events.length})
                  </h3>
                </div>
              </div>
            )}

            {/* Events in Group */}
            {group.events.map((event) => (
              <div
                key={event.id}
                onClick={() => {
                  onEventSelect(event)
                  // Close mobile sidebar when event is selected
                  if (window.innerWidth < 1024) {
                    setIsMobileOpen(false)
                  }
                }}
                className={`
                  p-4 border-b border-gray-800 cursor-pointer transition-all duration-200
                  hover:bg-gray-800 active:bg-gray-700
                  ${selectedEvent?.id === event.id
                    ? 'bg-blue-900/50 border-blue-700 shadow-lg scale-[1.02]'
                    : 'hover:bg-gray-800 hover:shadow-md hover:scale-[1.01]'
                  }
                `}
              >
                {/* Event Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    {getSizeIcon(getEventSize(event))}
                    <h3 className="font-medium text-white text-sm leading-tight pr-2">
                      {event.title}
                    </h3>
                  </div>
                  <div className={`
                    px-2 py-1 rounded text-xs font-medium text-white shrink-0
                    ${getCategoryColor(event.category)}
                  `}>
                    {event.category}
                  </div>
                </div>

                {/* Venue */}
                <div className="flex items-center text-gray-300 text-xs mb-2">
                  <MapPinIcon className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">{event.venue}</span>
                </div>

                {/* Time */}
                <div className="flex items-center text-gray-300 text-xs mb-2">
                  <ClockIcon className="h-3 w-3 mr-1 shrink-0" />
                  <span>{formatDate(event.startTime)}</span>
                </div>

                {/* Price */}
                <div className="flex items-center text-gray-300 text-xs mb-2">
                  <CurrencyDollarIcon className="h-3 w-3 mr-1 shrink-0" />
                  <span className={event.price.isFree ? 'text-green-400' : 'text-white'}>
                    {formatPrice(event.price)}
                  </span>
                  {event.popularity >= 90 && <span className="ml-2 text-yellow-400 text-xs">🔥 Hot</span>}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                  {event.description}
                </p>

                {/* Size & Popularity indicators */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {getEventSize(event) === 'major' && 'Major Event'}
                    {getEventSize(event) === 'medium' && 'Mid-size'}
                    {getEventSize(event) === 'local' && 'Local'}
                  </div>
                  {event.popularity > 70 && (
                    <div className="flex items-center">
                      <div className="h-1 w-1 bg-orange-400 rounded-full animate-pulse mr-1"></div>
                      <span className="text-orange-400 text-xs font-medium">Popular</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {events.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-4"></div>
              <p>Loading events in this area...</p>
              <p className="text-sm mt-1">Pan the map to discover more events</p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Mobile Backdrop */}
    {isMobileOpen && (
      <div
        className="lg:hidden fixed inset-0 bg-black/50 z-30"
        onClick={() => setIsMobileOpen(false)}
      />
    )}
    </>
  )
}