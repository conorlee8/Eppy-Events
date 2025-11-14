'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SearchBar } from '@/components/SearchBar'
import { MobileSearchModal } from '@/components/MobileSearchModal'
import { EventSidebar } from '@/components/EventSidebar'
import { MapControls } from '@/components/MapControls'
import { DevStatsPanel } from '@/components/DevStatsPanel'
import { NeighborhoodInfoPanel } from '@/components/NeighborhoodInfoPanel'
import { MobileBottomSheet } from '@/components/MobileBottomSheet'
import { SwipeableEventCards } from '@/components/SwipeableEventCards'
import MobileVenueList from '@/components/MobileVenueList'
import { FloatingActions } from '@/components/FloatingActions'
import { RadarScanOverlay } from '@/components/RadarScanOverlay'
import { HolographicEventCard } from '@/components/HolographicEventCard'
import EventListSidebar from '@/components/EventListSidebar'
import EventBrowser from '@/components/EventBrowser'
import CitySwitcher from '@/components/CitySwitcher'
import VisualizationModeSwitcher, { type VisualizationMode } from '@/components/VisualizationModeSwitcher'
import { ClusteringSystemV2 } from '@/lib/clusteringV2'
import { generateMockHeatmapData } from '@/lib/mockHeatmapData'
import { loadNeighborhoods, findNeighborhood, getNeighborhoodStats, type NeighborhoodCollection } from '@/lib/neighborhoods'
import { ParticleMorphAnimation, performCameraFlight, getSpritePositionsFromMap, getClusterCenters } from '@/lib/particleMorphAnimation'
import { getOrDetectCity, type City } from '@/lib/cityDetection'
import { getEventImage } from '@/lib/eventImages'
import type { Event, ClusteringMode } from '@/types'

// Generate realistic popularity score based on venue type and time
function getRealisticPopularity(venueType: string): number {
  const hour = new Date().getHours()
  const isEvening = hour >= 18 && hour <= 23
  const isAfternoon = hour >= 12 && hour < 18
  const isMorning = hour >= 6 && hour < 12
  const isLateNight = hour >= 0 && hour < 6

  // Base scores by venue type and time
  let baseScore = 50

  const type = venueType.toLowerCase()

  // Bars, nightclubs, casinos - busiest at night
  if (type.includes('bar') || type.includes('night') || type.includes('casino')) {
    if (isEvening) baseScore = 80
    else if (isLateNight) baseScore = 65
    else if (isAfternoon) baseScore = 45
    else baseScore = 25
  }
  // Restaurants - busiest during meal times
  else if (type.includes('restaurant')) {
    if (isEvening) baseScore = 75
    else if (isAfternoon) baseScore = 60
    else if (isMorning) baseScore = 50
    else baseScore = 30
  }
  // Cafes - busiest in morning/afternoon
  else if (type.includes('cafe') || type.includes('coffee')) {
    if (isMorning) baseScore = 70
    else if (isAfternoon) baseScore = 60
    else if (isEvening) baseScore = 40
    else baseScore = 20
  }
  // Museums, galleries - steady daytime traffic
  else if (type.includes('museum') || type.includes('gallery') || type.includes('theater')) {
    if (isAfternoon) baseScore = 65
    else if (isMorning) baseScore = 55
    else if (isEvening) baseScore = 45
    else baseScore = 15
  }
  // Parks - busiest afternoon/evening
  else if (type.includes('park')) {
    if (isAfternoon) baseScore = 70
    else if (isEvening) baseScore = 60
    else if (isMorning) baseScore = 50
    else baseScore = 20
  }
  // Concert halls, stadiums - variable
  else if (type.includes('concert') || type.includes('stadium')) {
    if (isEvening) baseScore = 70
    else baseScore = 35
  }

  // Add randomization (-15 to +15) for variety
  const randomVariation = Math.floor(Math.random() * 31) - 15
  const finalScore = Math.max(10, Math.min(95, baseScore + randomVariation))

  return finalScore
}

// Convert BestTime venue to Event object
function venueToEvent(venue: any): Event {
  // Map venue type to event category
  const categoryMap: Record<string, string> = {
    'BAR': 'Nightlife',
    'NIGHT_CLUB': 'Nightlife',
    'CASINO': 'Entertainment',
    'THEATER': 'Arts & Culture',
    'CONCERT_HALL': 'Music',
    'MUSEUM': 'Arts & Culture',
    'ART_GALLERY': 'Arts & Culture',
    'PARK': 'Outdoors',
    'STADIUM': 'Sports',
    'LIBRARY': 'Community',
    'CAFE': 'Food & Drink',
    'RESTAURANT': 'Food & Drink',
    'UNKNOWN': 'Entertainment'
  }

  const category = categoryMap[venue.type || venue.venue_type || 'UNKNOWN'] || 'Entertainment'

  const event: Event = {
    id: venue.id || venue.besttime_id,
    title: venue.name,
    description: `Live venue - ${venue.type || venue.venue_type || 'Event Space'}`,
    venue: venue.name,
    address: venue.address || '',
    latitude: parseFloat(venue.lat),
    longitude: parseFloat(venue.lng),
    category: category,
    subcategory: venue.type || venue.venue_type || 'UNKNOWN',
    startTime: new Date().toISOString(), // Current time for venues
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
    price: {
      currency: 'USD',
      isFree: false // Venues typically have cover or minimum
    },
    tags: [venue.type || venue.venue_type || 'venue', 'live'],
    popularity: getRealisticPopularity(venue.type || venue.venue_type || 'UNKNOWN'),
    busyness: venue.busyness // Will be populated from BestTime later
  }

  // Use Google Places photo if available, otherwise fall back to curated images
  event.imageUrl = venue.photo_url || getEventImage(event)

  return event
}

// Fetch venues from Supabase (cached BestTime data)
async function fetchCityVenues(citySlug: string): Promise<Event[]> {
  try {
    console.log(`🔍 Fetching cached venues for ${citySlug}...`)

    const response = await fetch('/api/venues/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citySlug })
    })

    if (!response.ok) {
      console.error('Failed to fetch venues:', response.statusText)
      return []
    }

    const data = await response.json()
    console.log(`✅ Loaded ${data.venues?.length || 0} venues (cached: ${data.cached})`)

    // Debug: Check first venue structure
    if (data.venues && data.venues.length > 0) {
      console.log('🔍 First venue structure:', data.venues[0])
    }

    // Convert venues to Event objects
    const events = (data.venues || []).map(venueToEvent)
    console.log(`✅ Converted ${events.length} venues to events`)

    // Debug: Check first event
    if (events.length > 0) {
      console.log('🔍 First event:', events[0])
    }

    return events
  } catch (error) {
    console.error('Error fetching venues:', error)
    return []
  }
}

// Calculate the center of mass (event hotspot) for a list of events
function getEventHotspot(events: Event[]): { lat: number; lng: number } | null {
  if (events.length === 0) return null

  // Weight by popularity to center on most popular areas
  let totalLat = 0
  let totalLng = 0
  let totalWeight = 0

  events.forEach(event => {
    const weight = event.popularity || 50 // Default weight if no popularity
    totalLat += event.latitude * weight
    totalLng += event.longitude * weight
    totalWeight += weight
  })

  return {
    lat: totalLat / totalWeight,
    lng: totalLng / totalWeight
  }
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const clusteringSystem = useRef<ClusteringSystemV2 | null>(null)

  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<Event[] | null>(null)
  const [clusteringMode, setClusteringMode] = useState<ClusteringMode>('hybrid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [viewportEvents, setViewportEvents] = useState<Event[]>([])
  const [isLocating, setIsLocating] = useState(false)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [heatmapVisible, setHeatmapVisible] = useState(false)
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('markers')
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodCollection | null>(null)
  const [currentNeighborhood, setCurrentNeighborhood] = useState<string | null>(null)
  const [hoveredNeighborhoodEventCount, setHoveredNeighborhoodEventCount] = useState<number>(0)
  const [isPanelHovered, setIsPanelHovered] = useState(false)
  const neighborhoodHideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [preferredZoom, setPreferredZoom] = useState(12)
  const [showNearbyEvents, setShowNearbyEvents] = useState(false)

  // Mobile Bottom Sheet state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true)
  const [savedEvents, setSavedEvents] = useState<Event[]>([])
  const [vibeFilter, setVibeFilter] = useState<string | null>(null)

  // Scan animation state - Only show on first load if not seen before
  const [showScanAnimation, setShowScanAnimation] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)

  // Holographic card state
  const [holographicEvent, setHolographicEvent] = useState<{ event: Event; position: { x: number; y: number } } | null>(null)

  // Event list sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarEvents, setSidebarEvents] = useState<Event[]>([])
  const [sidebarTitle, setSidebarTitle] = useState('Events')

  // City selection state
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [currentCityEvents, setCurrentCityEvents] = useState<Event[]>([])

  // Event card highlight state
  const clearSelectionRef = useRef<(() => void) | null>(null)
  const isUserInitiatedMove = useRef<boolean>(true) // Track if map move is user-initiated

  // Track if we're on mobile
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Mobile search modal state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  // Initialize Mapbox
  useEffect(() => {
    console.log('🗺️ Map initialization useEffect running...')
    console.log('  mapContainer.current:', mapContainer.current ? 'EXISTS' : 'NULL')
    console.log('  map.current:', map.current ? 'ALREADY EXISTS' : 'NULL')

    if (!mapContainer.current) {
      console.error('❌ mapContainer.current is NULL - map div not found!')
      return
    }

    if (map.current) {
      console.warn('⚠️ map.current already exists - skipping initialization')
      return
    }

    // Set Mapbox token
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    console.log('Mapbox token:', token ? `${token.substring(0, 20)}...` : 'MISSING')
    mapboxgl.accessToken = token || ''

    if (!token) {
      console.error('Mapbox token is missing! Check .env.local file')
      return
    }

    console.log('🚀 Starting city detection and map initialization...')

    // Detect city and initialize map IMMEDIATELY
    getOrDetectCity().then(async detectedCity => {
      console.log('🏙️ City detected:', detectedCity.name)
      setCurrentCity(detectedCity)

      // Create map IMMEDIATELY with city center (don't wait for venues)
      console.log('🗺️ Creating Mapbox map instance at city center...')
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [detectedCity.lng, detectedCity.lat],
          zoom: 12,
          pitch: 45,
          bearing: 0,
          attributionControl: false,
          logoPosition: 'bottom-right'
        })

        console.log('✅ Map created! Now loading venues in background...')
        setIsMapLoaded(true)

        // Fetch venues in BACKGROUND after map is created
        const cityEvents = await fetchCityVenues(detectedCity.slug)
        console.log('✅ Venues loaded:', cityEvents.length)
        setCurrentCityEvents(cityEvents)

        // Now initialize handlers with venue data
        initializeMapHandlers(detectedCity, cityEvents)
      } catch (error) {
        console.error('❌ Failed to create map:', error)
      }
    }).catch(error => {
      console.error('❌ Error in city detection:', error)
    })
  }, [])

  const initializeMapHandlers = (detectedCity: City, cityEvents: Event[]) => {
    console.log(`🎬 initializeMapHandlers called with ${cityEvents.length} events`)

    if (!map.current) {
      console.error('❌ map.current is NULL in initializeMapHandlers!')
      return
    }

    console.log(`✅ map.current exists, creating clustering system...`)

    // Initialize clustering system V2 with callbacks
    clusteringSystem.current = new ClusteringSystemV2(
      map.current,
      cityEvents,
      null,
      (events: Event[]) => {
        // Hexagon clicked - show these events in mobile sidebar
        console.log('📋 Showing', events.length, 'events in mobile sidebar')

        // Determine title based on neighborhood
        const firstEvent = events[0]
        let title = 'Events'
        if (firstEvent && neighborhoods) {
          const neighborhood = findNeighborhood(firstEvent.longitude, firstEvent.latitude, neighborhoods)
          if (neighborhood?.properties.name) {
            title = neighborhood.properties.name
          }
        }

        setSidebarEvents(events)
        setSidebarTitle(title)
        setSidebarVisible(true)

        // Also update legacy sidebar if needed
        setFilteredEvents(events)
        setSelectedCluster(events)
      },
      (event: Event, position: { x: number; y: number }) => {
        // Individual sprite clicked - show beautiful holographic card
        console.log('✨ Opening holographic card for:', event.title)
        setHolographicEvent({ event, position })
      }
    )

    console.log(`✅ Clustering system created! Doing initial render with ${cityEvents.length} events...`)
    // DO INITIAL RENDER - THIS IS CRITICAL!
    clusteringSystem.current.update()
    console.log(`✅ Initial clustering render triggered`)

    map.current.on('load', async () => {
      setIsMapLoaded(true)
      console.log(`🗺️ Map 'load' event fired - doing another clustering update...`)

      // Do another update after map is fully loaded
      if (clusteringSystem.current) {
        clusteringSystem.current.update()
      }

      // Load neighborhoods for detected city
      try {
        const cityNeighborhoods = await loadNeighborhoods(detectedCity.slug)
        setNeighborhoods(cityNeighborhoods)
        console.log(`🏘️  Loaded neighborhoods for ${detectedCity.name}`)
      } catch (error) {
        console.error(`Failed to load neighborhoods for ${detectedCity.name}:`, error)
      }

      // Start scan animation only if not seen before
      if (showScanAnimation) {
        setTimeout(() => {
          const duration = 3000 // 3 seconds
          const startTime = performance.now()

          const animateScan = () => {
            const elapsed = performance.now() - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Smooth easing function (ease-in-out)
            const easedProgress = progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2

            setScanProgress(easedProgress)

            if (progress < 1) {
              requestAnimationFrame(animateScan)
            } else {
              setTimeout(() => {
                setShowScanAnimation(false)
                sessionStorage.setItem('hasSeenScan', 'true')
              }, 300)
            }
          }

          requestAnimationFrame(animateScan)
        }, 100)
      }

      // Enable 3D buildings
      map.current?.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, 0,
            15.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      })

      clusteringSystem.current?.update()
      updateViewportEvents()
    })

    // Handle map movement for viewport updates and clustering
    const handleMapUpdate = () => {
      if (clusteringSystem.current) {
        // Use debounced update to prevent duplicate renders
        clusteringSystem.current.updateDebounced()
      }
      updateViewportEvents()
    }

    // Clear event card highlight and marker highlight when map starts moving (only if user-initiated)
    map.current.on('movestart', () => {
      // Only clear if this is a user-initiated move (not programmatic flyTo)
      if (isUserInitiatedMove.current) {
        // Clear sidebar card highlight
        if (clearSelectionRef.current) {
          clearSelectionRef.current()
        }

        // Clear marker highlight
        if (clusteringSystem.current) {
          clusteringSystem.current.setSelectedEvent(null)
        }
      }

      // Reset flag for next move
      isUserInitiatedMove.current = true
    })

    map.current.on('moveend', handleMapUpdate)
    map.current.on('zoomend', handleMapUpdate)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      map.current?.remove()
    }
  }, [])

  // City detection is now done during map initialization (see useEffect above)

  // Handle city change
  const handleCityChange = async (city: City) => {
    setCurrentCity(city)
    console.log(`🌆 Switching to: ${city.name}`)

    // Load city-specific venues from Supabase (BestTime cache)
    const cityEvents = await fetchCityVenues(city.slug)
    setCurrentCityEvents(cityEvents)
    console.log(`📅 Loaded ${cityEvents.length} real venues for ${city.name}`)

    if (cityEvents.length === 0) {
      console.error('⚠️ WARNING: No venues loaded! Check API response.')
    } else {
      console.log(`✅ First venue:`, cityEvents[0])
    }

    // Update clustering system with new events
    if (clusteringSystem.current) {
      console.log(`🔄 Updating clustering system with ${cityEvents.length} events`)
      clusteringSystem.current.setEvents(cityEvents)
      clusteringSystem.current.update()
      console.log(`✅ Clustering system updated`)
    } else {
      console.error('❌ ERROR: clusteringSystem.current is NULL!')
    }

    // Fly to new city
    if (map.current) {
      map.current.flyTo({
        center: [city.lng, city.lat],
        zoom: 12,
        duration: 2000,
        essential: true
      })
    }

    // Load city-specific neighborhoods
    try {
      const cityNeighborhoods = await loadNeighborhoods(city.slug)
      setNeighborhoods(cityNeighborhoods)

      // Re-add neighborhood boundaries to map
      if (isMapLoaded) {
        addNeighborhoodBoundaries()
      }
    } catch (error) {
      console.error(`Failed to load neighborhoods for ${city.name}:`, error)
    }
  }

  // Function to filter events by current viewport
  const updateViewportEvents = () => {
    if (!map.current || !isMapLoaded) return

    const bounds = map.current.getBounds()
    if (!bounds) {
      // If bounds are not available, show all events
      setViewportEvents(filteredEvents)
      return
    }

    const eventsInView = filteredEvents.filter(event =>
      event.latitude >= bounds.getSouth() &&
      event.latitude <= bounds.getNorth() &&
      event.longitude >= bounds.getWest() &&
      event.longitude <= bounds.getEast()
    )

    setViewportEvents(eventsInView)
  }

  // Update clustering system when neighborhoods change
  useEffect(() => {
    if (neighborhoods && clusteringSystem.current) {
      clusteringSystem.current.setNeighborhoods(neighborhoods)
      const stats = getNeighborhoodStats(neighborhoods)
      console.log(`🏘️  Loaded ${stats.total} neighborhoods:`, stats.names.join(', '))
    }
  }, [neighborhoods])

  // Update events when search changes
  useEffect(() => {
    const filtered = currentCityEvents.filter(event =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.category.toLowerCase().includes(searchQuery.toLowerCase())
    )

    setFilteredEvents(filtered)

    // If there's a search query, open the sidebar with results
    if (searchQuery.trim()) {
      setSidebarEvents(filtered)
      setSidebarTitle(`Search: "${searchQuery}"`)
      setSidebarVisible(true)
    } else {
      // Close sidebar when search is cleared
      setSidebarVisible(false)
    }

    if (clusteringSystem.current) {
      clusteringSystem.current.update()
    }

    // Update viewport events after filtering
    setTimeout(updateViewportEvents, 100)
  }, [searchQuery, currentCityEvents])

  // Initialize filtered events when city events change
  useEffect(() => {
    setFilteredEvents(currentCityEvents)
  }, [currentCityEvents])

  // Update viewport events when filteredEvents or map loads
  useEffect(() => {
    if (isMapLoaded && filteredEvents.length > 0) {
      setTimeout(updateViewportEvents, 100)
    }
  }, [filteredEvents, isMapLoaded])

  // V2 handles clustering modes automatically based on zoom level

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event)
    setSelectedCluster(null)

    // Highlight the event marker immediately
    if (clusteringSystem.current) {
      clusteringSystem.current.setSelectedEvent(event.id)
    }

    if (map.current) {
      // Zoom in close to the event (18 is very close street level)
      const targetZoom = 17.5

      map.current.flyTo({
        center: [event.longitude, event.latitude],
        zoom: targetZoom,
        duration: 1200,
        curve: 1.4,
        easing: (t) => t * (2 - t),
        essential: true
      })

      // After zoom completes, ensure marker is highlighted
      map.current.once('moveend', () => {
        if (clusteringSystem.current) {
          clusteringSystem.current.setSelectedEvent(event.id)
        }
      })
    }
  }

  const handleZoomToOverview = () => {
    if (!map.current || !mapContainer.current) return

    console.log('🎆 Starting Particle Morph Recluster...')

    // Step 1: Get sprite positions from current markers
    const spritePositions = getSpritePositionsFromMap(map.current)
    console.log(`✨ Found ${spritePositions.length} event sprites to dissolve`)

    // Step 2: Get cluster centers (neighborhood centroids)
    const clusterCenters = neighborhoods
      ? getClusterCenters(map.current, neighborhoods)
      : []
    console.log(`🎯 Morphing to ${clusterCenters.length} cluster centers`)

    // Step 3: Reset all declustered neighborhoods to prepare for full recluster
    if (clusteringSystem.current) {
      ;(clusteringSystem.current as any).declusteredNeighborhoods?.clear()
      console.log('🔄 Cleared declustered neighborhoods')
    }

    // Step 4: Start particle animation (only if we have sprites)
    if (spritePositions.length > 0) {
      const particleAnim = new ParticleMorphAnimation(mapContainer.current, {
        duration: 2500,
        onComplete: () => {
          console.log('✅ Particle animation complete, triggering recluster')

          // Step 6: Trigger full recluster after particles finish
          if (clusteringSystem.current) {
            clusteringSystem.current.update()
          }

          // Reset filtered events to show all events
          setFilteredEvents(currentCityEvents)
          setSelectedCluster(null)
        }
      })

      particleAnim.start(spritePositions, clusterCenters)
    } else {
      console.log('⚠️ No sprites found, skipping particle animation')

      // Still trigger recluster even without animation
      if (clusteringSystem.current) {
        clusteringSystem.current.update()
      }
      setFilteredEvents(currentCityEvents)
      setSelectedCluster(null)
    }

    // Step 5: Perform cinematic camera flight (runs in parallel with particles)
    performCameraFlight(
      map.current,
      [-122.4194, 37.7749], // SF center
      12, // City overview zoom
      {
        duration: 3000,
        rotation: 360,
        onComplete: () => {
          console.log('🎥 Camera flight complete')
        }
      }
    )
  }

  // Locate Me - Get user's location with MAXIMUM precision
  const handleFindNearbyEvents = async () => {
    if (!map.current) return

    setIsLocating(true)
    console.log('📍 Getting your location with maximum precision...')

    try {
      // Get multiple readings for better accuracy
      const readings: GeolocationPosition[] = []
      const numReadings = 3 // Take 3 readings

      for (let i = 0; i < numReadings; i++) {
        console.log(`📡 Reading ${i + 1}/${numReadings}...`)

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 15000, // Increased timeout for GPS lock
            enableHighAccuracy: true, // Use GPS instead of cell towers/WiFi
            maximumAge: 0 // Don't use cached location
          })
        })

        readings.push(position)
        console.log(`  → Accuracy: ${position.coords.accuracy.toFixed(1)}m`)

        // If we get a very accurate reading (< 10m), use it immediately
        if (position.coords.accuracy < 10) {
          console.log(`✅ High accuracy achieved (${position.coords.accuracy.toFixed(1)}m)`)
          break
        }

        // Small delay between readings
        if (i < numReadings - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // Use the MOST ACCURATE reading (not average)
      const mostAccurate = readings.reduce((best, current) =>
        current.coords.accuracy < best.coords.accuracy ? current : best
      )

      const userLat = mostAccurate.coords.latitude
      const userLng = mostAccurate.coords.longitude
      setUserLocation([userLng, userLat])

      console.log(`✅ Your location: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}`)
      console.log(`   Accuracy: ${mostAccurate.coords.accuracy.toFixed(1)}m (best of ${readings.length} readings)`)
      console.log(`   All readings:`)
      readings.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.coords.latitude.toFixed(6)}, ${r.coords.longitude.toFixed(6)} (${r.coords.accuracy.toFixed(1)}m)`)
      })

      // Fly to USER'S ACTUAL location
      map.current.flyTo({
        center: [userLng, userLat],
        zoom: 17, // Zoom in very close for street-level view
        duration: 2000,
        pitch: 45,
        essential: true
      })

      // Show accuracy indicator
      if (mostAccurate.coords.accuracy > 50) {
        console.warn(`⚠️ Location accuracy is low (${mostAccurate.coords.accuracy.toFixed(1)}m). Consider moving outside for better GPS signal.`)
      }

      setIsLocating(false)
    } catch (error: any) {
      console.error('❌ Location error:', error)

      let errorMessage = 'Could not get your location. '
      if (error.code === 1) {
        errorMessage += 'Please enable location services in your browser.'
      } else if (error.code === 2) {
        errorMessage += 'Location unavailable. Please check your GPS signal.'
      } else if (error.code === 3) {
        errorMessage += 'Location request timed out. Please try again.'
      }

      alert(errorMessage)
      setIsLocating(false)
    }
  }

  const handleShowSavedEvents = () => {
    // For now, just show all events - in real app this would be user's saved events
    console.log('Showing saved events (mock: all events)')

    if (map.current && filteredEvents.length > 0) {
      const lngs = filteredEvents.map(e => e.longitude)
      const lats = filteredEvents.map(e => e.latitude)

      const bounds: [number, number, number, number] = [
        Math.min(...lngs) - 0.01,
        Math.min(...lats) - 0.01,
        Math.max(...lngs) + 0.01,
        Math.max(...lats) + 0.01
      ]

      map.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        duration: 2000,
        essential: true
      })
    }
  }

  const handleResetToSF = () => {
    if (map.current) {
      map.current.flyTo({
        center: [-122.4194, 37.7749],
        zoom: 12,
        duration: 2000,
        curve: 1.5,
        easing: (t) => t * (2 - t),
        essential: true
      })
    }
  }

  // Mobile-specific handlers
  const handleEventSave = (event: Event) => {
    setSavedEvents(prev => [...prev, event])
    console.log('💾 Event saved:', event.title)
  }

  const handleEventSkip = (event: Event) => {
    console.log('⏭️ Event skipped:', event.title)
  }

  const handleEventDetails = (event: Event) => {
    setSelectedEvent(event)
    handleEventSelect(event)
  }

  const handleVibeFilter = (vibe: string) => {
    setVibeFilter(vibe === vibeFilter ? null : vibe)
    console.log('🎭 Vibe filter:', vibe)
    // TODO: Filter events based on vibe/mood
  }

  // Handle visualization mode changes
  const handleVisualizationModeChange = async (mode: VisualizationMode) => {
    if (!map.current || !currentCity) return

    setVisualizationMode(mode)
    console.log(`🎨 Switching to ${mode} mode`)

    if (mode === 'markers') {
      // Hide heatmap layers
      const layersToHide = ['heatmap-layer', 'heatmap-glow']
      layersToHide.forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', 'none')
        }
      })

      // Show clustering markers
      if (clusteringSystem.current) {
        clusteringSystem.current.update()
      }

      console.log('📍 Markers mode activated')
    } else {
      // Fetch heatmap data for density or foottraffic mode
      try {
        console.log(`🔍 Fetching ${mode} heatmap data...`)

        const response = await fetch(`/api/venues/heatmap?citySlug=${currentCity.slug}&mode=${mode}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch heatmap data: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`✅ Loaded ${data.count} heatmap points for ${mode} mode`)

        // Create GeoJSON for heatmap
        const geojson = {
          type: 'FeatureCollection',
          features: data.data.map((point: any) => ({
            type: 'Feature',
            properties: {
              intensity: point.intensity,
              venueName: point.venueName,
              busyness: point.busyness
            },
            geometry: {
              type: 'Point',
              coordinates: [point.lng, point.lat]
            }
          }))
        }

        // Add or update heatmap source
        if (!map.current.getSource('heatmap-data')) {
          map.current.addSource('heatmap-data', {
            type: 'geojson',
            data: geojson as any
          })
        } else {
          (map.current.getSource('heatmap-data') as mapboxgl.GeoJSONSource).setData(geojson as any)
        }

        // Configure heatmap colors based on mode
        const heatmapColors = mode === 'density'
          ? [
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ]
          : [ // foottraffic mode - more vibrant neon colors
              0, 'rgba(0,0,255,0)',
              0.2, 'rgb(0,150,255)',
              0.4, 'rgb(0,255,200)',
              0.6, 'rgb(255,255,0)',
              0.8, 'rgb(255,100,0)',
              1, 'rgb(255,0,0)'
            ]

        // Remove existing heatmap layers completely
        const layersToRemove = ['heatmap-layer', 'heatmap-glow']
        layersToRemove.forEach(layerId => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId)
          }
        })

        // Add new heatmap layer with fresh data
        map.current.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'heatmap-data',
          maxzoom: 15,
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0,
              1, 1
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              15, mode === 'foottraffic' ? 3 : 2
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              ...heatmapColors
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 2,
              15, mode === 'foottraffic' ? 30 : 25
            ],
            'heatmap-opacity': mode === 'foottraffic' ? 0.8 : 0.7
          }
        }, 'waterway-label')

        // Add glow effect for foottraffic mode
        if (mode === 'foottraffic') {
          map.current.addLayer({
            id: 'heatmap-glow',
            type: 'circle',
            source: 'heatmap-data',
            minzoom: 12,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0, 5,
                1, 15
              ],
              'circle-color': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0, 'rgba(0,150,255,0.2)',
                0.5, 'rgba(255,255,0,0.4)',
                1, 'rgba(255,0,0,0.6)'
              ],
              'circle-blur': 1,
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0.6,
                15, 0.3
              ]
            }
          })
        }

        console.log(`🔥 ${mode} heatmap activated with ${data.count} points`)
      } catch (error) {
        console.error(`❌ Failed to load ${mode} heatmap:`, error)
      }
    }
  }

  // Legacy function for backwards compatibility
  const toggleHeatmapVisibility = (visible: boolean, options?: any) => {
    if (visible) {
      handleVisualizationModeChange('density')
    } else {
      handleVisualizationModeChange('markers')
    }
  }

  // Add neighborhood boundaries to the map
  const addNeighborhoodBoundaries = () => {
    if (!map.current || !neighborhoods) return

    // Add or update neighborhood source with promoteId for feature state
    const source = map.current.getSource('neighborhoods')
    if (source && source.type === 'geojson') {
      // Update existing source with new data
      (source as mapboxgl.GeoJSONSource).setData(neighborhoods as any)
    } else if (!source) {
      // Add new source - Austin uses 'objectid', SF uses 'cartodb_id'
      map.current.addSource('neighborhoods', {
        type: 'geojson',
        data: neighborhoods as any,
        promoteId: 'objectid' // Use objectid as feature ID for Austin
      })
    }

    // Fill layer - visible on hover with smooth transition
    if (!map.current.getLayer('neighborhoods-fill')) {
      map.current.addLayer({
        id: 'neighborhoods-fill',
        type: 'fill',
        source: 'neighborhoods',
        paint: {
          'fill-color': '#60A5FA',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.3,  // Clearly visible on hover
            0.0    // Invisible normally
          ]
        },
        minzoom: 11,
        maxzoom: 15  // Hide when zoomed in close
      })
    }

    // Add subtle always-visible boundaries so neighborhoods are distinguishable
    if (!map.current.getLayer('neighborhoods-boundary')) {
      map.current.addLayer({
        id: 'neighborhoods-boundary',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#60A5FA',
          'line-width': 1,
          'line-opacity': 0.15 // Very subtle always-visible lines
        },
        minzoom: 11,
        maxzoom: 15  // Hide when zoomed in close
      })
    }

    // Add glow effect layer for hover (2025 trend)
    if (!map.current.getLayer('neighborhoods-glow')) {
      map.current.addLayer({
        id: 'neighborhoods-glow',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#60A5FA',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            4,
            0
          ],
          'line-blur': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            3,
            0
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.3,
            0
          ]
        },
        minzoom: 11,
        maxzoom: 15  // Hide when zoomed in close
      })
    }

    // Add outline layer
    if (!map.current.getLayer('neighborhoods-outline')) {
      map.current.addLayer({
        id: 'neighborhoods-outline',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#60A5FA', // Bright blue on hover
            '#4A90E2'  // Standard blue normally
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,    // Subtle on hover
            0.8   // Very thin normally
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.6,  // Visible on hover
            0.4   // Subtle normally
          ]
        },
        minzoom: 11,
        maxzoom: 15  // Hide when zoomed in close
      })
    }

    // Add labels (enhanced visibility on hover)
    if (!map.current.getLayer('neighborhoods-labels')) {
      map.current.addLayer({
        id: 'neighborhoods-labels',
        type: 'symbol',
        source: 'neighborhoods',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,  // Static size (feature-state not supported in layout properties)
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.15
        },
        paint: {
          'text-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#60A5FA', // Bright blue on hover
            '#ffffff'  // White normally
          ],
          'text-halo-color': '#000000',
          'text-halo-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,  // Thicker halo on hover
            1.5   // Normal halo
          ],
          'text-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1.0,  // Fully visible on hover
            0.7   // Slightly transparent normally
          ]
        },
        minzoom: 11,
        maxzoom: 15  // Hide when zoomed in close
      })
    }

    // Add hover interactions (with delay to prevent flash on page load)
    let hoveredNeighborhoodId: number | null = null
    let hoverEnabled = false

    // Enable hover after a short delay to prevent blue flash on load
    setTimeout(() => {
      hoverEnabled = true
    }, 500)

    map.current.on('mousemove', 'neighborhoods-fill', (e) => {
      if (!hoverEnabled) return // Don't process hover until after initial load
      // Clear any pending hide timeout when hovering back over neighborhood
      if (neighborhoodHideTimeoutRef.current) {
        clearTimeout(neighborhoodHideTimeoutRef.current)
        neighborhoodHideTimeoutRef.current = null
      }

      if (e.features && e.features.length > 0) {
        const newHoveredId = e.features[0].id as number

        // Only update if it's a different neighborhood
        if (hoveredNeighborhoodId !== newHoveredId) {
          // Clear previous hover state
          if (hoveredNeighborhoodId !== null && hoveredNeighborhoodId !== undefined) {
            map.current?.setFeatureState(
              { source: 'neighborhoods', id: hoveredNeighborhoodId },
              { hover: false }
            )
          }

          hoveredNeighborhoodId = newHoveredId

          // Set new hover state
          if (hoveredNeighborhoodId !== null && hoveredNeighborhoodId !== undefined) {
            map.current?.setFeatureState(
              { source: 'neighborhoods', id: hoveredNeighborhoodId },
              { hover: true }
            )
          }
        }

        // Show neighborhood name and count events
        const name = e.features[0].properties?.name
        if (name && neighborhoods) {
          setCurrentNeighborhood(name)

          // Count events in this neighborhood
          const eventsInNeighborhood = currentCityEvents.filter(event => {
            const neighborhood = findNeighborhood(
              event.longitude,
              event.latitude,
              neighborhoods
            )
            return neighborhood?.properties.name === name
          })

          setHoveredNeighborhoodEventCount(eventsInNeighborhood.length)
        }
      }
    })

    map.current.on('mouseleave', 'neighborhoods-fill', () => {
      // Add delay before hiding to allow hovering over the panel
      neighborhoodHideTimeoutRef.current = setTimeout(() => {
        if (hoveredNeighborhoodId !== null && hoveredNeighborhoodId !== undefined) {
          map.current?.setFeatureState(
            { source: 'neighborhoods', id: hoveredNeighborhoodId },
            { hover: false }
          )
          hoveredNeighborhoodId = null
        }
        setCurrentNeighborhood(null)

        // Recluster all neighborhoods when mouse leaves (zoom out behavior)
        if (clusteringSystem.current) {
          const declusteredSet = (clusteringSystem.current as any).declusteredNeighborhoods
          if (declusteredSet.size > 0) {
            console.log('🔄 Reclustering neighborhoods on mouse leave')
            declusteredSet.clear()
            clusteringSystem.current.update()
          }
        }
      }, 500) // 500ms delay allows user to move mouse to panel
    })

    // Force clear all hover states when map moves (prevents stuck highlights)
    map.current.on('movestart', () => {
      if (hoveredNeighborhoodId !== null && hoveredNeighborhoodId !== undefined) {
        map.current?.setFeatureState(
          { source: 'neighborhoods', id: hoveredNeighborhoodId },
          { hover: false }
        )
        hoveredNeighborhoodId = null
      }

      // NOTE: Reclustering is now handled by viewport checking in clusteringV2.ts update()
      // Don't clear declusteredNeighborhoods here - let the smart reclustering logic handle it
    })

    // Change cursor on hover
    map.current.on('mouseenter', 'neighborhoods-fill', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    })

    map.current.on('mouseleave', 'neighborhoods-fill', () => {
      if (map.current) map.current.getCanvas().style.cursor = ''
    })

    // Polygon click → Zoom to neighborhood + show individual sprites
    map.current.on('click', 'neighborhoods-fill', (e) => {
      if (!e.features || !e.features.length || !neighborhoods || !clusteringSystem.current) return

      const name = e.features[0].properties?.name
      if (!name) return

      const currentZoom = map.current?.getZoom() || 0
      console.log('🔷 POLYGON CLICKED:', name, '| Zoom:', currentZoom.toFixed(1))

      // Find all events in this neighborhood
      const eventsInNeighborhood = currentCityEvents.filter(event => {
        const neighborhood = findNeighborhood(event.longitude, event.latitude, neighborhoods)
        return neighborhood?.properties.name === name
      })

      if (eventsInNeighborhood.length === 0) return

      // At zoom 10-14 (hexagon mode): zoom to fit + decluster
      if (currentZoom >= 10 && currentZoom < 15) {
        console.log('🎯 DECLUSTERING hexagon for:', name)

        // Update sidebar immediately
        setFilteredEvents(eventsInNeighborhood)
        setSelectedCluster(eventsInNeighborhood)
        setSidebarEvents(eventsInNeighborhood)
        setSidebarTitle(name)
        setSidebarVisible(true)

        // Use event bounds to ensure all events fit in viewport
        const lngs = eventsInNeighborhood.map(ev => ev.longitude)
        const lats = eventsInNeighborhood.map(ev => ev.latitude)

        if (lngs.length > 0) {
          // Zoom to fit all events with generous padding, MINIMUM zoom 15 to show individual sprites
          map.current?.fitBounds([
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)]
          ], {
            padding: { top: 100, bottom: 100, left: 450, right: 100 }, // Extra left padding for sidebar
            duration: 1200,
            minZoom: 15, // FORCE minimum zoom 15 to show individual events, not more clusters
            maxZoom: 17  // Cap at 17 for reasonable detail level
          })
        }

        // Wait for zoom to complete, then decluster
        const handleMoveEnd = () => {
          if (clusteringSystem.current && map.current) {
            // Ensure we're at zoom 15+ to show individual sprites
            const finalZoom = map.current.getZoom()
            console.log(`✅ Zoom complete at ${finalZoom.toFixed(1)} - declustering "${name}"`)

            const declusteredSet = (clusteringSystem.current as any).declusteredNeighborhoods
            declusteredSet.add(name)
            clusteringSystem.current.update()
            map.current?.off('moveend', handleMoveEnd)
          }
        }
        map.current?.once('moveend', handleMoveEnd)
        return
      }

      // At other zoom levels: zoom to fit + decluster
      console.log('📋 Showing', eventsInNeighborhood.length, 'events from', name, 'in sidebar')
      setFilteredEvents(eventsInNeighborhood)
      setSelectedCluster(eventsInNeighborhood)

      // Get bounds of all events
      const lngs = eventsInNeighborhood.map(ev => ev.longitude)
      const lats = eventsInNeighborhood.map(ev => ev.latitude)

      // Zoom to fit all events with padding for sidebar, FORCE minimum zoom 15
      map.current?.fitBounds([
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      ], {
        padding: { top: 100, bottom: 100, left: 450, right: 100 },
        duration: 1200,
        minZoom: 15, // FORCE minimum zoom 15 to show individual events
        maxZoom: 17  // Cap at 17 for reasonable detail level
      })

      // Mark as declustered and update after zoom completes
      // Use moveend event to ensure zoom is actually done
      const handleMoveEnd = () => {
        if (clusteringSystem.current && map.current) {
          const currentZoom = map.current.getZoom()
          console.log(`✨ DECLUSTERING: "${name}" (zoom: ${currentZoom.toFixed(1)})`)

          // Access private field through type assertion
          const declusteredSet = (clusteringSystem.current as any).declusteredNeighborhoods
          declusteredSet.add(name)

          console.log(`📋 Declustered set now contains ${declusteredSet.size} neighborhoods:`, Array.from(declusteredSet))

          clusteringSystem.current.update()

          // Remove this one-time listener
          map.current?.off('moveend', handleMoveEnd)
        }
      }

      map.current?.once('moveend', handleMoveEnd)
    })

    console.log('🏘️  Added neighborhood boundaries to map')
  }

  // Add neighborhoods to map when data is loaded
  useEffect(() => {
    if (neighborhoods && isMapLoaded) {
      addNeighborhoodBoundaries()
    }
  }, [neighborhoods, isMapLoaded])

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header - Mobile Optimized */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center px-3 py-1" style={{ height: '44px', background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(100,200,255,0.2)' }}>
        {/* Desktop Header - Single Line Ultra-Minimal */}
        <div className="hidden sm:flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">eppy</h1>
            <CitySwitcher
              onCityChange={handleCityChange}
              currentCity={currentCity || undefined}
            />
            {currentNeighborhood && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded-full backdrop-blur-sm">
                <span className="text-[10px] text-blue-300">📍</span>
                <span className="text-[10px] font-medium text-blue-200">{currentNeighborhood}</span>
              </div>
            )}
            {searchQuery && filteredEvents.length < currentCityEvents.length && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilteredEvents(currentCityEvents)
                  if (clusteringSystem.current) {
                    clusteringSystem.current.update()
                  }
                }}
                className="flex items-center gap-0.5 px-2 py-0.5 bg-red-600/20 border border-red-500/30 rounded-full backdrop-blur-sm hover:bg-red-600/30 transition-colors"
              >
                <span className="text-[10px] text-red-300">✕</span>
                <span className="text-[10px] font-medium text-red-200">Clear</span>
              </button>
            )}
          </div>

          {/* Compact Search Bar - Right Side */}
          <div className="w-72">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search events..."
              events={currentCityEvents}
              onEventSelect={handleEventSelect}
              compact
            />
          </div>
        </div>

        {/* Mobile Header - Minimal with Search Icon */}
        <div className="sm:hidden flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">eppy</h1>
            <CitySwitcher
              onCityChange={handleCityChange}
              currentCity={currentCity || undefined}
            />
          </div>

          {/* Mobile Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Search Icon Button */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="p-2 bg-cyan-500/20 border border-cyan-400/50 rounded-xl hover:bg-cyan-500/30 transition-all backdrop-blur-md"
              aria-label="Search events"
            >
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {searchQuery && filteredEvents.length < currentCityEvents.length && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilteredEvents(currentCityEvents)
                  if (clusteringSystem.current) {
                    clusteringSystem.current.update()
                  }
                }}
                className="px-2.5 py-1.5 bg-red-600/20 border border-red-500/30 rounded-full backdrop-blur-sm text-xs text-red-300 font-medium"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Modal */}
        <MobileSearchModal
          isOpen={mobileSearchOpen}
          onClose={() => setMobileSearchOpen(false)}
          value={searchQuery}
          onChange={setSearchQuery}
          events={currentCityEvents}
          onEventSelect={(event) => {
            handleEventSelect(event)
            setMobileSearchOpen(false)
          }}
        />
      </header>

      {/* Main Content */}
      <div className="h-screen relative overflow-hidden">
        {/* Map Container - FULL SCREEN BASE LAYER (ALWAYS) */}
        <div
          ref={mapContainer}
          className="fixed top-[44px] sm:top-0 bottom-0 left-0 right-0 w-full z-0"
        />

        {/* EventBrowser - Desktop sidebar ONLY (mobile uses MobileBottomSheet instead) */}
        {!isMobile && (
          <EventBrowser
            events={filteredEvents}
            title={searchQuery ? `Search: "${searchQuery}"` : 'Top Events'}
            searchQuery={searchQuery}
            isOpen={sidebarOpen}
            onEventClick={(event) => {
              if (clusteringSystem.current) {
                clusteringSystem.current.setSelectedEvent(event.id)
              }
              isUserInitiatedMove.current = false
              if (map.current) {
                map.current.flyTo({
                  center: [event.longitude, event.latitude],
                  zoom: 16,
                  duration: 1400,
                  essential: true,
                  easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
                  padding: { top: 100, bottom: 100, left: sidebarOpen ? 450 : 100, right: 100 },
                  maxDuration: 2000
                })
              }
            }}
            onClearSelection={(callback) => {
              clearSelectionRef.current = callback
            }}
          />
        )}

        {/* OLD Sidebar - HIDDEN - Using new EventListSidebar instead */}
        {/* <div className="absolute top-0 left-0 h-full z-20">
          <EventSidebar
            events={filteredEvents}
            selectedEvent={selectedEvent}
            selectedCluster={selectedCluster}
            onEventSelect={handleEventSelect}
            onClusterClose={() => setSelectedCluster(null)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div> */}

        {/* Developer Stats Panel - HIDDEN per user request */}
        {/* <DevStatsPanel
          isMapLoaded={isMapLoaded}
          userLocation={DEV_MODE ? DEV_SF_LOCATION : userLocation}
          eventCount={filteredEvents.length}
          viewportEventCount={viewportEvents.length}
          onHeatmapToggle={toggleHeatmapVisibility}
          heatmapVisible={heatmapVisible}
        /> */}

        {/* Visualization Mode Switcher - HIDDEN, modes integrated elsewhere */}

        {/* Map Controls */}
        <MapControls
          clusteringMode={clusteringMode}
          onClusteringModeChange={setClusteringMode}
          isMapLoaded={isMapLoaded}
          onZoomToOverview={handleZoomToOverview}
          isLocating={isLocating}
          onFindNearbyEvents={handleFindNearbyEvents}
          onShowSavedEvents={handleShowSavedEvents}
          onResetToSF={handleResetToSF}
          userLocation={userLocation}
          showNearbyEvents={showNearbyEvents}
        />

        {/* Neighborhood Info Panel - REMOVED per user request */}

        {/* Holographic Event Card */}
        {holographicEvent && (
          <HolographicEventCard
            event={holographicEvent.event}
            spritePosition={holographicEvent.position}
            onClose={() => setHolographicEvent(null)}
          />
        )}

        {/* Loading Overlay */}
          {!isMapLoaded && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div className="text-white">Loading beautiful map...</div>
              </div>
            </div>
          )}

        {/* Mobile Bottom Drawer - Only on Mobile, Collapsible */}
        {isMobile && (
          <MobileBottomSheet
            isOpen={true}
            onOpenChange={() => {}}
            neighborhood={currentNeighborhood}
            eventCount={filteredEvents.length}
          >
            <MobileVenueList
              events={filteredEvents}
              onEventClick={handleEventSelect}
              selectedEventId={selectedEvent?.id}
            />
          </MobileBottomSheet>
        )}

        {/* Floating Action Buttons - REMOVED, moved to header */}

        {/* Radar Scan Animation Overlay */}
        {showScanAnimation && userLocation && (
          <RadarScanOverlay
            progress={scanProgress}
            userLocation={userLocation}
          />
        )}

        {/* OLD Event List Sidebar - REPLACED by EventBrowser */}
        {/* <EventListSidebar
          events={sidebarEvents}
          isVisible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
          title={sidebarTitle}
        /> */}
        </div>
      </div>
  )
}
