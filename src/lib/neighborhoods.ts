/**
 * Neighborhood boundary management system
 * Uses locally cached GeoJSON data for worldwide scalability
 */

import type { Position, Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export interface NeighborhoodFeature extends Feature<Polygon | MultiPolygon> {
  properties: {
    name: string
    cartodb_id?: number
    created_at?: string
    updated_at?: string
    [key: string]: any
  }
}

export interface NeighborhoodCollection extends FeatureCollection<Polygon | MultiPolygon> {
  features: NeighborhoodFeature[]
}

// Cache for loaded neighborhood data
const neighborhoodCache: Map<string, NeighborhoodCollection> = new Map()

/**
 * Load neighborhood boundaries for a city
 * @param citySlug - City identifier (e.g., 'san-francisco', 'austin', 'new-york')
 */
export async function loadNeighborhoods(citySlug: string): Promise<NeighborhoodCollection> {
  // Check cache first
  if (neighborhoodCache.has(citySlug)) {
    return neighborhoodCache.get(citySlug)!
  }

  try {
    const response = await fetch(`/data/neighborhoods/${citySlug}.geojson`)

    if (!response.ok) {
      throw new Error(`Failed to load neighborhoods for ${citySlug}: ${response.statusText}`)
    }

    const data: NeighborhoodCollection = await response.json()

    // Cache the data
    neighborhoodCache.set(citySlug, data)

    console.log(`📍 Loaded ${data.features.length} neighborhoods for ${citySlug}`)

    return data
  } catch (error) {
    console.error(`Error loading neighborhoods for ${citySlug}:`, error)
    throw error
  }
}

/**
 * Find which neighborhood a point belongs to using point-in-polygon algorithm
 * @param lng - Longitude
 * @param lat - Latitude
 * @param neighborhoods - Neighborhood collection
 */
export function findNeighborhood(
  lng: number,
  lat: number,
  neighborhoods: NeighborhoodCollection
): NeighborhoodFeature | null {
  const point: Position = [lng, lat]

  for (const feature of neighborhoods.features) {
    if (isPointInPolygon(point, feature)) {
      return feature
    }
  }

  return null
}

/**
 * Point-in-polygon algorithm using ray casting
 * Works with Polygon and MultiPolygon geometries
 */
function isPointInPolygon(
  point: Position,
  feature: NeighborhoodFeature
): boolean {
  const [x, y] = point
  const geometry = feature.geometry

  if (geometry.type === 'Polygon') {
    return isPointInSinglePolygon(x, y, geometry.coordinates)
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygon =>
      isPointInSinglePolygon(x, y, polygon)
    )
  }

  return false
}

/**
 * Ray casting algorithm for a single polygon
 */
function isPointInSinglePolygon(
  x: number,
  y: number,
  rings: Position[][]
): boolean {
  // Check outer ring (first ring)
  const outerRing = rings[0]
  let inside = false

  for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
    const xi = outerRing[i][0]
    const yi = outerRing[i][1]
    const xj = outerRing[j][0]
    const yj = outerRing[j][1]

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  // If not in outer ring, return false
  if (!inside) return false

  // Check if point is in any hole (inner rings)
  for (let r = 1; r < rings.length; r++) {
    const innerRing = rings[r]
    let inHole = false

    for (let i = 0, j = innerRing.length - 1; i < innerRing.length; j = i++) {
      const xi = innerRing[i][0]
      const yi = innerRing[i][1]
      const xj = innerRing[j][0]
      const yj = innerRing[j][1]

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

      if (intersect) inHole = !inHole
    }

    // If in a hole, point is outside the polygon
    if (inHole) return false
  }

  return true
}

/**
 * Get all neighborhoods within a bounding box
 * Useful for viewport-based filtering
 */
export function getNeighborhoodsInBounds(
  bounds: {
    north: number
    south: number
    east: number
    west: number
  },
  neighborhoods: NeighborhoodCollection
): NeighborhoodFeature[] {
  return neighborhoods.features.filter(feature => {
    // Simple bounding box overlap check
    const bbox = getBoundingBox(feature)

    return !(
      bbox.west > bounds.east ||
      bbox.east < bounds.west ||
      bbox.north < bounds.south ||
      bbox.south > bounds.north
    )
  })
}

/**
 * Calculate bounding box for a feature
 */
function getBoundingBox(feature: NeighborhoodFeature): {
  north: number
  south: number
  east: number
  west: number
} {
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity

  const geometry = feature.geometry

  const processCoordinates = (coords: Position[]) => {
    coords.forEach(([lng, lat]) => {
      if (lng > east) east = lng
      if (lng < west) west = lng
      if (lat > north) north = lat
      if (lat < south) south = lat
    })
  }

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => processCoordinates(ring))
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon =>
      polygon.forEach(ring => processCoordinates(ring))
    )
  }

  return { north, south, east, west }
}

/**
 * Get neighborhood statistics
 */
export function getNeighborhoodStats(
  neighborhoods: NeighborhoodCollection
): {
  total: number
  names: string[]
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
} {
  const names = neighborhoods.features
    .map(f => f.properties.name)
    .sort()

  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity

  neighborhoods.features.forEach(feature => {
    const bbox = getBoundingBox(feature)
    if (bbox.north > north) north = bbox.north
    if (bbox.south < south) south = bbox.south
    if (bbox.east > east) east = bbox.east
    if (bbox.west < west) west = bbox.west
  })

  return {
    total: neighborhoods.features.length,
    names,
    bounds: { north, south, east, west }
  }
}

/**
 * Filter events by neighborhood
 */
export function filterEventsByNeighborhood(
  events: Array<{ latitude: number; longitude: number }>,
  neighborhoodName: string,
  neighborhoods: NeighborhoodCollection
): Array<{ latitude: number; longitude: number }> {
  const neighborhood = neighborhoods.features.find(
    f => f.properties.name === neighborhoodName
  )

  if (!neighborhood) {
    return []
  }

  return events.filter(event =>
    isPointInPolygon([event.longitude, event.latitude], neighborhood)
  )
}

/**
 * Calculate the centroid (center point) of a polygon
 */
function calculatePolygonCentroid(coordinates: Position[][]): [number, number] {
  // Use the outer ring (first ring)
  const ring = coordinates[0]

  let latSum = 0
  let lngSum = 0
  let count = 0

  for (const [lng, lat] of ring) {
    lngSum += lng
    latSum += lat
    count++
  }

  return [lngSum / count, latSum / count]
}

/**
 * Get centroids for all neighborhoods
 */
export function getNeighborhoodCentroids(
  neighborhoods: NeighborhoodCollection
): Array<{ name: string; lat: number; lng: number }> {
  return neighborhoods.features.map(feature => {
    let centroid: [number, number]

    if (feature.geometry.type === 'Polygon') {
      centroid = calculatePolygonCentroid(feature.geometry.coordinates)
    } else {
      // MultiPolygon - use the centroid of the first/largest polygon
      centroid = calculatePolygonCentroid(feature.geometry.coordinates[0])
    }

    return {
      name: feature.properties.name,
      lng: centroid[0],
      lat: centroid[1]
    }
  })
}
