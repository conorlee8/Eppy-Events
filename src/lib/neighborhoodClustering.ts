/**
 * Neighborhood-based clustering system
 * Groups events by neighborhood with smart density-based subdivision
 */

import type { Event, EventCluster } from '@/types'
import type { NeighborhoodCollection } from './neighborhoods'
import { findNeighborhood } from './neighborhoods'

interface NeighborhoodClusterOptions {
  maxEventsPerCluster: number
  minEventsToCluster: number
  densitySubdivisionThreshold: number
}

const DEFAULT_OPTIONS: NeighborhoodClusterOptions = {
  maxEventsPerCluster: 20,      // Subdivide if more than this (increased from 15)
  minEventsToCluster: 2,         // Don't cluster if less than this
  densitySubdivisionThreshold: 25 // Use density subdivision above this (increased from 20)
}

/**
 * Main neighborhood clustering function
 */
export function createNeighborhoodClusters(
  events: Event[],
  neighborhoods: NeighborhoodCollection | null,
  zoom: number,
  options: Partial<NeighborhoodClusterOptions> = {}
): EventCluster[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // If no neighborhoods loaded, fall back to simple clustering
  if (!neighborhoods) {
    return createSimpleClusters(events, opts)
  }

  // Group events by neighborhood
  const neighborhoodGroups = groupEventsByNeighborhood(events, neighborhoods)

  const clusters: EventCluster[] = []

  // Process each neighborhood group - ALWAYS create ONE cluster per neighborhood
  neighborhoodGroups.forEach((neighborhoodEvents, neighborhoodName) => {
    // ALWAYS create a single neighborhood cluster regardless of event count
    clusters.push(createNeighborhoodCluster(neighborhoodEvents, neighborhoodName, neighborhoods))
  })

  // Return clusters without overlap prevention (it was pushing markers outside neighborhoods)
  return clusters
}

/**
 * Group events by their neighborhood
 */
function groupEventsByNeighborhood(
  events: Event[],
  neighborhoods: NeighborhoodCollection
): Map<string, Event[]> {
  const groups = new Map<string, Event[]>()

  events.forEach(event => {
    const neighborhood = findNeighborhood(event.longitude, event.latitude, neighborhoods)

    // Skip events that don't match any neighborhood (likely over water or outside SF)
    if (!neighborhood?.properties.name) {
      console.log('⚠️ Event not in any neighborhood:', event.title, event.latitude, event.longitude)
      return
    }

    const neighborhoodName = neighborhood.properties.name

    if (!groups.has(neighborhoodName)) {
      groups.set(neighborhoodName, [])
    }
    groups.get(neighborhoodName)!.push(event)
  })

  return groups
}

/**
 * Create a single neighborhood cluster
 */
function createNeighborhoodCluster(
  events: Event[],
  neighborhoodName: string,
  neighborhoods?: NeighborhoodCollection
): EventCluster {
  let latitude: number
  let longitude: number
  let neighborhoodRadius = 0.5 // default radius in km

  // ALWAYS use the centroid of actual events, not polygon centroid
  // This ensures markers are placed where events actually are (on land)
  latitude = events.reduce((sum, e) => sum + e.latitude, 0) / events.length
  longitude = events.reduce((sum, e) => sum + e.longitude, 0) / events.length

  // Debug: Log if marker would be placed over water (longitude < -122.5 is likely water for SF)
  if (longitude < -122.5 || longitude > -122.35 || latitude < 37.7 || latitude > 37.82) {
    console.warn(`⚠️ Marker for ${neighborhoodName} may be over water:`, {
      lat: latitude,
      lng: longitude,
      eventCount: events.length,
      firstEvent: events[0] ? `${events[0].title} (${events[0].latitude}, ${events[0].longitude})` : 'none'
    })
  }

  // Calculate neighborhood size if we have polygon data
  if (neighborhoods) {
    const neighborhood = neighborhoods.features.find(
      f => f.properties.name === neighborhoodName
    )

    if (neighborhood && neighborhood.geometry.type === 'Polygon') {
      // Calculate neighborhood size (max distance from center to any point)
      const coords = neighborhood.geometry.coordinates[0]
      const polygonCenterLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length
      const polygonCenterLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length

      neighborhoodRadius = Math.max(
        ...coords.map(coord =>
          getDistance(polygonCenterLat, polygonCenterLng, coord[1], coord[0])
        )
      )
    }
  }

  return {
    id: `neighborhood-${neighborhoodName.toLowerCase().replace(/\s+/g, '-')}`,
    events,
    latitude,
    longitude,
    radius: neighborhoodRadius,
    isStable: true,
    metadata: {
      neighborhoodName,
      type: 'neighborhood',
      boundaryRadius: neighborhoodRadius
    }
  }
}

/**
 * Subdivide large neighborhood into density-based clusters
 */
function subdivideLargeNeighborhood(
  events: Event[],
  neighborhoodName: string,
  options: NeighborhoodClusterOptions
): EventCluster[] {
  // Use k-means clustering within the neighborhood
  const k = Math.ceil(events.length / options.maxEventsPerCluster)
  const subclusters = kMeansClustering(events, k)

  return subclusters.map((clusterEvents, index) => ({
    id: `neighborhood-${neighborhoodName.toLowerCase().replace(/\s+/g, '-')}-${index}`,
    events: clusterEvents,
    latitude: clusterEvents.reduce((sum, e) => sum + e.latitude, 0) / clusterEvents.length,
    longitude: clusterEvents.reduce((sum, e) => sum + e.longitude, 0) / clusterEvents.length,
    radius: calculateClusterRadius(clusterEvents),
    isStable: true,
    metadata: {
      neighborhoodName,
      subcluster: index + 1,
      totalSubclusters: subclusters.length,
      type: 'neighborhood-subdivision'
    }
  }))
}

/**
 * Simple k-means clustering for density subdivision
 */
function kMeansClustering(events: Event[], k: number): Event[][] {
  if (events.length <= k) {
    return events.map(e => [e])
  }

  // Initialize centroids by spreading them across the event space
  const centroids: { lat: number; lng: number }[] = []
  const step = Math.floor(events.length / k)
  for (let i = 0; i < k; i++) {
    const event = events[i * step]
    centroids.push({ lat: event.latitude, lng: event.longitude })
  }

  let assignments: number[] = new Array(events.length)
  let converged = false
  let iterations = 0
  const maxIterations = 10

  while (!converged && iterations < maxIterations) {
    // Assign events to nearest centroid
    const newAssignments = events.map((event, idx) => {
      let minDist = Infinity
      let closestCentroid = 0

      centroids.forEach((centroid, centroidIdx) => {
        const dist = getDistance(
          event.latitude,
          event.longitude,
          centroid.lat,
          centroid.lng
        )
        if (dist < minDist) {
          minDist = dist
          closestCentroid = centroidIdx
        }
      })

      return closestCentroid
    })

    // Check convergence
    converged = newAssignments.every((val, idx) => val === assignments[idx])
    assignments = newAssignments

    // Update centroids
    centroids.forEach((centroid, centroidIdx) => {
      const clusterEvents = events.filter((_, idx) => assignments[idx] === centroidIdx)
      if (clusterEvents.length > 0) {
        centroid.lat = clusterEvents.reduce((sum, e) => sum + e.latitude, 0) / clusterEvents.length
        centroid.lng = clusterEvents.reduce((sum, e) => sum + e.longitude, 0) / clusterEvents.length
      }
    })

    iterations++
  }

  // Group events by assignment
  const clusters: Event[][] = Array.from({ length: k }, () => [])
  events.forEach((event, idx) => {
    clusters[assignments[idx]].push(event)
  })

  // Remove empty clusters
  return clusters.filter(cluster => cluster.length > 0)
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
 * Fallback clustering when neighborhoods aren't available
 */
function createSimpleClusters(
  events: Event[],
  options: NeighborhoodClusterOptions
): EventCluster[] {
  // Simple distance-based clustering
  const clusters: EventCluster[] = []
  const assigned = new Set<string>()

  events.forEach(event => {
    if (assigned.has(event.id)) return

    const nearbyEvents = events.filter(e => {
      if (assigned.has(e.id)) return false
      const dist = getDistance(event.latitude, event.longitude, e.latitude, e.longitude)
      return dist < 0.5 // 500m radius
    })

    if (nearbyEvents.length >= options.minEventsToCluster) {
      nearbyEvents.forEach(e => assigned.add(e.id))
      clusters.push({
        id: `simple-cluster-${clusters.length}`,
        events: nearbyEvents,
        latitude: nearbyEvents.reduce((sum, e) => sum + e.latitude, 0) / nearbyEvents.length,
        longitude: nearbyEvents.reduce((sum, e) => sum + e.longitude, 0) / nearbyEvents.length,
        radius: calculateClusterRadius(nearbyEvents),
        isStable: true
      })
    } else {
      assigned.add(event.id)
      clusters.push({
        id: event.id,
        events: [event],
        latitude: event.latitude,
        longitude: event.longitude,
        radius: 0,
        isStable: true
      })
    }
  })

  return clusters
}

/**
 * Get cluster display label
 */
export function getClusterLabel(cluster: EventCluster): string {
  const count = cluster.events.length
  const metadata = cluster.metadata

  if (metadata?.neighborhoodName) {
    if (metadata.subcluster) {
      return `${metadata.neighborhoodName} (${count} events)`
    }
    return `${metadata.neighborhoodName} (${count} events)`
  }

  return `${count} events`
}

/**
 * Get appropriate zoom level for cluster type
 */
export function getClusterZoomLevel(cluster: EventCluster, currentZoom: number): number {
  const metadata = cluster.metadata

  // Neighborhood clusters - zoom to neighborhood detail
  if (metadata?.type === 'neighborhood') {
    return 15
  }

  // Subdivision clusters - zoom closer
  if (metadata?.type === 'neighborhood-subdivision') {
    return 16
  }

  // Default - zoom in a bit
  return Math.min(currentZoom + 2, 17)
}

/**
 * Prevent marker overlap by adjusting positions of markers that are too close
 */
function preventMarkerOverlap(clusters: EventCluster[], zoom: number): EventCluster[] {
  // Minimum distance between markers in km (scales with zoom)
  const minDistance = zoom > 13 ? 0.15 : zoom > 12 ? 0.25 : 0.4

  const adjustedClusters = [...clusters]
  const moved = new Set<string>()

  // Check each pair of clusters for overlap
  for (let i = 0; i < adjustedClusters.length; i++) {
    for (let j = i + 1; j < adjustedClusters.length; j++) {
      const cluster1 = adjustedClusters[i]
      const cluster2 = adjustedClusters[j]

      const distance = getDistance(
        cluster1.latitude,
        cluster1.longitude,
        cluster2.latitude,
        cluster2.longitude
      )

      // If markers are too close, push them apart slightly
      if (distance < minDistance && distance > 0) {
        // Calculate push vector
        const midLat = (cluster1.latitude + cluster2.latitude) / 2
        const midLng = (cluster1.longitude + cluster2.longitude) / 2

        // Push each marker away from the midpoint
        const pushDistance = (minDistance - distance) / 2

        // Only move if we haven't moved this cluster yet (to preserve original positions as much as possible)
        if (!moved.has(cluster1.id)) {
          const angle1 = Math.atan2(cluster1.latitude - midLat, cluster1.longitude - midLng)
          const latOffset = Math.sin(angle1) * (pushDistance / 111) // ~111km per degree latitude
          const lngOffset = Math.cos(angle1) * (pushDistance / (111 * Math.cos(cluster1.latitude * Math.PI / 180)))

          adjustedClusters[i] = {
            ...cluster1,
            latitude: cluster1.latitude + latOffset,
            longitude: cluster1.longitude + lngOffset
          }
          moved.add(cluster1.id)
        }

        if (!moved.has(cluster2.id)) {
          const angle2 = Math.atan2(cluster2.latitude - midLat, cluster2.longitude - midLng)
          const latOffset = Math.sin(angle2) * (pushDistance / 111)
          const lngOffset = Math.cos(angle2) * (pushDistance / (111 * Math.cos(cluster2.latitude * Math.PI / 180)))

          adjustedClusters[j] = {
            ...cluster2,
            latitude: cluster2.latitude + latOffset,
            longitude: cluster2.longitude + lngOffset
          }
          moved.add(cluster2.id)
        }
      }
    }
  }

  return adjustedClusters
}
