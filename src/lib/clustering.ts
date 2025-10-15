import mapboxgl from 'mapbox-gl'
import type { Event, EventCluster, ClusteringMode, ClusteringOptions } from '@/types'

export class ClusteringSystem {
  private map: mapboxgl.Map
  private events: Event[] = []
  private clusters: EventCluster[] = []
  private markers: mapboxgl.Marker[] = []
  private options: ClusteringOptions
  private updateTimeout: NodeJS.Timeout | null = null
  private lastZoom: number = -1

  constructor(map: mapboxgl.Map, events: Event[]) {
    this.map = map
    this.events = events
    this.options = {
      mode: 'hybrid',
      maxZoom: 15,
      radius: 50,
      minPoints: 2,
      categoryBasedClustering: true,
      geographicDistribution: true
    }
  }

  initialize() {
    this.updateClustering()
  }

  setClusteringMode(mode: ClusteringMode) {
    this.options.mode = mode
    this.updateClustering()
  }

  updateEvents(events: Event[]) {
    this.events = events
    this.updateClustering()
  }

  updateClustering() {
    // Clear any pending updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout)
    }

    // Debounce the update to prevent rapid firing
    this.updateTimeout = setTimeout(() => {
      const zoom = this.map.getZoom()

      // Only update if zoom level changed significantly
      if (Math.abs(zoom - this.lastZoom) > 0.5) {
        this.clearMarkers()
        this.lastZoom = zoom

        if (zoom <= 10) {
          // Zoomed out: Use geographic distribution clustering
          this.createGeographicClusters()
        } else if (zoom <= 14) {
          // Medium zoom: Use hybrid clustering
          this.createHybridClusters()
        } else {
          // Zoomed in: Show individual events with subcategory details
          this.createIndividualMarkers()
        }
      }
    }, 200)
  }

  private createGeographicClusters() {
    // Divide SF into geographic regions to prevent downtown bias
    const regions = this.divideIntoRegions()

    regions.forEach(region => {
      if (region.events.length === 0) return

      const center = this.calculateRegionCenter(region.events)
      const cluster: EventCluster = {
        id: `geo-${region.name}`,
        latitude: center.lat,
        longitude: center.lng,
        events: region.events,
        category: this.getDominantCategory(region.events),
        count: region.events.length,
        bounds: region.bounds
      }

      this.createClusterMarker(cluster, 'geographic')
    })
  }

  private createHybridClusters() {
    // Your preferred clustering: combines geographic + category awareness
    const clustered = this.performHybridClustering()

    clustered.forEach(cluster => {
      this.createClusterMarker(cluster, 'hybrid')
    })
  }

  private createIndividualMarkers() {
    // Show individual events with detailed subcategory info
    this.events.forEach(event => {
      this.createEventMarker(event)
    })
  }

  private divideIntoRegions() {
    const regions = [
      {
        name: 'downtown',
        bounds: { north: 37.7956, south: 37.7749, east: -122.3944, west: -122.4194 },
        events: []
      },
      {
        name: 'mission',
        bounds: { north: 37.7749, south: 37.7399, east: -122.4044, west: -122.4344 },
        events: []
      },
      {
        name: 'richmond',
        bounds: { north: 37.7856, south: 37.7656, east: -122.4444, west: -122.5144 },
        events: []
      },
      {
        name: 'sunset',
        bounds: { north: 37.7656, south: 37.7356, east: -122.4444, west: -122.5144 },
        events: []
      },
      {
        name: 'marina',
        bounds: { north: 37.8156, south: 37.7956, east: -122.4194, west: -122.4594 },
        events: []
      },
      {
        name: 'castro',
        bounds: { north: 37.7699, south: 37.7499, east: -122.4244, west: -122.4444 },
        events: []
      }
    ]

    // Assign events to regions
    this.events.forEach(event => {
      const region = regions.find(r =>
        event.latitude >= r.bounds.south &&
        event.latitude <= r.bounds.north &&
        event.longitude >= r.bounds.west &&
        event.longitude <= r.bounds.east
      )

      if (region) {
        region.events.push(event)
      } else {
        // Default to downtown if no region match
        regions[0].events.push(event)
      }
    })

    return regions.filter(r => r.events.length > 0)
  }

  private performHybridClustering(): EventCluster[] {
    const clusters: EventCluster[] = []
    const processed = new Set<string>()

    this.events.forEach(event => {
      if (processed.has(event.id)) return

      const nearbyEvents = this.findNearbyEvents(event, this.options.radius)

      if (nearbyEvents.length >= this.options.minPoints) {
        // Create cluster
        const clusterEvents = [event, ...nearbyEvents]
        clusterEvents.forEach(e => processed.add(e.id))

        const center = this.calculateCenter(clusterEvents)
        const cluster: EventCluster = {
          id: `hybrid-${event.id}`,
          latitude: center.lat,
          longitude: center.lng,
          events: clusterEvents,
          category: this.getDominantCategory(clusterEvents),
          count: clusterEvents.length,
          bounds: this.calculateBounds(clusterEvents)
        }

        clusters.push(cluster)
      } else {
        // Single event
        processed.add(event.id)
        const cluster: EventCluster = {
          id: `single-${event.id}`,
          latitude: event.latitude,
          longitude: event.longitude,
          events: [event],
          category: event.category,
          count: 1,
          bounds: {
            north: event.latitude + 0.001,
            south: event.latitude - 0.001,
            east: event.longitude + 0.001,
            west: event.longitude - 0.001
          }
        }
        clusters.push(cluster)
      }
    })

    return clusters
  }

  private findNearbyEvents(centerEvent: Event, radiusMeters: number): Event[] {
    return this.events.filter(event => {
      if (event.id === centerEvent.id) return false

      const distance = this.calculateDistance(
        centerEvent.latitude, centerEvent.longitude,
        event.latitude, event.longitude
      )

      return distance <= radiusMeters
    })
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180
    const φ2 = lat2 * Math.PI/180
    const Δφ = (lat2-lat1) * Math.PI/180
    const Δλ = (lon2-lon1) * Math.PI/180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  private calculateCenter(events: Event[]): { lat: number, lng: number } {
    const lat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length
    const lng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length
    return { lat, lng }
  }

  private calculateRegionCenter(events: Event[]): { lat: number, lng: number } {
    return this.calculateCenter(events)
  }

  private calculateBounds(events: Event[]) {
    const lats = events.map(e => e.latitude)
    const lngs = events.map(e => e.longitude)

    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    }
  }

  private getDominantCategory(events: Event[]): string {
    const categoryCounts = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)[0][0]
  }

  private createClusterMarker(cluster: EventCluster, type: 'geographic' | 'hybrid') {
    const element = this.createClusterElement(cluster, type)

    const marker = new mapboxgl.Marker(element)
      .setLngLat([cluster.longitude, cluster.latitude])
      .addTo(this.map)

    // Add click handler for cluster
    element.addEventListener('click', () => {
      this.handleClusterClick(cluster)
    })

    this.markers.push(marker)
  }

  private createEventMarker(event: Event) {
    const element = this.createEventElement(event)

    const marker = new mapboxgl.Marker(element)
      .setLngLat([event.longitude, event.latitude])
      .addTo(this.map)

    // Add popup with event details
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(this.createEventPopupHTML(event))

    marker.setPopup(popup)
    this.markers.push(marker)
  }

  private createClusterElement(cluster: EventCluster, type: string): HTMLElement {
    const element = document.createElement('div')
    element.className = 'cluster-marker'

    const size = Math.min(40 + (cluster.count * 4), 90)
    const opacity = Math.min(0.8 + (cluster.count * 0.02), 0.95)
    const borderWidth = cluster.count > 10 ? 4 : cluster.count > 5 ? 3 : 2

    // Dynamic styling based on category and type
    const categoryColor = this.getCategoryColor(cluster.category)

    element.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: linear-gradient(135deg, ${categoryColor}, ${this.darkenColor(categoryColor, 20)});
      border: ${borderWidth}px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: ${size > 60 ? '16px' : size > 45 ? '14px' : '12px'};
      box-shadow: 0 ${size > 60 ? '8' : '4'}px ${size > 60 ? '20' : '12'}px rgba(0,0,0,0.3),
                  0 0 0 1px rgba(255,255,255,0.1);
      cursor: pointer;
      opacity: ${opacity};
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      backdrop-filter: blur(1px);
    `

    // Add animation for hot areas
    if (cluster.count > 5) {
      element.style.animation = 'pulse 2s infinite'
    }

    element.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: ${size > 60 ? '14px' : '10px'};">
          ${this.getCategoryIcon(cluster.category)}
        </div>
        <div>${cluster.count}</div>
      </div>
    `

    // Add hover effects
    element.addEventListener('mouseenter', () => {
      element.style.transform = 'scale(1.15)'
      element.style.zIndex = '1000'
      element.style.boxShadow = `0 ${size > 60 ? '12' : '8'}px ${size > 60 ? '30' : '20'}px rgba(0,0,0,0.4),
                                  0 0 0 2px rgba(255,255,255,0.3),
                                  0 0 20px rgba(${this.hexToRgb(categoryColor)}, 0.4)`
    })

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'scale(1)'
      element.style.zIndex = 'auto'
      element.style.boxShadow = `0 ${size > 60 ? '8' : '4'}px ${size > 60 ? '20' : '12'}px rgba(0,0,0,0.3),
                                  0 0 0 1px rgba(255,255,255,0.1)`
    })

    return element
  }

  private createEventElement(event: Event): HTMLElement {
    const element = document.createElement('div')
    element.className = 'event-marker'

    const categoryColor = this.getCategoryColor(event.category)

    element.style.cssText = `
      width: 24px;
      height: 24px;
      background: ${categoryColor};
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.2s ease;
    `

    element.innerHTML = this.getCategoryIcon(event.category)

    element.addEventListener('mouseenter', () => {
      element.style.transform = 'scale(1.2)'
    })

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'scale(1)'
    })

    return element
  }

  private getCategoryColor(category: string): string {
    const colors = {
      'Music': '#FF6B6B',
      'Sports': '#4ECDC4',
      'Food': '#45B7D1',
      'Arts': '#96CEB4',
      'Technology': '#FECA57',
      'Community': '#FF9FF3',
      'Markets': '#54A0FF',
      'Fitness': '#5F27CD'
    }
    return colors[category as keyof typeof colors] || '#6C5CE7'
  }

  private darkenColor(color: string, percent: number): string {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    const darken = (c: number) => Math.max(0, Math.floor(c * (100 - percent) / 100))

    return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`
  }

  private hexToRgb(hex: string): string {
    const color = hex.replace('#', '')
    const r = parseInt(color.substr(0, 2), 16)
    const g = parseInt(color.substr(2, 2), 16)
    const b = parseInt(color.substr(4, 2), 16)
    return `${r}, ${g}, ${b}`
  }

  private getCategoryIcon(category: string): string {
    const icons = {
      'Music': '🎵',
      'Sports': '⚽',
      'Food': '🍽️',
      'Arts': '🎨',
      'Technology': '💻',
      'Community': '👥',
      'Markets': '🛒',
      'Fitness': '💪'
    }
    return icons[category as keyof typeof icons] || '📍'
  }

  private createEventPopupHTML(event: Event): string {
    return `
      <div style="padding: 12px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">${event.title}</h3>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">
          <strong>📍 ${event.venue}</strong>
        </p>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">
          ${event.subcategory} • ${new Date(event.startTime).toLocaleDateString()}
        </p>
        <p style="margin: 0 0 8px 0; color: #333; font-size: 12px;">
          ${event.description}
        </p>
        <p style="margin: 0; font-weight: bold; color: ${event.price.isFree ? '#4ECDC4' : '#FF6B6B'};">
          ${event.price.isFree ? 'Free' : `$${event.price.min}-$${event.price.max}`}
        </p>
      </div>
    `
  }

  private handleClusterClick(cluster: EventCluster) {
    // Zoom into cluster or show cluster menu
    if (this.map.getZoom() < 14) {
      this.map.flyTo({
        center: [cluster.longitude, cluster.latitude],
        zoom: 15,
        duration: 1500,
        curve: 1.42,
        easing: (t) => t * (2 - t)
      })
    } else {
      // Show cluster events menu (will be handled by parent component)
      // This could trigger a callback to show the cluster sidebar
    }
  }

  getClusterAtPoint(point: mapboxgl.Point): Event[] | null {
    // Convert screen point to geographic coordinates
    const lngLat = this.map.unproject(point)

    // Find cluster at this point
    for (const cluster of this.clusters) {
      const distance = this.calculateDistance(
        lngLat.lat, lngLat.lng,
        cluster.latitude, cluster.longitude
      )

      if (distance < 100) { // 100 meter tolerance
        return cluster.events
      }
    }

    return null
  }

  private clearMarkers() {
    this.markers.forEach(marker => marker.remove())
    this.markers = []
    this.clusters = []
  }
}