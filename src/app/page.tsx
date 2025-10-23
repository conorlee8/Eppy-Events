'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SearchBar } from '@/components/SearchBar'
import { EventSidebar } from '@/components/EventSidebar'
import { MapControls } from '@/components/MapControls'
import { DevStatsPanel } from '@/components/DevStatsPanel'
import { NeighborhoodInfoPanel } from '@/components/NeighborhoodInfoPanel'
import { MobileBottomSheet } from '@/components/MobileBottomSheet'
import { SwipeableEventCards } from '@/components/SwipeableEventCards'
import { FloatingActions } from '@/components/FloatingActions'
import { RadarScanOverlay } from '@/components/RadarScanOverlay'
import { HolographicEventCard } from '@/components/HolographicEventCard'
import EventListSidebar from '@/components/EventListSidebar'
import EventBrowser from '@/components/EventBrowser'
import { ClusteringSystemV2 } from '@/lib/clusteringV2'
import { mockEvents } from '@/lib/mockData'
import { generateMockHeatmapData } from '@/lib/mockHeatmapData'
import { loadNeighborhoods, findNeighborhood, getNeighborhoodStats, type NeighborhoodCollection } from '@/lib/neighborhoods'
import { ParticleMorphAnimation, performCameraFlight, getSpritePositionsFromMap, getClusterCenters } from '@/lib/particleMorphAnimation'
import type { Event, ClusteringMode } from '@/types'

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
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodCollection | null>(null)
  const [currentNeighborhood, setCurrentNeighborhood] = useState<string | null>(null)
  const [hoveredNeighborhoodEventCount, setHoveredNeighborhoodEventCount] = useState<number>(0)
  const [isPanelHovered, setIsPanelHovered] = useState(false)
  const neighborhoodHideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Development mode - force SF location for testing
  const DEV_MODE = process.env.NODE_ENV === 'development'
  const DEV_SF_LOCATION: [number, number] = [-122.4194, 37.7749] // SF coordinates
  const [preferredZoom, setPreferredZoom] = useState(12)
  const [showNearbyEvents, setShowNearbyEvents] = useState(false)

  // Mobile Bottom Sheet state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true)
  const [savedEvents, setSavedEvents] = useState<Event[]>([])
  const [vibeFilter, setVibeFilter] = useState<string | null>(null)

  // Scan animation state - ALWAYS SHOW (for testing)
  const [showScanAnimation, setShowScanAnimation] = useState(true)
  const [scanProgress, setScanProgress] = useState(0)

  // Holographic card state
  const [holographicEvent, setHolographicEvent] = useState<{ event: Event; position: { x: number; y: number } } | null>(null)

  // Event list sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarEvents, setSidebarEvents] = useState<Event[]>([])
  const [sidebarTitle, setSidebarTitle] = useState('Events')

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Set Mapbox token
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    console.log('Mapbox token:', token ? `${token.substring(0, 20)}...` : 'MISSING')
    mapboxgl.accessToken = token || ''

    if (!token) {
      console.error('Mapbox token is missing! Check .env.local file')
      return
    }

    // Initialize map with beautiful dark theme
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 12,
      pitch: 45,
      bearing: 0,
      attributionControl: false,
      logoPosition: 'bottom-right'
    })

    // Initialize clustering system V2 with callbacks
    clusteringSystem.current = new ClusteringSystemV2(
      map.current,
      mockEvents,
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

    map.current.on('load', () => {
      setIsMapLoaded(true)

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
    let updateTimeout: NodeJS.Timeout
    const handleMapUpdate = () => {
      // Throttle updates to reduce performance impact
      clearTimeout(updateTimeout)
      updateTimeout = setTimeout(() => {
        if (clusteringSystem.current) {
          // Don't forcibly exit hierarchical mode - let it manage itself with timeouts
          clusteringSystem.current.update()
        }
        updateViewportEvents()
      }, 150) // Wait 150ms after movement stops
    }

    map.current.on('moveend', handleMapUpdate)
    map.current.on('zoomend', handleMapUpdate)

    return () => {
      map.current?.remove()
    }
  }, [])

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

  // Load neighborhood boundaries
  useEffect(() => {
    if (!isMapLoaded) return

    async function loadNeighborhoodData() {
      try {
        const data = await loadNeighborhoods('san-francisco')
        setNeighborhoods(data)

        // Pass neighborhoods to clustering system
        if (clusteringSystem.current) {
          clusteringSystem.current.setNeighborhoods(data)
        }

        const stats = getNeighborhoodStats(data)
        console.log(`🏘️  Loaded ${stats.total} neighborhoods:`, stats.names.join(', '))
        console.log(`🗺️  Neighborhood clustering enabled`)
      } catch (error) {
        console.error('Failed to load neighborhoods:', error)
      }
    }

    loadNeighborhoodData()
  }, [isMapLoaded])

  // Update events when search changes
  useEffect(() => {
    const filtered = mockEvents.filter(event =>
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
  }, [searchQuery])

  // Initialize filtered events
  useEffect(() => {
    setFilteredEvents(mockEvents)
  }, [])

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

    if (map.current) {
      const currentZoom = map.current.getZoom()

      // Sidebar clicks should zoom in to show the event properly
      let targetZoom: number
      if (currentZoom <= 10) {
        targetZoom = 15 // City to neighborhood
      } else if (currentZoom <= 13) {
        targetZoom = 16 // District to street
      } else if (currentZoom <= 15) {
        targetZoom = 17 // Neighborhood to detailed
      } else {
        targetZoom = currentZoom // Already zoomed in, just recenter
      }

      map.current.flyTo({
        center: [event.longitude, event.latitude],
        zoom: targetZoom,
        duration: 1500,
        curve: 1.2,
        easing: (t) => t * (2 - t),
        essential: true
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
          setFilteredEvents(mockEvents)
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
      setFilteredEvents(mockEvents)
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

  // Advanced interaction handlers
  const handleFindNearbyEvents = () => {
    // Use simulated SF location in dev mode, or real user location
    const effectiveLocation = DEV_MODE ? DEV_SF_LOCATION : userLocation

    if (!effectiveLocation || !map.current) {
      // No location available - trigger location request first
      handleZoomToOverview()
      return
    }

    console.log(`Finding events near ${DEV_MODE ? 'simulated SF' : 'user'} location`)
    setShowNearbyEvents(true)

    // Calculate events within 1 mile (roughly 0.015 degrees)
    const walkingDistance = 0.015
    const [userLng, userLat] = effectiveLocation

    const nearbyEvents = filteredEvents.filter(event => {
      const distance = Math.sqrt(
        Math.pow(event.longitude - userLng, 2) +
        Math.pow(event.latitude - userLat, 2)
      )
      return distance <= walkingDistance
    })

    console.log(`Found ${nearbyEvents.length} events within walking distance`)

    if (nearbyEvents.length > 0) {
      // Fit bounds to show nearby events
      const lngs = nearbyEvents.map(e => e.longitude)
      const lats = nearbyEvents.map(e => e.latitude)

      const bounds: [number, number, number, number] = [
        Math.min(...lngs, userLng) - 0.005,
        Math.min(...lats, userLat) - 0.005,
        Math.max(...lngs, userLng) + 0.005,
        Math.max(...lats, userLat) + 0.005
      ]

      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1500,
        essential: true
      })
    } else {
      // No nearby events - just center on user
      map.current.flyTo({
        center: userLocation,
        zoom: 16, // Closer zoom for walking area
        duration: 1500,
        essential: true
      })
    }

    // Auto-hide after 5 seconds
    setTimeout(() => setShowNearbyEvents(false), 5000)
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

  // Modern heatmap visualization with 2025 styling effects
  const toggleHeatmapVisibility = (visible: boolean, options?: any) => {
    if (!map.current) return

    setHeatmapVisible(visible)

    if (visible && options) {
      // Generate heatmap data and add layer
      const heatmapData = generateMockHeatmapData()

      // Create GeoJSON for heatmap
      const geojson = {
        type: 'FeatureCollection',
        features: heatmapData.map(point => ({
          type: 'Feature',
          properties: {
            intensity: point.intensity,
            area: point.area
          },
          geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude]
          }
        }))
      }

      // Add heatmap source
      if (!map.current.getSource('heatmap-data')) {
        map.current.addSource('heatmap-data', {
          type: 'geojson',
          data: geojson as any
        })
      } else {
        (map.current.getSource('heatmap-data') as mapboxgl.GeoJSONSource).setData(geojson as any)
      }

      // Build modern color stops based on style
      const colorStops: [number, string][] = options.colors.map((color: string, index: number) => [
        index / (options.colors.length - 1), color
      ])

      // Create advanced heatmap paint properties
      const heatmapPaint: any = {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'intensity'],
          0, 0,
          100, 1
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1,
          15, options.glassmorphic ? 4 : 3 // Higher intensity for glassmorphic effect
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          ...colorStops.flat()
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, Math.max(2, options.radius / 15),
          15, options.radius
        ],
        'heatmap-opacity': options.opacity
      }

      // Add glassmorphic blur effect for modern 2025 aesthetics
      if (options.glassmorphic) {
        heatmapPaint['heatmap-radius'] = [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, Math.max(3, options.radius / 12),
          15, options.radius * 1.2 // Larger radius for glass effect
        ]
      }

      // Add/update heatmap layer with modern styling
      if (map.current.getLayer('heatmap-layer')) {
        map.current.removeLayer('heatmap-layer')
      }

      map.current.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'heatmap-data',
        maxzoom: 16, // Higher maxzoom for better detail
        paint: heatmapPaint
      }, 'waterway-label')

      // Add neon glow effect layer for neon style
      if (options.glowEffect) {
        if (map.current.getLayer('heatmap-glow')) {
          map.current.removeLayer('heatmap-glow')
        }

        map.current.addLayer({
          id: 'heatmap-glow',
          type: 'circle',
          source: 'heatmap-data',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 5,
              100, options.radius / 2
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 'rgba(0,255,255,0.1)',
              50, 'rgba(255,0,255,0.3)',
              100, 'rgba(255,255,0,0.6)'
            ],
            'circle-blur': 1,
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0.8,
              16, 0.4
            ]
          }
        })
      }

      // Add neumorphic shadow points for neumorphic style
      if (options.softShadows) {
        if (map.current.getLayer('heatmap-shadows')) {
          map.current.removeLayer('heatmap-shadows')
        }

        map.current.addLayer({
          id: 'heatmap-shadows',
          type: 'circle',
          source: 'heatmap-data',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 3,
              100, options.radius / 3
            ],
            'circle-color': 'rgba(0,0,0,0.2)',
            'circle-blur': 0.8,
            'circle-translate': [2, 2], // Subtle shadow offset
            'circle-opacity': 0.3
          }
        })
      }

      console.log(`🔥 Modern heatmap layer added with ${heatmapData.length} points (${options.glassmorphic ? 'glassmorphic' : options.glowEffect ? 'neon' : options.softShadows ? 'neumorphic' : 'classic'} style)`)
    } else if (visible) {
      // Fallback to basic heatmap if no options provided
      const heatmapData = generateMockHeatmapData()
      // ... basic implementation (keep existing code for backwards compatibility)
    } else {
      // Remove all heatmap layers and effects
      const layersToRemove = ['heatmap-layer', 'heatmap-glow', 'heatmap-shadows']
      layersToRemove.forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId)
        }
      })

      if (map.current.getSource('heatmap-data')) {
        map.current.removeSource('heatmap-data')
      }
      console.log('🔥 Modern heatmap layers removed')
    }
  }

  // Add neighborhood boundaries to the map
  const addNeighborhoodBoundaries = () => {
    if (!map.current || !neighborhoods) return

    // Add neighborhood source with promoteId for feature state
    if (!map.current.getSource('neighborhoods')) {
      map.current.addSource('neighborhoods', {
        type: 'geojson',
        data: neighborhoods as any,
        promoteId: 'cartodb_id' // Use cartodb_id as feature ID
      })
    }

    // Fill layer - very subtle to prevent blue flash but allow clicking
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
            0.08,  // Very subtle on hover
            0.0    // Invisible normally
          ]
        }
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
        }
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
        }
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
        minzoom: 11 // Show labels slightly earlier
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
          const eventsInNeighborhood = mockEvents.filter(event => {
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
      }, 300) // 300ms delay allows user to move mouse to panel
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
      const eventsInNeighborhood = mockEvents.filter(event => {
        const neighborhood = findNeighborhood(event.longitude, event.latitude, neighborhoods)
        return neighborhood?.properties.name === name
      })

      if (eventsInNeighborhood.length === 0) return

      // At zoom 11-14 (hexagon mode): zoom to fit + decluster
      if (currentZoom >= 11 && currentZoom < 15) {
        console.log('🎯 DECLUSTERING hexagon for:', name)

        // Update sidebar immediately
        setFilteredEvents(eventsInNeighborhood)
        setSelectedCluster(eventsInNeighborhood)
        setSidebarEvents(eventsInNeighborhood)
        setSidebarTitle(name)
        setSidebarVisible(true)

        // Get bounds of all events
        const lngs = eventsInNeighborhood.map(ev => ev.longitude)
        const lats = eventsInNeighborhood.map(ev => ev.latitude)

        // Zoom to fit all events nicely
        map.current?.fitBounds([
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ], {
          padding: 100,
          duration: 1000,
          maxZoom: 16
        })

        // Wait for zoom to complete, then decluster
        const handleMoveEnd = () => {
          if (clusteringSystem.current) {
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

      // Zoom to fit neighborhood (maxZoom 14 to stay in declustering range)
      map.current?.fitBounds([
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      ], {
        padding: 100,
        duration: 1500,
        maxZoom: 14
      })

      // Mark as declustered and update after zoom completes
      // Use moveend event to ensure zoom is actually done
      const handleMoveEnd = () => {
        if (clusteringSystem.current) {
          const currentZoom = map.current?.getZoom() || 0
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
      <header className="bg-gray-900/95 backdrop-blur-sm border-b border-cyan-500/20 p-3 sm:p-4 z-10">
        {/* Desktop Header */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">eppy</h1>
            <div className="text-xs text-gray-400 font-medium">Event Discovery Platform</div>
            {currentNeighborhood && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full backdrop-blur-sm">
                <span className="text-xs text-blue-300">📍</span>
                <span className="text-xs font-medium text-blue-200">{currentNeighborhood}</span>
              </div>
            )}
            {searchQuery && filteredEvents.length < mockEvents.length && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilteredEvents(mockEvents)
                  if (clusteringSystem.current) {
                    clusteringSystem.current.update()
                  }
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-600/20 border border-red-500/30 rounded-full backdrop-blur-sm hover:bg-red-600/30 transition-colors"
              >
                <span className="text-xs text-red-300">✕</span>
                <span className="text-xs font-medium text-red-200">Clear</span>
              </button>
            )}
          </div>

          {/* Search Bar - Right Side */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search events..."
          />
        </div>

        {/* Mobile Header - With Search */}
        <div className="sm:hidden flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">eppy</h1>
            {searchQuery && filteredEvents.length < mockEvents.length && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilteredEvents(mockEvents)
                  if (clusteringSystem.current) {
                    clusteringSystem.current.updateEvents(mockEvents)
                    clusteringSystem.current.update()
                  }
                }}
                className="px-2.5 py-1 bg-red-600/20 border border-red-500/30 rounded-full backdrop-blur-sm text-xs text-red-300 font-medium"
              >
                ✕ Clear
              </button>
            )}
          </div>
          {/* Prominent Search Bar */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="🔍 Search events..."
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* EventBrowser - Desktop Sidebar + Mobile Drawer/Orb */}
        <EventBrowser
          events={filteredEvents}
          title={searchQuery ? `Search: "${searchQuery}"` : 'Top Events'}
          searchQuery={searchQuery}
        />

        {/* Map Container - Full width on mobile, offset on desktop */}
        <div ref={mapContainer} className="w-full lg:w-[calc(100%-280px)] lg:ml-[280px] h-full" />

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

        {/* Developer Stats Panel */}
        <DevStatsPanel
          isMapLoaded={isMapLoaded}
          userLocation={DEV_MODE ? DEV_SF_LOCATION : userLocation}
          eventCount={filteredEvents.length}
          viewportEventCount={viewportEvents.length}
          onHeatmapToggle={toggleHeatmapVisibility}
          heatmapVisible={heatmapVisible}
        />

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
          userLocation={DEV_MODE ? DEV_SF_LOCATION : userLocation}
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

        {/* Mobile Bottom Sheet - Only on Mobile */}
        <div className="lg:hidden">
          <MobileBottomSheet
            isOpen={mobileSheetOpen}
            onOpenChange={setMobileSheetOpen}
            neighborhood={currentNeighborhood}
            eventCount={filteredEvents.length}
          >
            <SwipeableEventCards
              events={filteredEvents}
              onEventSave={handleEventSave}
              onEventSkip={handleEventSkip}
              onEventDetails={handleEventDetails}
            />
          </MobileBottomSheet>
        </div>

        {/* Floating Action Buttons - Only on Mobile */}
        <div className="lg:hidden">
          <FloatingActions
            onFindNearby={handleFindNearbyEvents}
            onVibeFilter={handleVibeFilter}
            userLocation={DEV_MODE ? DEV_SF_LOCATION : userLocation}
            showCompass={true}
          />
        </div>

        {/* Radar Scan Animation Overlay */}
        {showScanAnimation && (
          <RadarScanOverlay
            progress={scanProgress}
            userLocation={DEV_MODE ? DEV_SF_LOCATION : userLocation || DEV_SF_LOCATION}
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
