import mapboxgl from 'mapbox-gl'
import type { Event, EventCluster, ClusteringMode, ClusteringOptions } from '@/types'
import type { NeighborhoodCollection } from './neighborhoods'
import { createNeighborhoodClusters, getClusterLabel, getClusterZoomLevel } from './neighborhoodClustering'
import { createPopularityClusters, getPopularityClusterLabel } from './popularityClustering'
import { SimpleNeighborhoodClickHandler } from './simpleNeighborhoodClick'

export class HybridClusteringSystem {
  private map: mapboxgl.Map
  private events: Event[] = []
  private clusters: EventCluster[] = []
  private clickHandler: SimpleNeighborhoodClickHandler
  private neighborhoods: NeighborhoodCollection | null = null
  private stableClusterCenters: Map<string, { lat: number, lng: number }> = new Map()
  private options: ClusteringOptions
  private sourceName = 'events'
  private clusterLayerName = 'clusters'
  private clusterCountLayerName = 'cluster-count'
  private unclusteredLayerName = 'unclustered-points'
  private lastClickTime = 0
  private clickTimeout: NodeJS.Timeout | null = null
  private hierarchicalMode = false // Flag to prevent automatic clustering interference
  private htmlMarkers: Map<string, mapboxgl.Marker> = new Map() // HTML markers for custom icons
  private currentZoom: number = 12
  private updateMarkersTimeout: NodeJS.Timeout | null = null
  private declusteredNeighborhoods: Set<string> = new Set() // Track which neighborhoods are declustered

  constructor(map: mapboxgl.Map, events: Event[], neighborhoods: NeighborhoodCollection | null = null) {
    this.map = map
    this.events = events
    this.neighborhoods = neighborhoods
    this.clickHandler = new SimpleNeighborhoodClickHandler(map)
    this.options = {
      mode: 'hybrid',
      maxZoom: 15,
      radius: 50,
      minPoints: 2,
      categoryBasedClustering: true,
      geographicDistribution: true
    }
  }

  // Add method to update neighborhoods
  setNeighborhoods(neighborhoods: NeighborhoodCollection) {
    this.neighborhoods = neighborhoods
    this.updateClustering()
  }

  initialize() {
    this.setupSource()
    this.setupLayers()
    this.setupInteractions()
    this.updateClustering()
  }

  updateEvents(events: Event[]) {
    this.events = events
    // Clear stable centers when events change significantly
    this.stableClusterCenters.clear()
    this.updateClustering()
  }

  setClusteringMode(mode: ClusteringMode) {
    this.options.mode = mode
    this.updateClustering()
  }

  updateClustering() {
    // Skip automatic clustering if we're in hierarchical breakdown mode
    if (this.hierarchicalMode) {
      console.log('Skipping automatic clustering - in hierarchical mode')
      return
    }

    const zoom = this.map.getZoom()
    this.currentZoom = zoom

    // Filter events by expanded area around viewport for better coverage
    const bounds = this.map.getBounds()
    if (!bounds) {
      // If bounds are not available, show all events
      this.clusters = this.createIndividualClusters(this.events)
      // DO NOT call updateLayersWithClusters - we only use HTML markers
      this.hideCircleLayers()
      this.updateHTMLMarkers(this.clusters, zoom)
      return
    }

    // Expand bounds based on zoom level for better event coverage
    const expansion = zoom > 14 ? 0.02 : zoom > 12 ? 0.05 : 0.1 // degrees
    const expandedBounds = {
      south: bounds.getSouth() - expansion,
      north: bounds.getNorth() + expansion,
      west: bounds.getWest() - expansion,
      east: bounds.getEast() + expansion
    }

    const eventsInViewport = this.events.filter(event =>
      event.latitude >= expandedBounds.south &&
      event.latitude <= expandedBounds.north &&
      event.longitude >= expandedBounds.west &&
      event.longitude <= expandedBounds.east
    )

    let clustersToShow: EventCluster[] = []

    // Three-tier clustering strategy
    if (zoom < 11) {
      // Zoom 0-10 (Zoomed OUT): Popularity-based clustering - group by event size/attendance
      clustersToShow = createPopularityClusters(
        eventsInViewport,
        zoom,
        {
          minAttendanceForCluster: 80,
          popularityWeight: 0.7,
          proximityRadius: zoom < 9 ? 10 : 6 // Very aggressive merging when zoomed out
        }
      )
      console.log(`🔥 Popularity clustering: ${clustersToShow.length} clusters at zoom ${zoom.toFixed(1)}`)
    } else if (zoom < 15) {
      // Zoom 11-14 (Standard): Neighborhood-based clustering - STRICTLY ONE PER NEIGHBORHOOD
      const neighborhoodClusters = createNeighborhoodClusters(
        eventsInViewport,
        this.neighborhoods,
        zoom,
        {
          maxEventsPerCluster: 999,  // NEVER subdivide - keep all events in neighborhood together
          minEventsToCluster: 1,  // Even single events get neighborhood badge
          densitySubdivisionThreshold: 99999  // NEVER EVER subdivide
        }
      )

      // Handle declustered neighborhoods
      clustersToShow = []
      neighborhoodClusters.forEach(cluster => {
        const neighborhoodName = cluster.metadata?.neighborhoodName
        if (neighborhoodName && this.clickHandler.isDeclustered(neighborhoodName)) {
          // Show individual events
          cluster.events.forEach(event => {
            clustersToShow.push({
              id: `individual-${event.id}`,
              latitude: event.latitude,
              longitude: event.longitude,
              events: [event],
              category: event.category,
              count: 1,
              radius: 0,
              isStable: true
            })
          })
        } else {
          // Keep as neighborhood cluster
          clustersToShow.push(cluster)
        }
      })

      console.log(`🏘️ Neighborhood clustering: ${clustersToShow.length} clusters (${this.declusteredNeighborhoods.size} declustered) at zoom ${zoom.toFixed(1)}`)
    } else {
      // Zoom 15+ (Close): Show individual events with gaming sprites
      clustersToShow = this.createIndividualClusters(eventsInViewport)
      console.log(`📍 Individual events: ${clustersToShow.length} events at zoom ${zoom.toFixed(1)}`)
    }

    // Clear declustered neighborhoods if we zoom out
    if (zoom < 11) {
      this.declusteredNeighborhoods.clear()
    }

    // Store clusters
    this.clusters = clustersToShow
    // SKIP updating the old circle layers - we only use HTML markers now
    // this.updateLayersWithClusters(clustersToShow)
    this.hideCircleLayers() // Hide circle layers after updating source

    this.updateHTMLMarkers(clustersToShow, zoom)
  }

  /**
   * Update HTML markers with custom icons - debounced for smooth zoom
   */
  private updateHTMLMarkers(clusters: EventCluster[], zoom: number) {
    // Clear any pending updates
    if (this.updateMarkersTimeout) {
      clearTimeout(this.updateMarkersTimeout)
    }

    // Debounce marker updates during zoom
    this.updateMarkersTimeout = setTimeout(() => {
      this.renderHTMLMarkers(clusters, zoom)
    }, 100)
  }

  /**
   * Actually render the HTML markers
   */
  private renderHTMLMarkers(clusters: EventCluster[], zoom: number) {
    // Hide the old circle layers to prevent double rendering
    this.hideCircleLayers()

    // Determine cluster type based on zoom
    let clusterType: 'popularity' | 'neighborhood' | 'individual' = 'individual'
    if (zoom < 11) {
      clusterType = 'popularity'
    } else if (zoom < 15) {
      clusterType = 'neighborhood'
    }


    // Track which markers should exist
    const currentClusterIds = new Set(clusters.map(c => c.id))

    // Remove markers that no longer exist
    this.htmlMarkers.forEach((marker, id) => {
      if (!currentClusterIds.has(id)) {
        marker.remove()
        this.htmlMarkers.delete(id)
      }
    })

    // Add or update markers
    clusters.forEach(cluster => {
      const existingMarker = this.htmlMarkers.get(cluster.id)

      // Determine type for THIS specific cluster - check if it's actually individual
      let thisClusterType = clusterType
      if (cluster.events.length === 1 || cluster.id.startsWith('individual-')) {
        thisClusterType = 'individual' // Force individual rendering for single-event clusters
      }

      if (existingMarker) {
        // REMOVE and recreate marker instead of updating - positioning issues
        existingMarker.remove()
        this.htmlMarkers.delete(cluster.id)

        // Create fresh marker
        const el = this.createClusterElement(cluster, thisClusterType)
        if (el) {
          el.style.cursor = 'pointer'
          el.style.zIndex = '9999'
          el.style.pointerEvents = 'auto'
          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([cluster.longitude, cluster.latitude])
            .addTo(this.map)
          this.htmlMarkers.set(cluster.id, marker)
        }
      } else {
        // Create new marker
        const el = this.createClusterElement(cluster, thisClusterType)
        if (el) {
          el.style.cursor = 'pointer'
          el.style.zIndex = '9999'
          el.style.pointerEvents = 'auto'
          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([cluster.longitude, cluster.latitude])
            .addTo(this.map)

          this.htmlMarkers.set(cluster.id, marker)
        }
      }
    })
  }

  /**
   * Hide circle layers to use HTML markers instead
   */
  private hideCircleLayers() {
    const layersToHide = [
      'cluster-shadow',
      'cluster-base',
      this.clusterLayerName,
      'cluster-highlight',
      'cluster-inner-glow',
      this.clusterCountLayerName,
      this.unclusteredLayerName,
      'unclustered-highlight',
      'unclustered-inner-glow'
    ]

    layersToHide.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        // Set visibility to none AND opacity to 0 to completely hide
        this.map.setLayoutProperty(layerId, 'visibility', 'none')
        if (this.map.getLayer(layerId)?.type === 'circle') {
          this.map.setPaintProperty(layerId, 'circle-opacity', 0)
        } else if (this.map.getLayer(layerId)?.type === 'symbol') {
          this.map.setPaintProperty(layerId, 'icon-opacity', 0)
          this.map.setPaintProperty(layerId, 'text-opacity', 0)
        }
      }
    })
  }

  /**
   * Create custom cluster element based on type
   */
  private createClusterElement(cluster: EventCluster, clusterType: 'popularity' | 'neighborhood' | 'individual'): HTMLElement {
    const el = document.createElement('div')
    el.className = 'custom-cluster-marker'
    el.style.cursor = 'pointer'
    el.style.pointerEvents = 'auto' // Ensure clicks are captured
    el.style.userSelect = 'none' // Prevent text selection
    el.style.position = 'relative'
    el.style.zIndex = '10000'

    const eventCount = cluster.events.length

    // Force neighborhood rendering if cluster has neighborhood metadata
    if (cluster.metadata?.neighborhoodName) {
      clusterType = 'neighborhood'
    }

    if (clusterType === 'popularity') {
      // HEAT MAP ZONE - For zoomed way out (zoom < 11)
      // Shows activity density, not individual events

      // Calculate heat based on event count
      const getHeatZone = () => {
        if (eventCount >= 20) return {
          color: '#ff0000',
          intensity: 'EXTREME',
          size: 100,
          opacity: 0.8
        }
        if (eventCount >= 12) return {
          color: '#ff6600',
          intensity: 'HIGH',
          size: 80,
          opacity: 0.7
        }
        if (eventCount >= 6) return {
          color: '#ffcc00',
          intensity: 'MEDIUM',
          size: 60,
          opacity: 0.6
        }
        return {
          color: '#00aaff',
          intensity: 'LOW',
          size: 45,
          opacity: 0.5
        }
      }

      const heat = getHeatZone()

      el.innerHTML = `
        <div style="position: relative; width: ${heat.size}px; height: ${heat.size}px;">
          <!-- Heat zone circle -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${heat.size}px;
            height: ${heat.size}px;
            border-radius: 50%;
            background: radial-gradient(circle, ${heat.color}${Math.round(heat.opacity * 255).toString(16)}, transparent 70%);
            box-shadow: 0 0 30px ${heat.color}aa;
            animation: heat-pulse 3s ease-in-out infinite;
          "></div>

          <!-- Inner glow - NO COUNT for cleaner look -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${heat.size * 0.4}px;
            height: ${heat.size * 0.4}px;
            border-radius: 50%;
            background: ${heat.color};
            opacity: ${heat.opacity * 1.2};
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 0 15px ${heat.color};
          "></div>
        </div>

        <style>
          @keyframes heat-pulse {
            0%, 100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: ${heat.opacity};
            }
            50% {
              transform: translate(-50%, -50%) scale(1.1);
              opacity: ${heat.opacity * 1.2};
            }
          }
        </style>
      `
    } else if (clusterType === 'neighborhood') {
      // OPTION 3: Neon Cyberpunk Waypoint - Gaming/Futuristic
      const neighborhoodName = cluster.metadata?.neighborhoodName || 'Area'

      // Calculate marker size based on zoom level AND neighborhood radius
      const zoom = this.currentZoom
      const neighborhoodRadius = cluster.metadata?.boundaryRadius || 0.5 // radius in km

      // Calculate base size that scales with zoom and neighborhood size
      // Smaller neighborhoods get smaller markers, larger ones get bigger markers
      let baseSize = 32 // default
      if (zoom >= 13) {
        baseSize = Math.min(60, Math.max(28, neighborhoodRadius * 40))
      } else if (zoom >= 12) {
        baseSize = Math.min(48, Math.max(24, neighborhoodRadius * 32))
      } else {
        baseSize = Math.min(40, Math.max(20, neighborhoodRadius * 24))
      }

      const glowSize = baseSize + 12

      // Neon colors by activity level
      const getNeonLevel = () => {
        if (eventCount >= 10) return { color: '#ff0066', glow: '#ff0066', name: 'HOT ZONE' }
        if (eventCount >= 6) return { color: '#00ffff', glow: '#00ffff', name: 'ACTIVE' }
        if (eventCount >= 3) return { color: '#9d00ff', glow: '#9d00ff', name: 'BUSY' }
        return { color: '#00ff88', glow: '#00ff88', name: 'CHILL' }
      }

      const neon = getNeonLevel()

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none;">
          <!-- Pulsing glow ring -->
          <div style="
            position: absolute;
            top: ${baseSize * 0.15}px;
            left: 50%;
            transform: translateX(-50%);
            width: ${glowSize}px;
            height: ${glowSize}px;
            border: 2px solid ${neon.glow};
            border-radius: 50%;
            opacity: 0.5;
            animation: neon-pulse 2s ease-in-out infinite;
            box-shadow: 0 0 20px ${neon.glow}88, inset 0 0 20px ${neon.glow}44;
            pointer-events: none;
          "></div>

          <!-- Hexagon waypoint -->
          <div style="
            width: ${baseSize}px;
            height: ${baseSize}px;
            position: relative;
            filter: drop-shadow(0 0 10px ${neon.glow}aa);
            pointer-events: none;
          ">
            <!-- Hexagon outline -->
            <div style="
              width: ${baseSize}px;
              height: ${baseSize}px;
              background: rgba(0,0,0,0.8);
              clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
              border: 2px solid ${neon.color};
              box-shadow:
                0 0 12px ${neon.glow}88,
                inset 0 0 12px ${neon.glow}33;
              animation: neon-flicker 3s ease-in-out infinite;
            ">
              <!-- Inner hexagon -->
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: ${baseSize * 0.67}px;
                height: ${baseSize * 0.67}px;
                clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
                background: ${neon.color}22;
              "></div>

              <!-- Digital count display -->
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: ${neon.color};
                font-size: ${baseSize * 0.375}px;
                font-weight: 900;
                font-family: 'Courier New', monospace;
                text-shadow: 0 0 6px ${neon.glow};
                animation: digital-flicker 0.15s infinite;
              ">${eventCount}</div>
            </div>
          </div>

          <!-- Status label -->
          <div style="
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid ${neon.color};
            padding: 2px 8px;
            color: ${neon.color};
            font-size: ${Math.max(8, baseSize * 0.188)}px;
            font-weight: 900;
            font-family: 'Courier New', monospace;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 0 10px ${neon.glow}66;
            text-shadow: 0 0 6px ${neon.glow};
            pointer-events: none;
          ">${neon.name}</div>
        </div>

        <style>
          @keyframes neon-pulse {
            0%, 100% {
              transform: translateX(-50%) scale(1);
              opacity: 0.4;
            }
            50% {
              transform: translateX(-50%) scale(1.15);
              opacity: 0.7;
            }
          }

          @keyframes neon-flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.96; }
          }

          @keyframes digital-flicker {
            0%, 90% { opacity: 1; }
            95% { opacity: 0.85; }
          }
        </style>
      `
    } else {
      // INDIVIDUAL VENUE - Gaming Sprite Style with Animations
      const event = cluster.events[0]
      const category = event?.category || 'Other'

      // Get gaming sprite style by category - more vibrant and animated
      const getCategorySprite = () => {
        switch(category.toLowerCase()) {
          case 'music':
            return {
              color: '#ff0066',
              icon: '♫',
              glow: '#ff0066',
              shape: 'diamond',
              animation: 'music-pulse'
            }
          case 'food':
            return {
              color: '#ff9900',
              icon: '🍴',
              glow: '#ff9900',
              shape: 'circle',
              animation: 'food-rotate'
            }
          case 'sports':
            return {
              color: '#00ff99',
              icon: '⚡',
              glow: '#00ff99',
              shape: 'hexagon',
              animation: 'sports-bounce'
            }
          case 'arts':
            return {
              color: '#cc00ff',
              icon: '✦',
              glow: '#cc00ff',
              shape: 'star',
              animation: 'arts-shimmer'
            }
          case 'technology':
            return {
              color: '#00ccff',
              icon: '◆',
              glow: '#00ccff',
              shape: 'square',
              animation: 'tech-glitch'
            }
          default:
            return {
              color: '#ffff00',
              icon: '★',
              glow: '#ffff00',
              shape: 'circle',
              animation: 'default-spin'
            }
        }
      }

      const sprite = getCategorySprite()

      // Get shape clip-path
      const getShapeClip = (shape: string) => {
        switch(shape) {
          case 'diamond': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
          case 'hexagon': return 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)'
          case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
          case 'square': return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
          default: return 'none'
        }
      }

      el.innerHTML = `
        <div style="position: relative; width: 36px; height: 36px;">
          <!-- Outer glow ring -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            background: ${sprite.glow}22;
            ${sprite.shape === 'circle' ? 'border-radius: 50%;' : `clip-path: ${getShapeClip(sprite.shape)};`}
            box-shadow: 0 0 20px ${sprite.glow};
            animation: ${sprite.animation}-glow 2s ease-in-out infinite;
          "></div>

          <!-- Main sprite body -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, ${sprite.color} 0%, ${sprite.color}cc 100%);
            ${sprite.shape === 'circle' ? 'border-radius: 50%;' : `clip-path: ${getShapeClip(sprite.shape)};`}
            border: 2px solid rgba(255,255,255,0.5);
            box-shadow:
              0 0 12px ${sprite.glow},
              inset 0 0 8px ${sprite.glow}66;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: ${sprite.animation} 1.5s ease-in-out infinite;
          ">
            <!-- Icon -->
            <div style="
              font-size: 16px;
              text-shadow: 0 0 6px rgba(255,255,255,0.8);
              animation: icon-float 2s ease-in-out infinite;
            ">${sprite.icon}</div>
          </div>

          <!-- Corner sparkle -->
          <div style="
            position: absolute;
            top: 0;
            right: 0;
            width: 6px;
            height: 6px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 0 8px ${sprite.glow};
            animation: sparkle-blink 1s ease-in-out infinite;
          "></div>
        </div>

        <style>
          /* MUSIC - Intense rhythmic pulse */
          @keyframes music-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            10% { transform: translate(-50%, -50%) scale(1.2); }
            20% { transform: translate(-50%, -50%) scale(1); }
            30% { transform: translate(-50%, -50%) scale(1.15); }
            40%, 100% { transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes music-pulse-glow {
            0%, 100% { opacity: 0.8; box-shadow: 0 0 20px currentColor; }
            10% { opacity: 1; box-shadow: 0 0 40px currentColor, 0 0 60px currentColor; }
            20% { opacity: 0.8; box-shadow: 0 0 20px currentColor; }
          }

          /* FOOD - Breathing glow (no rotation) */
          @keyframes food-rotate {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.08); }
          }
          @keyframes food-rotate-glow {
            0%, 100% { opacity: 0.6; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.3); }
          }

          /* SPORTS - Sharp bounce with impact */
          @keyframes sports-bounce {
            0%, 100% { transform: translate(-50%, -50%) translateY(0) scale(1); }
            40% { transform: translate(-50%, -50%) translateY(-6px) scale(1.05); }
            50% { transform: translate(-50%, -50%) translateY(-6px) scale(1.05); }
            60% { transform: translate(-50%, -50%) translateY(0) scale(0.95); }
            70% { transform: translate(-50%, -50%) translateY(0) scale(1); }
          }
          @keyframes sports-bounce-glow {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; box-shadow: 0 0 30px currentColor; }
          }

          /* ARTS - Ethereal shimmer pulse */
          @keyframes arts-shimmer {
            0%, 100% { transform: translate(-50%, -50%) scale(1); filter: hue-rotate(0deg); }
            50% { transform: translate(-50%, -50%) scale(1.1); filter: hue-rotate(10deg); }
          }
          @keyframes arts-shimmer-glow {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }

          /* TECH - Digital glitch effect */
          @keyframes tech-glitch {
            0%, 85%, 100% { transform: translate(-50%, -50%); filter: hue-rotate(0deg); }
            87% { transform: translate(-48%, -49%); filter: hue-rotate(90deg); }
            89% { transform: translate(-52%, -51%); filter: hue-rotate(-90deg); }
            91% { transform: translate(-50%, -50%); filter: hue-rotate(0deg); }
          }
          @keyframes tech-glitch-glow {
            0%, 85%, 100% { opacity: 0.7; }
            87%, 89% { opacity: 1; box-shadow: 0 0 40px currentColor; }
          }

          /* DEFAULT - Subtle breathe */
          @keyframes default-spin {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.05); }
          }
          @keyframes default-spin-glow {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.9; }
          }

          @keyframes icon-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }

          @keyframes sparkle-blink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.3; }
          }
        </style>
      `
    }

    // Add SIMPLE click handler for neighborhoods
    if (cluster.metadata?.neighborhoodName && clusterType === 'neighborhood') {
      this.clickHandler.addClickHandler(el, cluster, () => this.updateClustering())
    }

    return el
  }

  exitHierarchicalMode() {
    if (this.hierarchicalMode) {
      console.log('Exiting hierarchical mode - returning to automatic clustering')
      this.hierarchicalMode = false
      this.updateClustering() // Resume normal clustering
    }
  }

  // Scalable clustering helper functions - work worldwide
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula for accurate distance calculation
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLng = this.toRadians(lng2 - lng1)
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in kilometers
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private calculateClusterSpread(events: Event[]): number {
    if (events.length < 2) return 0

    let maxDistance = 0
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const distance = this.calculateDistance(
          events[i].latitude, events[i].longitude,
          events[j].latitude, events[j].longitude
        )
        maxDistance = Math.max(maxDistance, distance)
      }
    }
    return maxDistance
  }

  private shouldCreateCluster(events: Event[]): boolean {
    if (events.length < CLUSTERING_CONFIG.MIN_CLUSTER_DENSITY) return false

    const spread = this.calculateClusterSpread(events)
    return spread <= CLUSTERING_CONFIG.MAX_CLUSTER_SPREAD_KM
  }

  private findOptimalClusterCenter(events: Event[]): { lat: number, lng: number } {
    // Use centroid of events as starting point
    const avgLat = events.reduce((sum, event) => sum + event.latitude, 0) / events.length
    const avgLng = events.reduce((sum, event) => sum + event.longitude, 0) / events.length

    // Find the event closest to the centroid (ensures cluster center is on a real location)
    let bestEvent = events[0]
    let minDistance = Infinity

    for (const event of events) {
      const distance = this.calculateDistance(avgLat, avgLng, event.latitude, event.longitude)
      if (distance < minDistance) {
        minDistance = distance
        bestEvent = event
      }
    }

    return { lat: bestEvent.latitude, lng: bestEvent.longitude }
  }

  private findNearbyEventsScalable(centerEvent: Event, allEvents: Event[]): Event[] {
    const nearby: Event[] = []

    for (const event of allEvents) {
      if (event.id === centerEvent.id) continue

      const distance = this.calculateDistance(
        centerEvent.latitude, centerEvent.longitude,
        event.latitude, event.longitude
      )

      if (distance <= CLUSTERING_CONFIG.MAX_CLUSTER_RADIUS_KM) {
        nearby.push(event)
      }
    }

    return nearby
  }

  private getStableClusterCenter(cluster: EventCluster): { lat: number, lng: number } {
    // Create a stable cluster key based on event IDs (sorted for consistency)
    const eventIds = cluster.events.map(e => e.id).sort().join('-')
    const clusterKey = `${cluster.count}-${eventIds.substring(0, 20)}` // Truncate for performance

    // Check if we have a stable center for this cluster composition
    if (this.stableClusterCenters.has(clusterKey)) {
      return this.stableClusterCenters.get(clusterKey)!
    }

    // Calculate optimal center for new cluster
    const optimalCenter = this.findOptimalClusterCenter(cluster.events)

    // Store the stable center
    this.stableClusterCenters.set(clusterKey, optimalCenter)

    // Add debug logging for large clusters
    if (cluster.count >= 10) {
      console.log(`New stable center for cluster ${cluster.id}: [${optimalCenter.lat}, ${optimalCenter.lng}]`)
    }

    return optimalCenter
  }

  private adjustClusterCenter(cluster: EventCluster): EventCluster {
    // Use stable center to prevent sliding during map movement
    const stableCenter = this.getStableClusterCenter(cluster)

    return {
      ...cluster,
      latitude: stableCenter.lat,
      longitude: stableCenter.lng
    }
  }

  private setupSource() {
    // DO NOT CREATE SOURCE AT ALL - we don't need it
    // We only use HTML markers, no GeoJSON source needed
    return

    // OLD CODE DISABLED
    if (this.map.getSource(this.sourceName)) {
      this.map.removeSource(this.sourceName)
    }

    this.map.addSource(this.sourceName, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })
  }

  private setupLayers() {
    // DO NOT CREATE ANY LAYERS - we only use HTML markers
    // Skip all layer creation completely
    return

    // OLD CODE DISABLED BELOW
    this.map.addLayer({
      id: 'cluster-shadow',
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', -999999],
      layout: {
        'visibility': 'none'
      },
      paint: {
        'circle-color': 'rgba(0, 0, 0, 0.6)',
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 32,
          10, 42,
          20, 52,
          50, 62
        ],
        'circle-blur': 2,
        'circle-translate': [3, 3]
      }
    })

    // Layer 2: Base (darker version with depth)
    this.map.addLayer({
      id: 'cluster-base',
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', -999],
      layout: {
        'visibility': 'none'
      },
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'category'], 'Music'], '#A13838',
          ['==', ['get', 'category'], 'Sports'], '#2E7D78',
          ['==', ['get', 'category'], 'Food'], '#2A6B8F',
          ['==', ['get', 'category'], 'Arts'], '#5A8070',
          ['==', ['get', 'category'], 'Technology'], '#A18A35',
          ['==', ['get', 'category'], 'Community'], '#A158A0',
          ['==', ['get', 'category'], 'Markets'], '#3660A0',
          ['==', ['get', 'category'], 'Fitness'], '#3D167A',
          '#4A3A95'
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 26,
          10, 36,
          20, 46,
          50, 56
        ],
        'circle-opacity': 0.9,
        'circle-translate': [1, 1]
      }
    })

    // Layer 3: Main cluster (bright colors)
    this.map.addLayer({
      id: this.clusterLayerName,
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', -999],
      layout: {
        'visibility': 'none'
      },
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'category'], 'Music'], '#FF6B6B',
          ['==', ['get', 'category'], 'Sports'], '#4ECDC4',
          ['==', ['get', 'category'], 'Food'], '#45B7D1',
          ['==', ['get', 'category'], 'Arts'], '#96CEB4',
          ['==', ['get', 'category'], 'Technology'], '#FECA57',
          ['==', ['get', 'category'], 'Community'], '#FF9FF3',
          ['==', ['get', 'category'], 'Markets'], '#54A0FF',
          ['==', ['get', 'category'], 'Fitness'], '#5F27CD',
          '#6C5CE7'
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 20,
          10, 30,
          20, 40,
          50, 50
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    })

    // Layer 4: Bright highlight (strong 3D effect)
    this.map.addLayer({
      id: 'cluster-highlight',
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', -999],
      layout: {
        'visibility': 'none'
      },
      paint: {
        'circle-color': 'rgba(255, 255, 255, 0.7)',
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 8,
          10, 12,
          20, 16,
          50, 20
        ],
        'circle-translate': [-3, -3]
      }
    })

    // Modern 3D cluster icons with numbers and neighborhood names
    this.map.addLayer({
      id: this.clusterCountLayerName,
      type: 'symbol',
      source: this.sourceName,
      filter: ['>', 'count', 1],
      layout: {
        'visibility': 'none',
        'icon-image': [
          'case',
          ['<', ['get', 'count'], 10], this.createModernClusterIcon('small'),
          ['<', ['get', 'count'], 25], this.createModernClusterIcon('medium'),
          this.createModernClusterIcon('large')
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 0.8,
          10, 1.0,
          50, 1.2
        ],
        'icon-allow-overlap': true,
        'text-field': [
          'case',
          ['!=', ['get', 'neighborhoodName'], null],
          ['concat', ['get', 'neighborhoodName'], '\n', ['to-string', ['get', 'count']], ' events'],
          ['to-string', ['get', 'count']]
        ],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 11,
          10, 13,
          20, 14,
          50, 16
        ],
        'text-offset': [0, 0],
        'text-max-width': 10
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.8)',
        'text-halo-width': 2,
        'icon-opacity': 0.95
      }
    })

    // Individual events - Deep shadow layer
    this.map.addLayer({
      id: 'event-shadow',
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', 1],
      paint: {
        'circle-color': 'rgba(0, 0, 0, 0.5)',
        'circle-radius': [
          'case',
          ['>', ['get', 'popularity'], 70], 18,
          ['>', ['get', 'popularity'], 50], 16,
          14
        ],
        'circle-blur': 2,
        'circle-translate': [2, 2]
      }
    })

    // Individual events - Base layer
    this.map.addLayer({
      id: 'event-base',
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', 1],
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'category'], 'Music'], '#CC4A4A',
          ['==', ['get', 'category'], 'Sports'], '#3AA39A',
          ['==', ['get', 'category'], 'Food'], '#3792B8',
          ['==', ['get', 'category'], 'Arts'], '#7CAA94',
          ['==', ['get', 'category'], 'Technology'], '#CCA147',
          ['==', ['get', 'category'], 'Community'], '#CC7FC2',
          ['==', ['get', 'category'], 'Markets'], '#4480CC',
          ['==', ['get', 'category'], 'Fitness'], '#4F1FA3',
          '#5A4AB8'
        ],
        'circle-radius': [
          'case',
          ['>', ['get', 'popularity'], 70], 14,
          ['>', ['get', 'popularity'], 50], 12,
          10
        ],
        'circle-opacity': 0.8
      }
    })

    // Individual events - Main layer
    this.map.addLayer({
      id: this.unclusteredLayerName,
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', -999],
      layout: {
        'visibility': 'none'
      },
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'category'], 'Music'], '#FF6B6B',
          ['==', ['get', 'category'], 'Sports'], '#4ECDC4',
          ['==', ['get', 'category'], 'Food'], '#45B7D1',
          ['==', ['get', 'category'], 'Arts'], '#96CEB4',
          ['==', ['get', 'category'], 'Technology'], '#FECA57',
          ['==', ['get', 'category'], 'Community'], '#FF9FF3',
          ['==', ['get', 'category'], 'Markets'], '#54A0FF',
          ['==', ['get', 'category'], 'Fitness'], '#5F27CD',
          '#6C5CE7'
        ],
        'circle-radius': [
          'case',
          ['>', ['get', 'popularity'], 70], 12,
          ['>', ['get', 'popularity'], 50], 10,
          8
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    })

    // Individual events - Bright highlight layer
    this.map.addLayer({
      id: 'event-highlight',
      type: 'circle',
      source: this.sourceName,
      filter: ['==', 'count', 1],
      paint: {
        'circle-color': 'rgba(255, 255, 255, 0.8)',
        'circle-radius': [
          'case',
          ['>', ['get', 'popularity'], 70], 4,
          ['>', ['get', 'popularity'], 50], 3,
          2
        ],
        'circle-translate': [-2, -2]
      }
    })

    // Modern icon layer using 3D SVG symbols
    this.map.addLayer({
      id: 'event-icons',
      type: 'symbol',
      source: this.sourceName,
      filter: ['==', 'count', 1],
      layout: {
        'icon-image': [
          'case',
          ['==', ['get', 'category'], 'Music'], this.createSvgIcon('music'),
          ['==', ['get', 'category'], 'Sports'], this.createSvgIcon('sports'),
          ['==', ['get', 'category'], 'Food'], this.createSvgIcon('food'),
          ['==', ['get', 'category'], 'Arts'], this.createSvgIcon('arts'),
          ['==', ['get', 'category'], 'Technology'], this.createSvgIcon('tech'),
          ['==', ['get', 'category'], 'Community'], this.createSvgIcon('community'),
          ['==', ['get', 'category'], 'Markets'], this.createSvgIcon('markets'),
          ['==', ['get', 'category'], 'Fitness'], this.createSvgIcon('fitness'),
          this.createSvgIcon('default')
        ],
        'icon-size': 1.1,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    })
  }

  private createSvgIcon(type: string): string {
    const iconId = `${type}-icon-3d`

    // Check if icon already exists
    if (this.map.hasImage(iconId)) {
      return iconId
    }

    const svgIcons = {
      music: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="musicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF8787;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="musicHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="musicShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#musicGrad)" filter="url(#musicShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#musicHighlight)"/>
        <path d="M10 18V10l8-1.5v8M17 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM12 18a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" fill="white" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
      </svg>`,

      sports: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sportsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4ECDC4;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#26D0CE;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="sportsHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="sportsShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#sportsGrad)" filter="url(#sportsShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#sportsHighlight)"/>
        <circle cx="14" cy="14" r="6" fill="none" stroke="white" stroke-width="2"/>
        <path d="M8 14h12M14 8v12" stroke="white" stroke-width="1.5"/>
      </svg>`,

      food: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="foodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FFB74D;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#F57C00;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="foodHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="foodShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#foodGrad)" filter="url(#foodShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#foodHighlight)"/>
        <rect x="8" y="11" width="12" height="8" rx="2" fill="white"/>
        <circle cx="11" cy="8" r="1.5" fill="white"/>
        <circle cx="14" cy="8" r="1.5" fill="white"/>
        <circle cx="17" cy="8" r="1.5" fill="white"/>
      </svg>`,

      arts: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="artsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#9C27B0;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#673AB7;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="artsHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="artsShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#artsGrad)" filter="url(#artsShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#artsHighlight)"/>
        <path d="M8 20l3-8 3 6 3-6 3 8H8z" fill="white"/>
        <circle cx="11" cy="10" r="1.5" fill="white"/>
      </svg>`,

      tech: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="techGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FFC107;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF9800;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="techHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="techShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#techGrad)" filter="url(#techShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#techHighlight)"/>
        <rect x="8" y="10" width="12" height="8" rx="2" fill="white"/>
        <rect x="10" y="12" width="8" height="4" fill="url(#techGrad)"/>
        <rect x="11" y="8" width="6" height="2" fill="white"/>
      </svg>`,

      community: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="communityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#E91E63;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#F06292;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="communityHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="communityShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#communityGrad)" filter="url(#communityShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#communityHighlight)"/>
        <circle cx="11" cy="11" r="2" fill="white"/>
        <circle cx="17" cy="11" r="2" fill="white"/>
        <path d="M8 18c0-3 2-4 6-4s6 1 6 4" stroke="white" stroke-width="2" fill="none"/>
      </svg>`,

      markets: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="marketsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="marketsHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="marketsShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#marketsGrad)" filter="url(#marketsShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#marketsHighlight)"/>
        <path d="M8 11h12l-2 8H10l-2-8z" fill="white"/>
        <path d="M10 11V8a2 2 0 114 0v3M14 11V8a2 2 0 114 0v3" stroke="white" stroke-width="1.5"/>
      </svg>`,

      fitness: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fitnessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8BC34A;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#558B2F;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="fitnessHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="fitnessShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#fitnessGrad)" filter="url(#fitnessShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#fitnessHighlight)"/>
        <rect x="7" y="12" width="3" height="4" fill="white"/>
        <rect x="18" y="12" width="3" height="4" fill="white"/>
        <rect x="10" y="13" width="8" height="2" fill="white"/>
      </svg>`,

      default: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="defaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#607D8B;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#455A64;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="defaultHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
          </radialGradient>
          <filter id="defaultShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.4"/>
          </filter>
        </defs>
        <circle cx="14" cy="14" r="12" fill="url(#defaultGrad)" filter="url(#defaultShadow)"/>
        <circle cx="14" cy="14" r="11" fill="url(#defaultHighlight)"/>
        <circle cx="14" cy="14" r="4" fill="white"/>
      </svg>`
    }

    const svgString = svgIcons[type as keyof typeof svgIcons] || svgIcons.default

    // Convert SVG to image and add to map
    const img = new Image(28, 28)
    img.onload = () => {
      this.map.addImage(iconId, img)
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    return iconId
  }

  private createModernClusterIcon(size: 'small' | 'medium' | 'large'): string {
    const iconId = `cluster-${size}-3d`

    // Check if icon already exists
    if (this.map.hasImage(iconId)) {
      return iconId
    }

    // Define size-based properties
    const sizeConfig = {
      small: { radius: 18, strokeWidth: 3, gradient: ['#FF6B6B', '#FF8787'], shadow: 2 },
      medium: { radius: 22, strokeWidth: 4, gradient: ['#4ECDC4', '#26D0CE'], shadow: 3 },
      large: { radius: 26, strokeWidth: 5, gradient: ['#45B7D1', '#96CEB4'], shadow: 4 }
    }

    const config = sizeConfig[size]
    const svgSize = config.radius * 2 + config.shadow * 2

    const svgString = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${size}Grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${config.gradient[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${config.gradient[1]};stop-opacity:1" />
        </linearGradient>
        <radialGradient id="${size}Highlight" cx="30%" cy="30%" r="50%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.6);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
        </radialGradient>
        <filter id="${size}Shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="${config.shadow}"/>
          <feOffset dx="${config.shadow}" dy="${config.shadow}" result="offsetblur"/>
          <feFlood flood-color="rgba(0,0,0,0.4)"/>
          <feComposite in2="offsetblur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Main cluster circle with 3D effect -->
      <circle cx="${svgSize/2}" cy="${svgSize/2}" r="${config.radius}"
              fill="url(#${size}Grad)"
              stroke="rgba(255,255,255,0.8)"
              stroke-width="${config.strokeWidth}"
              filter="url(#${size}Shadow)"/>

      <!-- 3D highlight overlay -->
      <circle cx="${svgSize/2}" cy="${svgSize/2}" r="${config.radius - config.strokeWidth}"
              fill="url(#${size}Highlight)"/>

      <!-- Inner glow ring -->
      <circle cx="${svgSize/2}" cy="${svgSize/2}" r="${config.radius - config.strokeWidth - 2}"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              stroke-width="1"/>
    </svg>`

    // Convert SVG to image and add to map
    const img = new Image(svgSize, svgSize)
    img.onload = () => {
      this.map.addImage(iconId, img)
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    return iconId
  }

  private setupInteractions() {
    // NO INTERACTIONS - we only use HTML markers with their own click handlers
    // Old circle layer interactions are disabled
    return

    // OLD CODE DISABLED
    this.map.on('mouseenter', this.clusterLayerName, () => {
      this.map.getCanvas().style.cursor = 'pointer'
    })

    this.map.on('mouseleave', this.clusterLayerName, () => {
      this.map.getCanvas().style.cursor = ''
    })

    this.map.on('mouseenter', this.unclusteredLayerName, () => {
      this.map.getCanvas().style.cursor = 'pointer'
    })

    this.map.on('mouseleave', this.unclusteredLayerName, () => {
      this.map.getCanvas().style.cursor = ''
    })

    // Click events with debouncing
    this.map.on('click', this.clusterLayerName, (e) => {
      const currentTime = Date.now()

      // Prevent rapid clicking / double click issues
      if (currentTime - this.lastClickTime < 300) {
        return
      }

      this.lastClickTime = currentTime

      // Clear any existing timeout
      if (this.clickTimeout) {
        clearTimeout(this.clickTimeout)
      }

      // Immediate hierarchical breakdown - no debounce delay
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: [this.clusterLayerName]
      })

      if (features.length) {
        const clusterId = features[0].properties!.id
        const cluster = this.clusters.find(c => c.id === clusterId)

        if (cluster) {
          console.log(`Cluster clicked: ${cluster.count} events - immediate breakdown`)
          this.flyToCluster(cluster)
        }
      }
    })

    this.map.on('click', this.unclusteredLayerName, (e) => {
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: [this.unclusteredLayerName]
      })

      if (features.length) {
        const event = features[0].properties!
        const coordinates = (features[0].geometry as any).coordinates
        const currentZoom = this.map.getZoom()

        // Smooth recentering and intelligent zoom
        this.flyToEvent(coordinates, currentZoom)

        // Show popup after a short delay to let the map finish moving
        setTimeout(() => {
          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
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
                <p style="margin: 0; font-weight: bold; color: ${event.isFree ? '#4ECDC4' : '#FF6B6B'};">
                  ${event.isFree ? 'Free' : `$${event.minPrice}-$${event.maxPrice}`}
                </p>
              </div>
            `)
            .addTo(this.map)
        }, 800) // Wait for fly animation to mostly complete
      }
    })
  }

  private flyToEvent(coordinates: [number, number], currentZoom: number) {
    // SIMPLE: Just center on the event - NEVER change zoom level
    this.map.flyTo({
      center: coordinates,
      zoom: currentZoom, // Keep current zoom - just recenter
      duration: 1000,
      essential: true
    })
  }

  private flyToCluster(cluster: EventCluster) {
    const coordinates = cluster.events.map(event => [event.longitude, event.latitude] as [number, number])

    if (coordinates.length === 0) return

    if (coordinates.length === 1) {
      // Single event - use individual event navigation
      this.flyToEvent(coordinates[0], this.map.getZoom())
      return
    }

    // FORCE SHOW ALL EVENTS: Create individual clusters for each event and fit bounds
    console.log(`Showing ALL ${cluster.count} events from clicked cluster`)

    // DISABLE automatic clustering interference
    this.hierarchicalMode = true

    // Create individual event clusters
    const individualEvents = cluster.events.map(event => ({
      id: `individual-${event.id}`,
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
    }))

    // Force update the map to show individual events
    this.forceUpdateLayers(individualEvents)

    // Calculate bounds to show ALL individual events
    const lngs = coordinates.map(coord => coord[0])
    const lats = coordinates.map(coord => coord[1])

    const bounds: [number, number, number, number] = [
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats)
    ]

    // Add padding
    const lngPadding = (Math.max(...lngs) - Math.min(...lngs)) * 0.2 || 0.002
    const latPadding = (Math.max(...lats) - Math.min(...lats)) * 0.2 || 0.002

    const paddedBounds: [number, number, number, number] = [
      bounds[0] - lngPadding,
      bounds[1] - latPadding,
      bounds[2] + lngPadding,
      bounds[3] + latPadding
    ]

    // Calculate proper center of all events
    const centerLng = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length
    const centerLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length

    // Calculate spread and determine zoom level that fits all events
    const lngSpread = bounds[2] - bounds[0]
    const latSpread = bounds[3] - bounds[1]
    const maxSpread = Math.max(lngSpread, latSpread)

    // SAFE SOLUTION: Use fitBounds but with zoom constraints to prevent zoom out
    console.log(`Fitting bounds to show ALL ${cluster.count} events`)

    const currentZoom = this.map.getZoom()

    this.map.fitBounds(paddedBounds, {
      padding: {
        top: 100,
        bottom: 100,
        left: 100,
        right: 100
      },
      maxZoom: Math.max(currentZoom + 1, 16), // Never zoom out, can zoom in up to 16
      minZoom: Math.max(currentZoom - 0.5, 12), // Allow slight zoom out but not below 12
      duration: 1200,
      essential: true
    })

    console.log(`fitBounds: showing ALL ${cluster.count} individual events`)

    // Keep hierarchical mode enabled for longer to prevent re-clustering
    setTimeout(() => {
      console.log('Re-enabling automatic clustering after 3 seconds')
      this.hierarchicalMode = false
    }, 3000) // 3 seconds should be enough
  }


  private breakdownClusterHierarchically(cluster: EventCluster): EventCluster[] {
    const events = cluster.events

    // Group events by category first
    const categoryGroups = new Map<string, Event[]>()
    events.forEach(event => {
      if (!categoryGroups.has(event.category)) {
        categoryGroups.set(event.category, [])
      }
      categoryGroups.get(event.category)!.push(event)
    })

    // If multiple categories, create category-based clusters
    if (categoryGroups.size > 1) {
      const subclusters: EventCluster[] = []

      categoryGroups.forEach((categoryEvents, category) => {
        if (categoryEvents.length >= 2) {
          // Create a category cluster
          const center = this.calculateCenter(categoryEvents)
          subclusters.push({
            id: `category-${category}-${categoryEvents[0].id}`,
            latitude: center.lat,
            longitude: center.lng,
            events: categoryEvents,
            category: category,
            count: categoryEvents.length,
            bounds: this.calculateBounds(categoryEvents)
          })
        } else {
          // Single event in this category
          const event = categoryEvents[0]
          subclusters.push({
            id: `individual-${event.id}`,
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
          })
        }
      })

      return subclusters
    }

    // Same category - try geographic breakdown
    if (events.length > 4) {
      return this.createGeographicSubclusters(events)
    }

    // Can't break down - return empty array to signal individual events
    return []
  }

  private createGeographicSubclusters(events: Event[]): EventCluster[] {
    // Simple geographic clustering for same-category events
    const clusters: EventCluster[] = []
    const processed = new Set<string>()

    events.forEach(event => {
      if (processed.has(event.id)) return

      const nearbyEvents = events.filter(e =>
        !processed.has(e.id) &&
        this.calculateDistance(event.latitude, event.longitude, e.latitude, e.longitude) < 1 // 1km radius
      )

      if (nearbyEvents.length >= 2) {
        nearbyEvents.forEach(e => processed.add(e.id))
        const center = this.calculateCenter(nearbyEvents)
        clusters.push({
          id: `geo-sub-${event.id}`,
          latitude: center.lat,
          longitude: center.lng,
          events: nearbyEvents,
          category: event.category,
          count: nearbyEvents.length,
          bounds: this.calculateBounds(nearbyEvents)
        })
      }
    })

    // Add any unprocessed events as individuals
    events.forEach(event => {
      if (!processed.has(event.id)) {
        clusters.push({
          id: `individual-${event.id}`,
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
        })
      }
    })

    return clusters.length > 1 ? clusters : []
  }

  private forceUpdateLayers(clusters: EventCluster[]) {
    console.log(`Force updating layers with ${clusters.length} clusters (bypassing normal system)`)

    // Directly update the map layers without triggering any clustering events
    const features = clusters.map(cluster => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [cluster.longitude, cluster.latitude]
      },
      properties: {
        id: cluster.id,
        count: cluster.count,
        category: cluster.category,
        categoryText: this.getCategoryDisplayText(cluster),
        neighborhoodName: cluster.metadata?.neighborhoodName || null,
        title: cluster.events[0]?.title,
        venue: cluster.events[0]?.venue,
        subcategory: cluster.events[0]?.subcategory,
        startTime: cluster.events[0]?.startTime,
        description: cluster.events[0]?.description,
        popularity: cluster.events[0]?.popularity || 0,
        isFree: cluster.events[0]?.price.isFree,
        minPrice: cluster.events[0]?.price.min,
        maxPrice: cluster.events[0]?.price.max
      }
    }))

    // Directly update the data source
    const source = this.map.getSource(this.sourceName) as mapboxgl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      })
    }

    // Store the clusters but don't trigger any events
    this.clusters = clusters
  }

  private getCategoryDisplayText(cluster: EventCluster): string {
    const categories = [...new Set(cluster.events.map(event => event.category))]

    // Category to emoji mapping
    const categoryEmojis: Record<string, string> = {
      'Music': '🎵',
      'Sports': '⚽',
      'Food': '🍕',
      'Arts': '🎨',
      'Technology': '💻',
      'Community': '👥',
      'Markets': '🛍️',
      'Fitness': '💪'
    }

    if (categories.length === 1) {
      // Single category - show emoji + category name
      const category = categories[0]
      const emoji = categoryEmojis[category] || '📅'
      return `${emoji} ${category}`
    } else if (categories.length <= 3) {
      // Multiple categories - show emojis
      return categories.map(cat => categoryEmojis[cat] || '📅').join(' ')
    } else {
      // Too many categories - show "Mixed"
      return '🎪 Mixed'
    }
  }

  private zoomInToShowClusters(clusters: EventCluster[]) {
    if (clusters.length === 0) return

    // Calculate center of all clusters
    const allCoordinates = clusters.flatMap(cluster =>
      cluster.events.map(event => [event.longitude, event.latitude] as [number, number])
    )

    const avgLng = allCoordinates.reduce((sum, coord) => sum + coord[0], 0) / allCoordinates.length
    const avgLat = allCoordinates.reduce((sum, coord) => sum + coord[1], 0) / allCoordinates.length

    // SIMPLE ZOOM IN - never zoom out
    const currentZoom = this.map.getZoom()
    const targetZoom = Math.min(currentZoom + 2, 16) // Zoom in 2 levels, max 16

    this.map.flyTo({
      center: [avgLng, avgLat],
      zoom: targetZoom,
      duration: 1000,
      essential: true
    })

    console.log(`Zoomed IN from ${currentZoom.toFixed(1)} to ${targetZoom} to show ${clusters.length} clusters`)
  }

  private updateLayersWithClusters(clusters: EventCluster[]) {
    // DO NOTHING - we only use HTML markers now
    // This function is kept for backwards compatibility but does nothing
    return
    const features = clusters.map(cluster => ({
      type: 'Feature' as const,
      properties: {
        id: cluster.id,
        count: cluster.count,
        category: cluster.category,
        categoryText: this.getCategoryDisplayText(cluster),
        neighborhoodName: cluster.metadata?.neighborhoodName || null,
        title: cluster.events[0]?.title,
        venue: cluster.events[0]?.venue,
        subcategory: cluster.events[0]?.subcategory,
        startTime: cluster.events[0]?.startTime,
        description: cluster.events[0]?.description,
        popularity: cluster.events[0]?.popularity || 0,
        isFree: cluster.events[0]?.price.isFree,
        minPrice: cluster.events[0]?.price.min,
        maxPrice: cluster.events[0]?.price.max
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [cluster.longitude, cluster.latitude]
      }
    }))

    const source = this.map.getSource(this.sourceName) as mapboxgl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features
      })
    }
  }

  // Custom clustering algorithms (from your original system)
  private createGeographicClusters(events?: Event[]): EventCluster[] {
    const eventsToUse = events || this.events
    const regions = this.divideIntoRegions(eventsToUse)
    return regions.map(region => {
      const center = this.calculateCenter(region.events)
      return {
        id: `geo-${region.name}`,
        latitude: center.lat,
        longitude: center.lng,
        events: region.events,
        category: this.getDominantCategory(region.events),
        count: region.events.length,
        bounds: region.bounds
      }
    }).filter(cluster => cluster.count > 0)
  }

  private createHybridClusters(events?: Event[]): EventCluster[] {
    const eventsToUse = events || this.events
    const clusters: EventCluster[] = []
    const processed = new Set<string>()

    eventsToUse.forEach(event => {
      if (processed.has(event.id)) return

      // Use scalable distance-based clustering
      const nearbyEvents = this.findNearbyEventsScalable(event, eventsToUse)

      if (nearbyEvents.length >= CLUSTERING_CONFIG.MIN_CLUSTER_DENSITY) {
        const clusterEvents = [event, ...nearbyEvents]

        // Validate cluster using scalable constraints
        if (this.shouldCreateCluster(clusterEvents)) {
          clusterEvents.forEach(e => processed.add(e.id))

          const center = this.calculateCenter(clusterEvents)
          clusters.push({
            id: `hybrid-${event.id}`,
            latitude: center.lat,
            longitude: center.lng,
            events: clusterEvents,
            category: this.getDominantCategory(clusterEvents),
            count: clusterEvents.length,
            bounds: this.calculateBounds(clusterEvents)
          })
        } else {
          // If cluster doesn't meet constraints, treat as individual events
          clusterEvents.forEach(e => processed.add(e.id))
          clusterEvents.forEach(e => {
            clusters.push({
              id: `single-${e.id}`,
              latitude: e.latitude,
              longitude: e.longitude,
              events: [e],
              category: e.category,
              count: 1,
              bounds: this.calculateBounds([e])
            })
          })
        }
      } else {
        processed.add(event.id)
        clusters.push({
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
        })
      }
    })

    return clusters
  }

  private createIndividualClusters(events?: Event[]): EventCluster[] {
    const eventsToUse = events || this.events
    return eventsToUse.map(event => ({
      id: `individual-${event.id}`,
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
    }))
  }

  // Helper methods (from your original clustering system)
  private divideIntoRegions(events?: Event[]) {
    const eventsToUse = events || this.events
    const regions = [
      {
        name: 'downtown',
        bounds: { north: 37.7956, south: 37.7749, east: -122.3944, west: -122.4194 },
        events: [] as Event[]
      },
      {
        name: 'mission',
        bounds: { north: 37.7749, south: 37.7399, east: -122.4044, west: -122.4344 },
        events: [] as Event[]
      },
      {
        name: 'richmond',
        bounds: { north: 37.7856, south: 37.7656, east: -122.4444, west: -122.5144 },
        events: [] as Event[]
      },
      {
        name: 'sunset',
        bounds: { north: 37.7656, south: 37.7356, east: -122.4444, west: -122.5144 },
        events: [] as Event[]
      },
      {
        name: 'marina',
        bounds: { north: 37.8156, south: 37.7956, east: -122.4194, west: -122.4594 },
        events: [] as Event[]
      },
      {
        name: 'castro',
        bounds: { north: 37.7699, south: 37.7499, east: -122.4244, west: -122.4444 },
        events: [] as Event[]
      }
    ]

    eventsToUse.forEach(event => {
      const region = regions.find(r =>
        event.latitude >= r.bounds.south &&
        event.latitude <= r.bounds.north &&
        event.longitude >= r.bounds.west &&
        event.longitude <= r.bounds.east
      )

      if (region) {
        region.events.push(event)
      } else {
        regions[0].events.push(event)
      }
    })

    return regions.filter(r => r.events.length > 0)
  }

  private findNearbyEvents(centerEvent: Event, radiusMeters: number, events?: Event[]): Event[] {
    const eventsToUse = events || this.events
    return eventsToUse.filter(event => {
      if (event.id === centerEvent.id) return false

      const distance = this.calculateDistance(
        centerEvent.latitude, centerEvent.longitude,
        event.latitude, event.longitude
      )

      return distance <= radiusMeters
    })
  }


  private calculateCenter(events: Event[]): { lat: number, lng: number } {
    const lat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length
    const lng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length
    return { lat, lng }
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

  getClusterAtPoint(point: mapboxgl.Point): Event[] | null {
    const features = this.map.queryRenderedFeatures(point, {
      layers: [this.clusterLayerName, this.unclusteredLayerName]
    })

    if (features.length) {
      const clusterId = features[0].properties!.id
      const cluster = this.clusters.find(c => c.id === clusterId)
      return cluster ? cluster.events : null
    }

    return null
  }

  destroy() {
    try {
      // Remove all layers in reverse order
      if (this.map.getLayer('event-icons')) this.map.removeLayer('event-icons')
      if (this.map.getLayer('event-highlight')) this.map.removeLayer('event-highlight')
      if (this.map.getLayer(this.unclusteredLayerName)) this.map.removeLayer(this.unclusteredLayerName)
      if (this.map.getLayer('event-base')) this.map.removeLayer('event-base')
      if (this.map.getLayer('event-shadow')) this.map.removeLayer('event-shadow')
      if (this.map.getLayer(this.clusterCountLayerName)) this.map.removeLayer(this.clusterCountLayerName)
      if (this.map.getLayer('cluster-highlight')) this.map.removeLayer('cluster-highlight')
      if (this.map.getLayer(this.clusterLayerName)) this.map.removeLayer(this.clusterLayerName)
      if (this.map.getLayer('cluster-base')) this.map.removeLayer('cluster-base')
      if (this.map.getLayer('cluster-shadow')) this.map.removeLayer('cluster-shadow')

      if (this.map.getSource(this.sourceName)) this.map.removeSource(this.sourceName)
    } catch (error) {
      console.warn('Error during cleanup:', error)
    }
  }
}