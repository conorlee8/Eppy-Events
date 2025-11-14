/**
 * City detection and selection
 */

export interface City {
  id: string
  name: string
  slug: string
  lat: number
  lng: number
  active: boolean
}

export const CITIES: City[] = [
  {
    id: '1',
    name: 'San Francisco',
    slug: 'san-francisco',
    lat: 37.7749,
    lng: -122.4194,
    active: true
  },
  {
    id: '2',
    name: 'Austin',
    slug: 'austin',
    lat: 30.2672,
    lng: -97.7431,
    active: true
  }
]

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Detect nearest city based on user's location
 */
export function detectNearestCity(userLat: number, userLng: number): City {
  let nearest = CITIES[0]
  let minDistance = Infinity

  for (const city of CITIES) {
    if (!city.active) continue
    const distance = getDistance(userLat, userLng, city.lat, city.lng)
    if (distance < minDistance) {
      minDistance = distance
      nearest = city
    }
  }

  return nearest
}

/**
 * Get user's current location (requires permission)
 */
export async function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      () => {
        resolve(null) // Permission denied or error
      },
      {
        timeout: 10000,
        enableHighAccuracy: true, // Use high accuracy GPS
        maximumAge: 0 // Don't use cached position
      }
    )
  })
}

/**
 * Get city from localStorage or detect from location
 */
export async function getOrDetectCity(): Promise<City> {
  // Check localStorage first
  if (typeof window !== 'undefined') {
    const savedSlug = localStorage.getItem('selected-city')
    if (savedSlug) {
      const savedCity = CITIES.find(c => c.slug === savedSlug)
      if (savedCity) return savedCity
    }
  }

  // Try to detect from user location
  const userLocation = await getUserLocation()
  if (userLocation) {
    const nearest = detectNearestCity(userLocation.lat, userLocation.lng)
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected-city', nearest.slug)
    }
    return nearest
  }

  // Default to San Francisco
  return CITIES[0]
}

/**
 * Save selected city to localStorage
 */
export function saveSelectedCity(citySlug: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('selected-city', citySlug)
  }
}

/**
 * Get city by slug
 */
export function getCityBySlug(slug: string): City | undefined {
  return CITIES.find(c => c.slug === slug)
}
