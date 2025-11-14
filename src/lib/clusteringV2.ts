/**
 * CLEAN CLUSTERING SYSTEM V2
 *
 * Zoom < 11: Popularity/heat clusters (busy areas pulse more)
 * Zoom 11-14: ONE hexagon per neighborhood (shows count)
 * Zoom 15+: Individual animated sprites per event
 * Click neighborhood: Zoom in + show individual sprites
 */

import mapboxgl from 'mapbox-gl'
import type { Event, EventCluster } from '@/types'
import type { NeighborhoodCollection } from './neighborhoods'
import { findNeighborhood, getNeighborhoodCentroids } from './neighborhoods'

export class ClusteringSystemV2 {
  private map: mapboxgl.Map
  private events: Event[] = []
  private neighborhoods: NeighborhoodCollection | null = null
  private markers: Map<string, mapboxgl.Marker> = new Map()
  private markerElements: Map<string, HTMLElement> = new Map() // Track marker elements for selection updates
  private declusteredNeighborhoods: Set<string> = new Set()
  private selectedEventId: string | null = null // Track selected event for highlighting
  private onHexagonClick?: (events: Event[]) => void
  private onSpriteClick?: (event: Event, position: { x: number; y: number }) => void
  private isUpdating: boolean = false // Prevent duplicate updates
  private updateTimeout: NodeJS.Timeout | null = null // Debounce timer

  constructor(
    map: mapboxgl.Map,
    events: Event[],
    neighborhoods: NeighborhoodCollection | null = null,
    onHexagonClick?: (events: Event[]) => void,
    onSpriteClick?: (event: Event, position: { x: number; y: number }) => void
  ) {
    this.map = map
    this.events = events
    this.neighborhoods = neighborhoods
    this.onHexagonClick = onHexagonClick
    this.onSpriteClick = onSpriteClick
  }

  setNeighborhoods(neighborhoods: NeighborhoodCollection) {
    this.neighborhoods = neighborhoods
    this.update()
  }

  setEvents(events: Event[]) {
    this.events = events
    // Clear declustered state when switching cities
    this.declusteredNeighborhoods.clear()
    this.update()
  }

  /**
   * Set selected event for highlighting on map
   */
  setSelectedEvent(eventId: string | null) {
    const previouslySelected = this.selectedEventId
    this.selectedEventId = eventId

    // Update marker styling without full re-render
    if (previouslySelected) {
      const prevElement = this.markerElements.get(previouslySelected)
      if (prevElement) {
        this.removeHighlight(prevElement)
      }
    }

    if (eventId) {
      const newElement = this.markerElements.get(eventId)
      if (newElement) {
        this.applyHighlight(newElement)
      }
    }
  }

  /**
   * Apply highlight effect to marker element
   */
  private applyHighlight(element: HTMLElement) {
    const mainSprite = element.querySelector('[data-sprite-main]') as HTMLElement
    if (mainSprite) {
      // Change to bright cyan/gold highlight
      mainSprite.style.background = '#06b6d4' // Cyan
      mainSprite.style.borderColor = '#fbbf24' // Gold border
      mainSprite.style.boxShadow = '0 0 30px #06b6d4, 0 0 15px #fbbf24'
      mainSprite.style.animation = 'bounce-highlight 0.6s ease-out, pulse-dot 2s ease-in-out infinite'
      mainSprite.style.transform = 'translate(-50%, -50%) scale(1.5)'
      mainSprite.style.zIndex = '1000'
    }
  }

  /**
   * Remove highlight effect from marker element
   */
  private removeHighlight(element: HTMLElement) {
    const mainSprite = element.querySelector('[data-sprite-main]') as HTMLElement
    if (mainSprite) {
      // Revert to original purple color
      mainSprite.style.background = '#a855f7'
      mainSprite.style.borderColor = 'rgba(255,255,255,0.8)'
      mainSprite.style.boxShadow = ''
      mainSprite.style.animation = 'pulse-dot 2s ease-in-out infinite'
      mainSprite.style.transform = ''
      mainSprite.style.zIndex = ''
    }
  }

  /**
   * Check if declustered neighborhood events are in viewport
   */
  private areNeighborhoodEventsInViewport(neighborhoodName: string): boolean {
    if (!this.neighborhoods) return false

    const bounds = this.map.getBounds()
    const neighborhoodEvents = this.events.filter(e => {
      // Check if event is in this neighborhood
      const neighborhood = findNeighborhood(e.longitude, e.latitude, this.neighborhoods!)
      return neighborhood?.properties.name === neighborhoodName
    })

    // Check if ANY event from this neighborhood is in viewport
    return neighborhoodEvents.some(e =>
      e.latitude >= bounds.getSouth() &&
      e.latitude <= bounds.getNorth() &&
      e.longitude >= bounds.getWest() &&
      e.longitude <= bounds.getEast()
    )
  }

  /**
   * Debounced update function - prevents duplicate renders
   */
  updateDebounced() {
    // Clear any pending update
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout)
    }

    // Schedule new update after 150ms of inactivity
    this.updateTimeout = setTimeout(() => {
      this.update()
    }, 150)
  }

  /**
   * Main update function - called on zoom/pan
   */
  update() {
    // Prevent duplicate updates
    if (this.isUpdating) {
      console.log('⏸️  Update already in progress, skipping...')
      return
    }

    this.isUpdating = true

    try {
      const zoom = this.map.getZoom()
      const previousZoom = (this as any).previousZoom || zoom
      const isZoomingIn = zoom > previousZoom
      const isZoomingOut = zoom < previousZoom
      ;(this as any).previousZoom = zoom

      // Log current rendering mode for debugging
      let renderMode = ''
      if (zoom >= 15) renderMode = '🔵 Individual Sprites'
      else if (zoom >= 10 && this.neighborhoods) renderMode = '🔷 Neighborhood Hexagons'
      else renderMode = '🔥 Heat Clusters'
      console.log(`🎨 RENDER MODE: ${renderMode} (zoom: ${zoom.toFixed(1)})`)

      // CONSERVATIVE RECLUSTERING LOGIC:
      // Only recluster when ZOOMING OUT significantly below zoom 11
      // Don't recluster on pan, don't recluster when zooming in
      if (isZoomingOut && zoom < 11 && this.declusteredNeighborhoods.size > 0) {
        // Only recluster if ALL events from a neighborhood are out of viewport
        const toRecluster: string[] = []
        this.declusteredNeighborhoods.forEach(name => {
          if (!this.areNeighborhoodEventsInViewport(name)) {
            toRecluster.push(name)
          }
        })

        if (toRecluster.length > 0) {
          console.log(`🔄 RECLUSTERING: ${toRecluster.length} neighborhoods (zoomed out to ${zoom.toFixed(1)})`)
          toRecluster.forEach(name => this.declusteredNeighborhoods.delete(name))
        }
      }

      // Clear existing markers BEFORE creating new ones
      const oldMarkerCount = this.markers.size
      if (oldMarkerCount > 0) {
        console.log(`🗑️  Clearing ${oldMarkerCount} existing markers`)
      }
      this.markers.forEach(marker => marker.remove())
      this.markers.clear()
      this.markerElements.clear()
      console.log(`✨ Markers cleared, ready for new render`)

      // Get events in viewport
      const bounds = this.map.getBounds()
      const eventsInView = this.events.filter(e =>
        e.latitude >= bounds.getSouth() &&
        e.latitude <= bounds.getNorth() &&
        e.longitude >= bounds.getWest() &&
        e.longitude <= bounds.getEast()
      )

      // Check if we have any declustered neighborhoods with events in view
      const hasDeclusteredInView = this.declusteredNeighborhoods.size > 0 &&
        this.neighborhoods &&
        eventsInView.some(e => {
          const neighborhood = findNeighborhood(e.longitude, e.latitude, this.neighborhoods!)
          return neighborhood && this.declusteredNeighborhoods.has(neighborhood.properties.name.trim())
        })

      // Decide which rendering mode to use based on zoom
      if (zoom < 10) {
        // ZOOM < 10: ALWAYS show heat clusters (highest priority)
        console.log(`  → Rendering heat clusters for ${eventsInView.length} events (zoom: ${zoom.toFixed(1)})`)
        this.renderPopularityClusters(eventsInView)
      } else if (zoom >= 15 || hasDeclusteredInView) {
        // ZOOM 15+ OR DECLUSTERED NEIGHBORHOODS: Show individual sprites
        console.log(`  → Rendering ${eventsInView.length} individual sprites${hasDeclusteredInView ? ' (declustered)' : ''}`)
        this.renderIndividualSprites(eventsInView)
      } else if (zoom >= 10 && this.neighborhoods) {
        // ZOOM 10-14: Show neighborhood hexagons
        console.log(`  → Rendering neighborhood hexagons for ${eventsInView.length} events`)
        this.renderNeighborhoodHexagons(eventsInView)
      } else {
        // Fallback: Show heat clusters if no neighborhoods
        console.log(`  → Rendering heat clusters for ${eventsInView.length} events (fallback)`)
        this.renderPopularityClusters(eventsInView)
      }
    } catch (error) {
      console.error('❌ Error during clustering update:', error)
    } finally {
      // ALWAYS reset the update flag, even if error occurs
      this.isUpdating = false
    }
  }

  /**
   * Render neighborhood hexagons (ONE per neighborhood)
   */
  private renderNeighborhoodHexagons(events: Event[]) {
    if (!this.neighborhoods) return

    // Debug: Log declustered neighborhoods
    if (this.declusteredNeighborhoods.size > 0) {
      console.log(`🔍 Declustered neighborhoods (${this.declusteredNeighborhoods.size}):`, Array.from(this.declusteredNeighborhoods))
    }

    // Group events by neighborhood - ENSURE NO DUPLICATES
    const neighborhoodGroups = new Map<string, Event[]>()

    console.log(`📍 Grouping ${events.length} events into neighborhoods...`)

    // Track which neighborhoods we've seen for duplicate detection
    const neighborhoodCounts = new Map<string, number>()

    events.forEach(event => {
      const neighborhood = findNeighborhood(event.longitude, event.latitude, this.neighborhoods!)
      if (!neighborhood?.properties.name) return

      // Normalize neighborhood name (trim whitespace, consistent casing)
      const name = neighborhood.properties.name.trim()

      // Skip declustered neighborhoods - they're handled at a higher level
      if (this.declusteredNeighborhoods.has(name)) {
        return
      }

      // Track occurrences
      neighborhoodCounts.set(name, (neighborhoodCounts.get(name) || 0) + 1)

      if (!neighborhoodGroups.has(name)) {
        neighborhoodGroups.set(name, [])
      }
      neighborhoodGroups.get(name)!.push(event)
    })

    console.log(`🏘️  Found ${neighborhoodGroups.size} unique neighborhoods:`, Array.from(neighborhoodGroups.keys()))

    // Get pre-calculated centroids for ALL neighborhoods (more accurate than bbox center)
    const centroids = getNeighborhoodCentroids(this.neighborhoods)
    const centroidMap = new Map(centroids.map(c => [c.name.trim(), { lat: c.lat, lng: c.lng }]))

    // Create ONE marker per neighborhood (guaranteed unique by Map)
    neighborhoodGroups.forEach((neighborhoodEvents, neighborhoodName) => {
      // Use pre-calculated centroid if available, otherwise fallback to event center
      let centerLat, centerLng
      const centroid = centroidMap.get(neighborhoodName)

      if (centroid) {
        centerLat = centroid.lat
        centerLng = centroid.lng
      } else {
        // Fallback to event center if centroid not found
        console.warn(`⚠️  No centroid found for "${neighborhoodName}", using event center`)
        centerLat = neighborhoodEvents.reduce((sum, e) => sum + e.latitude, 0) / neighborhoodEvents.length
        centerLng = neighborhoodEvents.reduce((sum, e) => sum + e.longitude, 0) / neighborhoodEvents.length
      }

      // Create hexagon marker
      const el = this.createHexagonMarker(neighborhoodEvents.length, neighborhoodName)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([centerLng, centerLat])
        .addTo(this.map)

      // NOTE: Click handling is done via polygon layer in page.tsx
      // Hexagon markers can't reliably receive clicks because Mapbox polygon layer intercepts them

      this.markers.set(`neighborhood-${neighborhoodName}`, marker)
      console.log(`  ✅ Created hexagon for "${neighborhoodName}" at [${centerLng.toFixed(4)}, ${centerLat.toFixed(4)}] with ${neighborhoodEvents.length} events`)
    })

    console.log(`✅ Rendered ${this.markers.size} hexagon markers`)
  }

  /**
   * Render individual animated sprites
   */
  private renderIndividualSprites(events: Event[]) {
    // Detect and separate overlapping events
    const eventPositions = this.separateOverlappingEvents(events)

    eventPositions.forEach(({ event, lng, lat }) => {
      const el = this.createSpriteMarker(event)

      // Add click handler for holographic card
      el.onclick = (e) => {
        e.stopPropagation()

        if (this.onSpriteClick) {
          // Get sprite position on screen
          const rect = el.getBoundingClientRect()
          const position = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }

          console.log('✨ SPRITE CLICKED:', event.title)
          this.onSpriteClick(event, position)
        }
      }

      // Make clickable with pointer cursor (no hover scale to prevent jitter)
      el.style.cursor = 'pointer'
      el.style.pointerEvents = 'auto'

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map)

      this.markers.set(`event-${event.id}`, marker)
      this.markerElements.set(event.id, el)

      // Apply highlight if this event is selected
      if (this.selectedEventId === event.id) {
        this.applyHighlight(el)
      }
    })
  }

  /**
   * Render popularity/heat clusters (zoom < 11)
   */
  private renderPopularityClusters(events: Event[]) {
    console.log(`🔥🔥🔥 HEAT CLUSTER RENDER STARTED - ${events.length} events`)

    if (events.length === 0) {
      console.log(`⚠️ No events to cluster`)
      return
    }

    // Simple grid-based clustering
    const gridSize = 0.05 // degrees (~5km)
    const clusters = new Map<string, Event[]>()

    events.forEach(event => {
      const gridX = Math.floor(event.longitude / gridSize)
      const gridY = Math.floor(event.latitude / gridSize)
      const key = `${gridX},${gridY}`

      if (!clusters.has(key)) {
        clusters.set(key, [])
      }
      clusters.get(key)!.push(event)
    })

    console.log(`🔥 Created ${clusters.size} heat clusters`)

    let markerCount = 0
    clusters.forEach((clusterEvents, key) => {
      const centerLat = clusterEvents.reduce((sum, e) => sum + e.latitude, 0) / clusterEvents.length
      const centerLng = clusterEvents.reduce((sum, e) => sum + e.longitude, 0) / clusterEvents.length

      const el = this.createHeatMarker(clusterEvents.length)
      console.log(`  → Cluster ${markerCount + 1}: ${clusterEvents.length} events at [${centerLng.toFixed(4)}, ${centerLat.toFixed(4)}]`)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([centerLng, centerLat])
        .addTo(this.map)

      // Set z-index on the Mapbox marker wrapper element
      const markerElement = marker.getElement()
      markerElement.style.zIndex = '999'
      markerElement.style.position = 'absolute'

      this.markers.set(`heat-${key}`, marker)
      markerCount++

      // Debug: Check if marker element is in DOM
      console.log(`  → Marker added to DOM: ${document.body.contains(el)}`)
      console.log(`  → Marker wrapper classes: ${markerElement.className}`)
      console.log(`  → Marker wrapper styles: z-index=${markerElement.style.zIndex}, position=${markerElement.style.position}`)
    })

    console.log(`✅ Rendered ${markerCount} heat markers on map`)
    console.log(`📊 Total markers in Map: ${this.markers.size}`)
    console.log(`📊 Map zoom level: ${this.map.getZoom().toFixed(2)}`)
  }

  /**
   * Create hexagon marker for neighborhoods - dynamically sized based on event count
   */
  private createHexagonMarker(count: number, neighborhoodName: string): HTMLElement {
    // Dynamic sizing: 24px base, +2px per event (max 60px)
    const size = Math.min(24 + (count * 2), 60)
    const fontSize = Math.min(10 + Math.floor(count / 3), 18)
    const glowSize = size + 8

    const el = document.createElement('div')
    el.className = 'neighborhood-hexagon-marker'
    el.innerHTML = `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        cursor: pointer;
      ">
        <!-- Glow ring -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${glowSize}px;
          height: ${glowSize}px;
          clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
          background: #00d4ff44;
          box-shadow: 0 0 ${size}px #00d4ff;
          animation: hexGlow 2.5s ease-in-out infinite;
        "></div>

        <!-- Hexagon shape -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
          background: linear-gradient(135deg, #00d4ff 0%, #0088ff 100%);
          border: 2px solid #00ffff;
          animation: hexPulse 2s ease-in-out infinite;
        "></div>

        <!-- Count label -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: 900;
          font-size: ${fontSize}px;
          text-shadow: 0 0 8px #000;
          z-index: 10;
          pointer-events: none;
        ">${count}</div>
      </div>

      <style>
        @keyframes hexPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
          50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
        }
        @keyframes hexGlow {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.15); }
        }
      </style>
    `

    return el
  }

  /**
   * Create pulsing dot marker for individual events
   */
  private createSpriteMarker(event: Event): HTMLElement {
    const el = document.createElement('div')

    // Calculate size based on busyness/foot traffic
    const busyness = event.busyness || 50 // Default to 50 if not available
    const baseSize = 8 // Minimum dot size
    const maxSize = 18 // Maximum dot size
    const size = baseSize + ((busyness / 100) * (maxSize - baseSize))

    // Calculate opacity/intensity based on busyness
    const intensity = 0.6 + ((busyness / 100) * 0.4) // 0.6 to 1.0

    // Use purple/cyan gradient for all dots (matches brand)
    const color = '#a855f7' // Purple-500
    const glowColor = '#06b6d4' // Cyan-500

    el.innerHTML = `
      <div style="
        width: ${size + 8}px;
        height: ${size + 8}px;
        position: relative;
      ">
        <!-- Outer glow -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size + 8}px;
          height: ${size + 8}px;
          background: radial-gradient(circle, ${glowColor}40 0%, transparent 70%);
          border-radius: 50%;
          animation: pulse-glow 2s ease-in-out infinite;
        "></div>

        <!-- Main dot -->
        <div data-sprite-main style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,${intensity});
          box-shadow: 0 0 ${size}px ${color}${Math.round(intensity * 255).toString(16)};
          animation: pulse-dot 2s ease-in-out infinite;
          opacity: ${intensity};
        "></div>
      </div>
      <style>
        @keyframes pulse-dot {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes bounce-highlight {
          0% { transform: translate(-50%, -50%) scale(1); }
          25% { transform: translate(-50%, -80%) scale(1.5); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
          75% { transform: translate(-50%, -65%) scale(1.4); }
          100% { transform: translate(-50%, -50%) scale(1.3); }
        }
      </style>
    `
    return el
  }

  /**
   * Create cluster dot marker with count
   */
  private createHeatMarker(count: number): HTMLElement {
    const el = document.createElement('div')

    // Size based on count (20px to 50px)
    const baseSize = 20
    const maxSize = 50
    const size = Math.min(baseSize + (count * 2), maxSize)

    // Font size scales with dot size
    const fontSize = Math.min(10 + Math.floor(size / 5), 16)

    const color = '#a855f7' // Purple-500
    const glowColor = '#06b6d4' // Cyan-500

    el.innerHTML = `
      <div style="
        width: ${size + 10}px;
        height: ${size + 10}px;
        position: relative;
        cursor: pointer;
        z-index: 999;
        pointer-events: auto;
      ">
        <!-- Outer glow -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size + 10}px;
          height: ${size + 10}px;
          background: radial-gradient(circle, ${glowColor}50 0%, transparent 70%);
          border-radius: 50%;
          animation: cluster-glow 2s ease-in-out infinite;
        "></div>

        <!-- Main cluster dot -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 0 ${size * 0.8}px ${color};
          animation: cluster-pulse 2s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Count number -->
          <span style="
            color: white;
            font-weight: 900;
            font-size: ${fontSize}px;
            text-shadow: 0 0 4px rgba(0,0,0,0.8);
            pointer-events: none;
          ">${count}</span>
        </div>
      </div>
      <style>
        @keyframes cluster-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes cluster-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      </style>
    `
    return el
  }

  private getCategoryStyle(category: string) {
    switch(category.toLowerCase()) {
      case 'music':
        return { color: '#ff0066', icon: '♫', shape: 'diamond', animation: 'music-pulse' }
      case 'food':
        return { color: '#ff9900', icon: '🍴', shape: 'circle', animation: 'food-breathe' }
      case 'sports':
        return { color: '#00ff99', icon: '⚡', shape: 'hexagon', animation: 'sports-bounce' }
      case 'arts':
        return { color: '#cc00ff', icon: '✦', shape: 'star', animation: 'arts-shimmer' }
      case 'technology':
        return { color: '#00ccff', icon: '◆', shape: 'square', animation: 'tech-pulse' }
      default:
        return { color: '#ffff00', icon: '★', shape: 'circle', animation: 'default-pulse' }
    }
  }

  private getShapeClip(shape: string): string {
    switch(shape) {
      case 'diamond': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
      case 'hexagon': return 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)'
      case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
      case 'square': return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
      default: return 'none'
    }
  }

  /**
   * Separate overlapping events in a spiral pattern
   */
  private separateOverlappingEvents(events: Event[]): Array<{ event: Event; lng: number; lat: number }> {
    const threshold = 0.0003 // ~33 meters - if events are closer than this, separate them (increased from 0.0001)
    const result: Array<{ event: Event; lng: number; lat: number }> = []
    const occupied: Map<string, number> = new Map() // Track how many events at each position

    events.forEach(event => {
      const key = `${Math.round(event.longitude / threshold)},${Math.round(event.latitude / threshold)}`
      const count = occupied.get(key) || 0
      occupied.set(key, count + 1)

      if (count === 0) {
        // First event at this location - use original position
        result.push({ event, lng: event.longitude, lat: event.latitude })
      } else {
        // Overlapping event - offset in spiral pattern
        const angle = (count * 137.5) * (Math.PI / 180) // Golden angle spiral
        const distance = 0.0005 * count // Increase distance for each additional event (increased from 0.0002)
        const offsetLng = event.longitude + Math.cos(angle) * distance
        const offsetLat = event.latitude + Math.sin(angle) * distance
        result.push({ event, lng: offsetLng, lat: offsetLat })
      }
    })

    return result
  }
}
