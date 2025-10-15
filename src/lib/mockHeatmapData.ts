// Mock cell phone heatmap data for San Francisco
// Simulates real population density patterns for development testing

export interface HeatmapPoint {
  latitude: number
  longitude: number
  intensity: number // 0-100, where 100 = highest density
  timestamp: string
  area: string // neighborhood name
}

export interface HeatmapZone {
  id: string
  name: string
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  baseIntensity: number // baseline population density
  timeMultipliers: {
    morning: number    // 6-12
    afternoon: number  // 12-18
    evening: number    // 18-24
    lateNight: number  // 0-6
  }
  dayMultipliers: {
    weekday: number
    weekend: number
  }
  eventMultiplier: number // boost when events are happening
}

// SF Neighborhood zones with realistic population patterns
export const mockHeatmapZones: HeatmapZone[] = [
  {
    id: 'soma',
    name: 'SOMA',
    bounds: {
      north: 37.7849,
      south: 37.7749,
      east: -122.3900,
      west: -122.4100
    },
    baseIntensity: 85, // High baseline - business district
    timeMultipliers: {
      morning: 1.2,    // Rush hour
      afternoon: 1.4,  // Business peak
      evening: 0.9,    // Some nightlife
      lateNight: 0.3   // Quiet
    },
    dayMultipliers: {
      weekday: 1.0,
      weekend: 0.6     // Less business activity
    },
    eventMultiplier: 1.8 // Major event venues
  },

  {
    id: 'mission',
    name: 'Mission District',
    bounds: {
      north: 37.7699,
      south: 37.7499,
      east: -122.4000,
      west: -122.4300
    },
    baseIntensity: 75,
    timeMultipliers: {
      morning: 0.8,
      afternoon: 1.0,
      evening: 1.6,    // Heavy nightlife
      lateNight: 1.2   // Late night activity
    },
    dayMultipliers: {
      weekday: 0.9,
      weekend: 1.4     // Weekend hotspot
    },
    eventMultiplier: 1.5
  },

  {
    id: 'financial',
    name: 'Financial District',
    bounds: {
      north: 37.7999,
      south: 37.7849,
      east: -122.3900,
      west: -122.4100
    },
    baseIntensity: 90,
    timeMultipliers: {
      morning: 1.5,    // Heavy commuter traffic
      afternoon: 1.3,
      evening: 0.4,    // Empties out
      lateNight: 0.1   // Ghost town
    },
    dayMultipliers: {
      weekday: 1.0,
      weekend: 0.2     // Dead on weekends
    },
    eventMultiplier: 1.0
  },

  {
    id: 'castro',
    name: 'Castro',
    bounds: {
      north: 37.7649,
      south: 37.7549,
      east: -122.4250,
      west: -122.4450
    },
    baseIntensity: 60,
    timeMultipliers: {
      morning: 0.7,
      afternoon: 0.9,
      evening: 1.4,
      lateNight: 1.1
    },
    dayMultipliers: {
      weekday: 0.8,
      weekend: 1.3
    },
    eventMultiplier: 2.0 // Major event destination
  },

  {
    id: 'haight',
    name: 'Haight-Ashbury',
    bounds: {
      north: 37.7749,
      south: 37.7649,
      east: -122.4350,
      west: -122.4550
    },
    baseIntensity: 55,
    timeMultipliers: {
      morning: 0.6,
      afternoon: 1.1,
      evening: 1.3,
      lateNight: 0.8
    },
    dayMultipliers: {
      weekday: 0.8,
      weekend: 1.4     // Tourist destination
    },
    eventMultiplier: 1.6
  },

  {
    id: 'richmond',
    name: 'Richmond',
    bounds: {
      north: 37.7849,
      south: 37.7649,
      east: -122.4550,
      west: -122.5100
    },
    baseIntensity: 40,
    timeMultipliers: {
      morning: 1.0,
      afternoon: 1.0,
      evening: 0.9,
      lateNight: 0.5
    },
    dayMultipliers: {
      weekday: 1.0,
      weekend: 1.1
    },
    eventMultiplier: 1.2
  },

  {
    id: 'sunset',
    name: 'Sunset',
    bounds: {
      north: 37.7649,
      south: 37.7299,
      east: -122.4550,
      west: -122.5100
    },
    baseIntensity: 35,
    timeMultipliers: {
      morning: 1.0,
      afternoon: 1.0,
      evening: 0.8,
      lateNight: 0.4
    },
    dayMultipliers: {
      weekday: 1.0,
      weekend: 1.0
    },
    eventMultiplier: 1.1
  }
]

// Generate realistic heatmap points based on zones and current time
export function generateMockHeatmapData(): HeatmapPoint[] {
  const now = new Date()
  const hour = now.getHours()
  const isWeekend = now.getDay() === 0 || now.getDay() === 6

  let timeMultiplier: keyof HeatmapZone['timeMultipliers']
  if (hour >= 6 && hour < 12) timeMultiplier = 'morning'
  else if (hour >= 12 && hour < 18) timeMultiplier = 'afternoon'
  else if (hour >= 18 && hour < 24) timeMultiplier = 'evening'
  else timeMultiplier = 'lateNight'

  const points: HeatmapPoint[] = []

  mockHeatmapZones.forEach(zone => {
    // Calculate current intensity based on time and day
    let intensity = zone.baseIntensity
    intensity *= zone.timeMultipliers[timeMultiplier]
    intensity *= isWeekend ? zone.dayMultipliers.weekend : zone.dayMultipliers.weekday

    // Add some randomness (±20%)
    intensity *= (0.8 + Math.random() * 0.4)
    intensity = Math.min(100, Math.max(0, intensity))

    // Generate multiple points within the zone
    const pointCount = Math.ceil(intensity / 20) // More points for higher intensity

    for (let i = 0; i < pointCount; i++) {
      // Random position within zone bounds
      const lat = zone.bounds.south + Math.random() * (zone.bounds.north - zone.bounds.south)
      const lng = zone.bounds.west + Math.random() * (zone.bounds.east - zone.bounds.west)

      // Vary intensity within the zone
      const pointIntensity = intensity * (0.7 + Math.random() * 0.6)

      points.push({
        latitude: lat,
        longitude: lng,
        intensity: Math.round(pointIntensity),
        timestamp: now.toISOString(),
        area: zone.name
      })
    }
  })

  return points
}

// Get intensity for a specific location
export function getLocationIntensity(lat: number, lng: number): number {
  const zone = mockHeatmapZones.find(zone =>
    lat >= zone.bounds.south &&
    lat <= zone.bounds.north &&
    lng >= zone.bounds.west &&
    lng <= zone.bounds.east
  )

  if (!zone) return 10 // Default low intensity for unknown areas

  const now = new Date()
  const hour = now.getHours()
  const isWeekend = now.getDay() === 0 || now.getDay() === 6

  let timeMultiplier: keyof HeatmapZone['timeMultipliers']
  if (hour >= 6 && hour < 12) timeMultiplier = 'morning'
  else if (hour >= 12 && hour < 18) timeMultiplier = 'afternoon'
  else if (hour >= 18 && hour < 24) timeMultiplier = 'evening'
  else timeMultiplier = 'lateNight'

  let intensity = zone.baseIntensity
  intensity *= zone.timeMultipliers[timeMultiplier]
  intensity *= isWeekend ? zone.dayMultipliers.weekend : zone.dayMultipliers.weekday

  return Math.round(Math.min(100, Math.max(0, intensity)))
}

// Simulate event impact on nearby heatmap
export function getEventImpactIntensity(eventLat: number, eventLng: number, eventPopularity: number): number {
  const baseIntensity = getLocationIntensity(eventLat, eventLng)
  const eventBoost = (eventPopularity / 100) * 40 // Up to 40 point boost for popular events
  return Math.round(Math.min(100, baseIntensity + eventBoost))
}