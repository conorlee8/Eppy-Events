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
import { findNeighborhood } from './neighborhoods'

export class ClusteringSystemV2 {
  private map: mapboxgl.Map
  private events: Event[] = []
  private neighborhoods: NeighborhoodCollection | null = null
  private markers: Map<string, mapboxgl.Marker> = new Map()
  private declusteredNeighborhoods: Set<string> = new Set()
  private onHexagonClick?: (events: Event[]) => void
  private onSpriteClick?: (event: Event, position: { x: number; y: number }) => void

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

  /**
   * Main update function - called on zoom/pan
   */
  update() {
    const zoom = this.map.getZoom()

    // RECLUSTERING LOGIC: Reset declustered neighborhoods when zooming out
    if (zoom < 14 && this.declusteredNeighborhoods.size > 0) {
      // Zoomed out below neighborhood detail level - recluster all
      console.log(`🔄 RECLUSTERING: Zoom ${zoom.toFixed(1)} < 14 - resetting ${this.declusteredNeighborhoods.size} declustered neighborhoods`)
      this.declusteredNeighborhoods.clear()
    }

    // Clear existing markers
    this.markers.forEach(marker => marker.remove())
    this.markers.clear()

    // Get events in viewport
    const bounds = this.map.getBounds()
    const eventsInView = this.events.filter(e =>
      e.latitude >= bounds.getSouth() &&
      e.latitude <= bounds.getNorth() &&
      e.longitude >= bounds.getWest() &&
      e.longitude <= bounds.getEast()
    )

    if (zoom >= 15) {
      // ZOOM 15+: Show individual sprites for ALL events
      this.renderIndividualSprites(eventsInView)
    } else if (zoom >= 11 && this.neighborhoods) {
      // ZOOM 11-14: Show neighborhood hexagons (unless individually declustered)
      this.renderNeighborhoodHexagons(eventsInView)
    } else {
      // ZOOM < 11: Show popularity heat clusters
      this.renderPopularityClusters(eventsInView)
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

    // Group events by neighborhood
    const neighborhoodGroups = new Map<string, Event[]>()

    console.log(`📍 Grouping ${events.length} events into neighborhoods...`)

    events.forEach(event => {
      const neighborhood = findNeighborhood(event.longitude, event.latitude, this.neighborhoods!)
      if (!neighborhood?.properties.name) return

      const name = neighborhood.properties.name
      if (!neighborhoodGroups.has(name)) {
        neighborhoodGroups.set(name, [])
      }
      neighborhoodGroups.get(name)!.push(event)
    })

    console.log(`🏘️  Found neighborhoods:`, Array.from(neighborhoodGroups.keys()))

    // Create ONE marker per neighborhood
    neighborhoodGroups.forEach((neighborhoodEvents, neighborhoodName) => {
      // Check if this neighborhood is declustered - show sprites instead
      if (this.declusteredNeighborhoods.has(neighborhoodName)) {
        console.log(`🎯 DECLUSTERED: "${neighborhoodName}" - rendering ${neighborhoodEvents.length} individual sprites`)
        this.renderIndividualSprites(neighborhoodEvents)
        return
      }

      // Calculate center point (average of event locations)
      const centerLat = neighborhoodEvents.reduce((sum, e) => sum + e.latitude, 0) / neighborhoodEvents.length
      const centerLng = neighborhoodEvents.reduce((sum, e) => sum + e.longitude, 0) / neighborhoodEvents.length

      // Create hexagon marker
      const el = this.createHexagonMarker(neighborhoodEvents.length, neighborhoodName)

      console.log(`🎯 Setting up click handler for: ${neighborhoodName}`)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([centerLng, centerLat])
        .addTo(this.map)

      // Add click handler AFTER marker is added to map
      // Hexagon click → Show events in sidebar
      el.onclick = (e) => {
        console.log('🎯 HEXAGON CLICKED!', neighborhoodName, 'Events:', neighborhoodEvents.length)
        e.stopPropagation()

        // Call callback to update sidebar with these events
        if (this.onHexagonClick) {
          this.onHexagonClick(neighborhoodEvents)
        }
      }

      this.markers.set(`neighborhood-${neighborhoodName}`, marker)
    })
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
    })
  }

  /**
   * Render popularity/heat clusters (zoom < 11)
   */
  private renderPopularityClusters(events: Event[]) {
    // Simple grid-based clustering for now
    const gridSize = 0.05 // degrees
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

    clusters.forEach((clusterEvents, key) => {
      const centerLat = clusterEvents.reduce((sum, e) => sum + e.latitude, 0) / clusterEvents.length
      const centerLng = clusterEvents.reduce((sum, e) => sum + e.longitude, 0) / clusterEvents.length

      const el = this.createHeatMarker(clusterEvents.length)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([centerLng, centerLat])
        .addTo(this.map)

      this.markers.set(`heat-${key}`, marker)
    })
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
   * Create animated sprite for individual events
   */
  private createSpriteMarker(event: Event): HTMLElement {
    const el = document.createElement('div')

    // Get category style
    const styles = this.getCategoryStyle(event.category)

    el.innerHTML = `
      <div style="
        width: 36px;
        height: 36px;
        position: relative;
      ">
        <!-- Glow ring -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: ${styles.color}22;
          ${styles.shape === 'circle' ? 'border-radius: 50%;' : `clip-path: ${this.getShapeClip(styles.shape)};`}
          box-shadow: 0 0 20px ${styles.color};
          animation: glow-${styles.animation} 2s ease-in-out infinite;
        "></div>

        <!-- Main sprite -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 32px;
          height: 32px;
          background: ${styles.color};
          ${styles.shape === 'circle' ? 'border-radius: 50%;' : `clip-path: ${this.getShapeClip(styles.shape)};`}
          border: 2px solid rgba(255,255,255,0.5);
          box-shadow: 0 0 12px ${styles.color};
          animation: ${styles.animation} 2s ease-in-out infinite;
        "></div>

        <!-- Icon -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
          z-index: 10;
        ">${styles.icon}</div>
      </div>
      <style>
        @keyframes ${styles.animation} {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes glow-${styles.animation} {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      </style>
    `
    return el
  }

  /**
   * Create heat/popularity marker
   */
  private createHeatMarker(count: number): HTMLElement {
    const el = document.createElement('div')
    const intensity = Math.min(count / 50, 1) // 0-1 based on event count
    const size = 40 + (intensity * 30) // 40-70px

    el.innerHTML = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,0,100,${0.8 * intensity}) 0%, rgba(255,0,100,0) 70%);
        box-shadow: 0 0 ${20 + intensity * 40}px rgba(255,0,100,${intensity});
        animation: heat-pulse ${2 - intensity}s ease-in-out infinite;
      "></div>
      <style>
        @keyframes heat-pulse {
          0%, 100% { transform: scale(1); opacity: ${0.6 + intensity * 0.4}; }
          50% { transform: scale(${1 + intensity * 0.3}); opacity: 1; }
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
    const threshold = 0.0001 // ~11 meters - if events are closer than this, separate them
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
        const distance = 0.0002 * count // Increase distance for each additional event
        const offsetLng = event.longitude + Math.cos(angle) * distance
        const offsetLat = event.latitude + Math.sin(angle) * distance
        result.push({ event, lng: offsetLng, lat: offsetLat })
      }
    })

    return result
  }
}
