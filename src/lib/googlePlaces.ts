/**
 * Google Places API (New) Service
 * Handles venue search and photo fetching
 */

const GOOGLE_PLACES_API_BASE = 'https://places.googleapis.com/v1'

// Get API key from environment
function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new Error('GOOGLE_PLACES_API_KEY environment variable is not set')
  }
  return key
}

export interface GooglePlace {
  id: string
  displayName: string
  formattedAddress: string
  location: {
    latitude: number
    longitude: number
  }
  photos?: GooglePlacePhoto[]
  rating?: number
  userRatingCount?: number
}

export interface GooglePlacePhoto {
  name: string // e.g., "places/ChIJ.../photos/PHOTO_ID"
  widthPx: number
  heightPx: number
  authorAttributions: Array<{
    displayName: string
    uri?: string
    photoUri?: string
  }>
}

/**
 * Search for a place by text query and location bias
 * Uses Text Search (New) API
 */
export async function searchPlaceByText(
  query: string,
  lat: number,
  lng: number,
  radius: number = 50 // meters
): Promise<GooglePlace | null> {
  const apiKey = getApiKey()

  // Construct request body
  const requestBody = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude: lat,
          longitude: lng
        },
        radius: radius
      }
    },
    // Request specific fields including photos
    languageCode: 'en',
    maxResultCount: 1 // We only want the best match
  }

  try {
    const response = await fetch(`${GOOGLE_PLACES_API_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Request photos field
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.rating,places.userRatingCount'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Google Places API error (${response.status}):`, errorText)
      return null
    }

    const data = await response.json()

    if (!data.places || data.places.length === 0) {
      console.log(`No Google Places found for: ${query}`)
      return null
    }

    // Return the first (best) match
    return data.places[0]
  } catch (error) {
    console.error('Error searching Google Places:', error)
    return null
  }
}

/**
 * Get photo URL from photo resource name
 * @param photoName - Full photo resource name (e.g., "places/ChIJ.../photos/PHOTO_ID")
 * @param maxWidth - Maximum width in pixels (1-4800)
 * @param maxHeight - Maximum height in pixels (1-4800)
 */
export function getPhotoUrl(
  photoName: string,
  maxWidth: number = 800,
  maxHeight: number = 800
): string {
  const apiKey = getApiKey()

  // Construct photo URL
  return `${GOOGLE_PLACES_API_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}&key=${apiKey}`
}

/**
 * Get the best photo URL for a venue
 * Returns the first photo if available, or null
 */
export function getBestPhotoUrl(
  place: GooglePlace | null,
  maxWidth: number = 800,
  maxHeight: number = 800
): string | null {
  if (!place || !place.photos || place.photos.length === 0) {
    return null
  }

  // Return URL for the first (usually best) photo
  const firstPhoto = place.photos[0]
  return getPhotoUrl(firstPhoto.name, maxWidth, maxHeight)
}

/**
 * Match a venue to Google Places and get photo URL
 * @param venueName - Venue name
 * @param lat - Venue latitude
 * @param lng - Venue longitude
 * @returns Photo URL or null
 */
export async function getVenuePhotoUrl(
  venueName: string,
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    // Search for the place
    const place = await searchPlaceByText(venueName, lat, lng, 100) // 100m radius

    if (!place) {
      console.log(`❌ No Google Place match found for: ${venueName}`)
      return null
    }

    // Get the best photo URL
    const photoUrl = getBestPhotoUrl(place, 800, 800)

    if (photoUrl) {
      console.log(`✅ Found photo for: ${venueName}`)
    } else {
      console.log(`⚠️  Place found but no photos: ${venueName}`)
    }

    return photoUrl
  } catch (error) {
    console.error(`Error getting photo for ${venueName}:`, error)
    return null
  }
}

/**
 * Rate limiter for Google Places API requests
 */
export class GooglePlacesRateLimiter {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private requestsPerSecond: number

  constructor(requestsPerSecond: number = 5) {
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

// Global rate limiter instance (5 requests per second to be safe)
export const googlePlacesRateLimiter = new GooglePlacesRateLimiter(5)
