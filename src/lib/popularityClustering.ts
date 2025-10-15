/**
 * Popularity-based clustering system
 * Clusters events by attendance size and popularity for zoomed-out views
 */

import type { Event, EventCluster } from '@/types'

interface PopularityClusterOptions {
  minAttendanceForCluster: number
  popularityWeight: number
  proximityRadius: number // km
}

const DEFAULT_OPTIONS: PopularityClusterOptions = {
  minAttendanceForCluster: 80,    // Group events with 80+ expected attendance (lowered from 100)
  popularityWeight: 0.7,             // How much popularity matters vs proximity
  proximityRadius: 3.5                 // 3.5km radius for grouping popular events (increased from 2)
}

/**
 * Main popularity clustering function
 * Groups events by their popularity/attendance size
 */
export function createPopularityClusters(
  events: Event[],
  zoom: number,
  options: Partial<PopularityClusterOptions> = {}
): EventCluster[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Separate into popular and regular events
  const popularEvents = events.filter(e => getEventPopularity(e) >= opts.minAttendanceForCluster)
  const regularEvents = events.filter(e => getEventPopularity(e) < opts.minAttendanceForCluster)

  const clusters: EventCluster[] = []
  const assigned = new Set<string>()

  // Sort popular events by popularity (descending)
  const sortedPopular = popularEvents.sort((a, b) =>
    getEventPopularity(b) - getEventPopularity(a)
  )

  // Cluster popular events together if they're close
  sortedPopular.forEach(event => {
    if (assigned.has(event.id)) return

    const popularity = getEventPopularity(event)

    // Find nearby events with similar popularity
    const nearbyEvents = sortedPopular.filter(e => {
      if (assigned.has(e.id)) return false
      if (e.id === event.id) return true

      const dist = getDistance(
        event.latitude,
        event.longitude,
        e.latitude,
        e.longitude
      )

      const popDiff = Math.abs(getEventPopularity(e) - popularity)
      const maxPopDiff = popularity * 0.5 // Within 50% popularity range

      return dist < opts.proximityRadius && popDiff < maxPopDiff
    })

    // Mark as assigned
    nearbyEvents.forEach(e => assigned.add(e.id))

    // Create cluster
    if (nearbyEvents.length >= 2) {
      clusters.push(createPopularityCluster(nearbyEvents, 'popular'))
    } else {
      // Single popular event gets its own marker
      clusters.push({
        id: event.id,
        events: [event],
        latitude: event.latitude,
        longitude: event.longitude,
        radius: 0,
        isStable: true,
        metadata: {
          type: 'popular-event',
          popularity: popularity
        }
      })
    }
  })

  // Group remaining regular events by simple proximity
  regularEvents.forEach(event => {
    if (assigned.has(event.id)) return

    const nearbyEvents = regularEvents.filter(e => {
      if (assigned.has(e.id)) return false
      if (e.id === event.id) return true

      const dist = getDistance(
        event.latitude,
        event.longitude,
        e.latitude,
        e.longitude
      )

      return dist < opts.proximityRadius * 2.0 // Much wider radius for regular events to reduce clutter
    })

    nearbyEvents.forEach(e => assigned.add(e.id))

    if (nearbyEvents.length >= 2) {  // Cluster even pairs to reduce clutter
      clusters.push(createPopularityCluster(nearbyEvents, 'regular'))
    } else {
      // Add as individual events
      nearbyEvents.forEach(e => {
        clusters.push({
          id: e.id,
          events: [e],
          latitude: e.latitude,
          longitude: e.longitude,
          radius: 0,
          isStable: true
        })
      })
    }
  })

  return clusters
}

/**
 * Create a popularity-based cluster
 */
function createPopularityCluster(
  events: Event[],
  clusterType: 'popular' | 'regular'
): EventCluster {
  // Calculate weighted centroid (popular events have more weight)
  let totalWeight = 0
  let weightedLat = 0
  let weightedLng = 0

  events.forEach(event => {
    const weight = clusterType === 'popular' ? getEventPopularity(event) : 1
    totalWeight += weight
    weightedLat += event.latitude * weight
    weightedLng += event.longitude * weight
  })

  const totalPopularity = events.reduce((sum, e) => sum + getEventPopularity(e), 0)
  const avgPopularity = totalPopularity / events.length

  return {
    id: `popularity-${clusterType}-${events[0].id}`,
    events,
    latitude: weightedLat / totalWeight,
    longitude: weightedLng / totalWeight,
    radius: calculateClusterRadius(events),
    isStable: true,
    metadata: {
      type: clusterType === 'popular' ? 'popularity-cluster' : 'regular-cluster',
      totalPopularity,
      avgPopularity,
      popularityLevel: getPopularityLevel(avgPopularity)
    }
  }
}

/**
 * Get event popularity score
 */
function getEventPopularity(event: Event): number {
  // Calculate based on multiple factors
  let score = 0

  // Price tier (free/cheap events often have more attendance)
  if (event.price === 0) score += 100
  else if (event.price < 20) score += 50
  else if (event.price < 50) score += 20

  // Category popularity (some categories naturally draw bigger crowds)
  const popularCategories = ['music', 'festival', 'food', 'sports']
  if (popularCategories.includes(event.category.toLowerCase())) {
    score += 50
  }

  // Vibe indicators
  const popularVibes = ['lit', 'epic', 'legendary', 'hype']
  if (event.vibe && popularVibes.some(v => event.vibe?.toLowerCase().includes(v))) {
    score += 30
  }

  // Base score for all events
  score += 20

  return score
}

/**
 * Get popularity level label
 */
function getPopularityLevel(popularity: number): string {
  if (popularity >= 150) return 'Major Event'
  if (popularity >= 100) return 'Popular'
  if (popularity >= 50) return 'Moderate'
  return 'Small'
}

/**
 * Calculate cluster radius based on event spread
 */
function calculateClusterRadius(events: Event[]): number {
  if (events.length === 1) return 0

  const centerLat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length
  const centerLng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length

  const maxDistance = Math.max(
    ...events.map(e => getDistance(centerLat, centerLng, e.latitude, e.longitude))
  )

  return maxDistance
}

/**
 * Calculate distance between two points (km)
 */
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Get cluster display label
 */
export function getPopularityClusterLabel(cluster: EventCluster): string {
  const count = cluster.events.length
  const metadata = cluster.metadata

  if (metadata?.popularityLevel) {
    return `${metadata.popularityLevel} - ${count} events`
  }

  if (metadata?.type === 'popular-event') {
    return `Popular Event`
  }

  return `${count} events`
}
