/**
 * BestTime API service
 * Manages venue searches and busy time forecasts
 */

const BESTTIME_API_BASE = 'https://besttime.app/api/v1'

// Get API key (works in both Next.js and scripts)
function getPrivateKey(): string {
  const key = process.env.BESTTIME_API_PRIVATE_KEY
  if (!key) {
    throw new Error('BESTTIME_API_PRIVATE_KEY environment variable is not set')
  }
  return key
}

// Event venue types to target (no retail)
export const EVENT_VENUE_TYPES = [
  'BAR',
  'NIGHT_CLUB',
  'CASINO',
  'THEATER',
  'CONCERT_HALL',
  'MUSEUM',
  'ART_GALLERY',
  'PARK',
  'STADIUM',
  'LIBRARY',
  'CAFE',
  'RESTAURANT'
]

export interface BestTimeVenue {
  venue_id: string
  venue_name: string
  venue_address: string
  venue_lat: number
  venue_lon: number  // BestTime uses 'lon' not 'lng'
  venue_type?: string  // Optional - not always provided
}

export interface BusyHour {
  hour: number
  intensity: number // 0-100
}

export interface BusyDay {
  day: number // 0-6 (Monday-Sunday)
  busy_hours: BusyHour[]
}

export interface BusyForecast {
  venue_id: string
  week: BusyDay[]
}

/**
 * Search for event venues in a city (with async polling)
 * BestTime API runs searches in the background, so we need to:
 * 1. Start the search job
 * 2. Poll for completion
 * 3. Return results when ready
 */
export async function searchEventVenues(
  lat: number,
  lng: number,
  radius: number = 2000, // meters (BestTime default)
  limit: number = 200,
  fast: boolean = true // Fast mode (60 max) vs slow mode (200 max, ~60s)
): Promise<BestTimeVenue[]> {
  // Round to 3 decimal places (BestTime requirement)
  const roundedLat = Math.round(lat * 1000) / 1000
  const roundedLng = Math.round(lng * 1000) / 1000

  console.log(`🔍 Starting BestTime venue search: ${roundedLat}, ${roundedLng} (${radius}m radius, ${fast ? 'fast' : 'slow'} mode)`)

  // Step 1: Start the background search job
  const params = new URLSearchParams({
    api_key_private: getPrivateKey(),
    q: 'bars nightlife music venues events', // Search query for event venues
    lat: roundedLat.toString(),
    lng: roundedLng.toString(),
    radius: radius.toString(),
    num: (fast ? Math.min(limit, 60) : Math.min(limit, 200)).toString(), // Fast=60 max, Slow=200 max
    format: 'raw'
  })

  // Only add fast parameter if true
  if (fast) {
    params.append('fast', 'true')
  }

  const searchResponse = await fetch(`${BESTTIME_API_BASE}/venues/search?${params}`, {
    method: 'POST'
  })

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text()
    throw new Error(`BestTime API error: ${searchResponse.statusText} - ${errorText}`)
  }

  const searchData = await searchResponse.json()

  if (searchData.status !== 'OK' || !searchData.job_id) {
    throw new Error(`BestTime search failed: ${searchData.message || 'Unknown error'}`)
  }

  const jobId = searchData.job_id
  // Use the progress URL provided by BestTime
  const progressUrl = searchData._links?.venue_search_progress

  if (!progressUrl) {
    throw new Error('BestTime API did not provide progress URL')
  }

  console.log(`⏳ Search job started: ${jobId}`)

  // Step 2: Poll for completion (max 60 seconds, check every 2 seconds)
  const maxAttempts = 30
  const pollInterval = 2000 // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`📊 Polling progress (attempt ${attempt}/${maxAttempts})...`)

    // Use the exact URL provided by BestTime
    const progressResponse = await fetch(progressUrl)

    if (!progressResponse.ok) {
      console.error(`⚠️ Progress check failed: ${progressResponse.statusText}`)
      continue
    }

    const progressData = await progressResponse.json()

    // Check if job is complete
    if (progressData.status === 'OK' && progressData.job_finished === true) {
      console.log(`✅ Search complete! Found ${progressData.venues?.length || 0} venues`)
      return progressData.venues || []
    }

    // Check for errors
    if (progressData.status === 'Error') {
      throw new Error(`BestTime search error: ${progressData.message}`)
    }

    // Wait before next poll
    if (attempt < maxAttempts) {
      console.log(`⏱️  Job still running, waiting ${pollInterval/1000}s...`)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  // Timeout
  throw new Error(`BestTime search timeout after ${maxAttempts * pollInterval / 1000} seconds`)
}

/**
 * Grid-based venue search for better city coverage
 * Returns ~500 venues by searching multiple strategic locations
 */
export async function searchEventVenuesGrid(
  centerLat: number,
  centerLng: number
): Promise<BestTimeVenue[]> {
  console.log(`🗺️  Starting grid search centered on ${centerLat}, ${centerLng}`)

  // Define search grid - WIDER coverage with less overlap
  // Strategy: Push cardinal points further out to minimize overlap
  const searches = [
    // Center (Downtown) - SLOW search, 5km radius for maximum coverage
    { lat: centerLat, lng: centerLng, radius: 5000, fast: false, name: 'Downtown' },

    // North - 6km away to avoid overlap
    { lat: centerLat + 0.054, lng: centerLng, radius: 3000, fast: true, name: 'North Austin' },

    // South - 6km away to avoid overlap
    { lat: centerLat - 0.054, lng: centerLng, radius: 3000, fast: true, name: 'South Austin' },

    // East - 6km away to avoid overlap
    { lat: centerLat, lng: centerLng + 0.065, radius: 3000, fast: true, name: 'East Austin' },

    // West - 6km away to avoid overlap
    { lat: centerLat, lng: centerLng - 0.065, radius: 3000, fast: true, name: 'West Austin' },

    // Northwest
    { lat: centerLat + 0.045, lng: centerLng - 0.045, radius: 2500, fast: true, name: 'Northwest' },

    // Northeast
    { lat: centerLat + 0.045, lng: centerLng + 0.045, radius: 2500, fast: true, name: 'Northeast' },

    // Southwest
    { lat: centerLat - 0.045, lng: centerLng - 0.045, radius: 2500, fast: true, name: 'Southwest' },

    // Southeast
    { lat: centerLat - 0.045, lng: centerLng + 0.045, radius: 2500, fast: true, name: 'Southeast' }
  ]

  console.log(`📍 Grid pattern: 1 slow (5km downtown) + 8 fast (cardinals + corners)`)

  // Execute all searches in parallel
  const searchPromises = searches.map(search =>
    searchEventVenues(search.lat, search.lng, search.radius, 200, search.fast)
      .then(venues => {
        console.log(`✅ ${search.name} search complete: ${venues.length} venues`)
        return venues
      })
      .catch(error => {
        console.error(`❌ ${search.name} search failed:`, error)
        return [] // Return empty array on failure, don't block other searches
      })
  )

  // Wait for all searches to complete
  const results = await Promise.all(searchPromises)

  // Flatten and deduplicate by venue_id
  const allVenues = results.flat()
  const uniqueVenues = new Map<string, BestTimeVenue>()

  allVenues.forEach(venue => {
    if (venue.venue_id && !uniqueVenues.has(venue.venue_id)) {
      uniqueVenues.set(venue.venue_id, venue)
    }
  })

  const finalVenues = Array.from(uniqueVenues.values())
  console.log(`🎯 Grid search complete: ${finalVenues.length} unique venues (${allVenues.length - finalVenues.length} duplicates removed)`)

  return finalVenues
}

/**
 * Get busy forecast for a specific venue
 */
export async function getVenueBusyForecast(venueId: string): Promise<BusyForecast | null> {
  const response = await fetch(
    `${BESTTIME_API_BASE}/forecasts/${venueId}?api_key_private=${getPrivateKey()}`
  )

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`BestTime API error: ${response.statusText}`)
  }

  const data = await response.json()
  return {
    venue_id: venueId,
    week: data.analysis || []
  }
}

/**
 * Query week forecast (full details)
 */
export async function queryWeekForecast(venueId: string): Promise<any> {
  const response = await fetch(
    `${BESTTIME_API_BASE}/forecasts/${venueId}/week?api_key_private=${getPrivateKey()}`
  )

  if (!response.ok) {
    throw new Error(`BestTime API error: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Filter venues by busy times (find venues busy during specific hours)
 */
export async function filterBusyVenues(
  lat: number,
  lng: number,
  radius: number,
  hourMin: number,
  hourMax: number,
  busyMin: number = 50
): Promise<BestTimeVenue[]> {
  const types = EVENT_VENUE_TYPES.join(',')
  const url = `${BESTTIME_API_BASE}/venues/filter?api_key_private=${getPrivateKey()}&types=${types}&lat=${lat}&lng=${lng}&radius=${radius}&hour_min=${hourMin}&hour_max=${hourMax}&busy_min=${busyMin}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`BestTime API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.venues || []
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private requestsPerSecond: number

  constructor(requestsPerSecond: number = 10) {
    this.requestsPerSecond = requestsPerSecond
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.process()
      }
    })
  }

  private async process() {
    this.processing = true
    const delay = 1000 / this.requestsPerSecond

    while (this.queue.length > 0) {
      const fn = this.queue.shift()
      if (fn) {
        await fn()
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    this.processing = false
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter(10) // 10 requests/sec
