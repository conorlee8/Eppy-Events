import mapboxgl from 'mapbox-gl'
import type { Event, ClusteringMode } from '@/types'

export class NativeClusteringSystem {
  private map: mapboxgl.Map
  private events: Event[] = []
  private mode: ClusteringMode = 'hybrid'
  private sourceName = 'events'
  private clusterLayerName = 'clusters'
  private clusterCountLayerName = 'cluster-count'
  private unclusteredLayerName = 'unclustered-point'

  constructor(map: mapboxgl.Map, events: Event[]) {
    this.map = map
    this.events = events
  }

  initialize() {
    this.setupSource()
    this.setupLayers()
    this.setupInteractions()
  }

  updateEvents(events: Event[]) {
    this.events = events
    this.updateSource()
  }

  setClusteringMode(mode: ClusteringMode) {
    this.mode = mode
    this.updateSource()
  }

  private setupSource() {
    // Remove existing source if it exists
    if (this.map.getSource(this.sourceName)) {
      this.map.removeSource(this.sourceName)
    }

    const geojsonData = this.createGeoJSONFromEvents()

    this.map.addSource(this.sourceName, {
      type: 'geojson',
      data: geojsonData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
      clusterProperties: {
        // Calculate dominant category for each cluster
        'dominant_category': [
          'case',
          ['>', ['get', 'Music'], ['get', 'Sports']], 'Music',
          ['>', ['get', 'Sports'], ['get', 'Food']], 'Sports',
          ['>', ['get', 'Food'], ['get', 'Arts']], 'Food',
          ['>', ['get', 'Arts'], ['get', 'Technology']], 'Arts',
          ['>', ['get', 'Technology'], ['get', 'Community']], 'Technology',
          ['>', ['get', 'Community'], ['get', 'Markets']], 'Community',
          ['>', ['get', 'Markets'], ['get', 'Fitness']], 'Markets',
          'Fitness'
        ]
      }
    })
  }

  private setupLayers() {
    // Clusters layer
    this.map.addLayer({
      id: this.clusterLayerName,
      type: 'circle',
      source: this.sourceName,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'dominant_category'], 'Music'], '#FF6B6B',
          ['==', ['get', 'dominant_category'], 'Sports'], '#4ECDC4',
          ['==', ['get', 'dominant_category'], 'Food'], '#45B7D1',
          ['==', ['get', 'dominant_category'], 'Arts'], '#96CEB4',
          ['==', ['get', 'dominant_category'], 'Technology'], '#FECA57',
          ['==', ['get', 'dominant_category'], 'Community'], '#FF9FF3',
          ['==', ['get', 'dominant_category'], 'Markets'], '#54A0FF',
          ['==', ['get', 'dominant_category'], 'Fitness'], '#5F27CD',
          '#6C5CE7'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20, // base size
          5, 25,
          10, 30,
          20, 35,
          50, 40
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    })

    // Cluster count labels
    this.map.addLayer({
      id: this.clusterCountLayerName,
      type: 'symbol',
      source: this.sourceName,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': [
          'step',
          ['get', 'point_count'],
          12,
          10, 14,
          20, 16
        ]
      },
      paint: {
        'text-color': '#ffffff'
      }
    })

    // Individual points (unclustered)
    this.map.addLayer({
      id: this.unclusteredLayerName,
      type: 'circle',
      source: this.sourceName,
      filter: ['!', ['has', 'point_count']],
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

    // Add category icons for individual points
    this.map.addLayer({
      id: 'unclustered-icons',
      type: 'symbol',
      source: this.sourceName,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': [
          'case',
          ['==', ['get', 'category'], 'Music'], '🎵',
          ['==', ['get', 'category'], 'Sports'], '⚽',
          ['==', ['get', 'category'], 'Food'], '🍽️',
          ['==', ['get', 'category'], 'Arts'], '🎨',
          ['==', ['get', 'category'], 'Technology'], '💻',
          ['==', ['get', 'category'], 'Community'], '👥',
          ['==', ['get', 'category'], 'Markets'], '🛒',
          ['==', ['get', 'category'], 'Fitness'], '💪',
          '📍'
        ],
        'text-size': 12,
        'text-allow-overlap': true
      }
    })
  }

  private setupInteractions() {
    // Change cursor on hover
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

    // Cluster click - zoom in
    this.map.on('click', this.clusterLayerName, (e) => {
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: [this.clusterLayerName]
      })

      if (!features.length) return

      const clusterId = features[0].properties!.cluster_id
      const source = this.map.getSource(this.sourceName) as mapboxgl.GeoJSONSource

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return

        this.map.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom: zoom,
          duration: 1000
        })
      })
    })

    // Individual point click
    this.map.on('click', this.unclusteredLayerName, (e) => {
      const event = e.features![0].properties

      // Create popup
      new mapboxgl.Popup()
        .setLngLat((e.features![0].geometry as any).coordinates)
        .setHTML(`
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">${event!.title}</h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">
              <strong>📍 ${event!.venue}</strong>
            </p>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">
              ${event!.subcategory} • ${new Date(event!.startTime).toLocaleDateString()}
            </p>
            <p style="margin: 0 0 8px 0; color: #333; font-size: 12px;">
              ${event!.description}
            </p>
            <p style="margin: 0; font-weight: bold; color: ${event!.isFree ? '#4ECDC4' : '#FF6B6B'};">
              ${event!.isFree ? 'Free' : `$${event!.minPrice}-$${event!.maxPrice}`}
            </p>
          </div>
        `)
        .addTo(this.map)
    })
  }

  private updateSource() {
    const source = this.map.getSource(this.sourceName) as mapboxgl.GeoJSONSource
    if (source) {
      const geojsonData = this.createGeoJSONFromEvents()
      source.setData(geojsonData)
    }
  }

  private createGeoJSONFromEvents() {
    const features = this.events.map(event => ({
      type: 'Feature' as const,
      properties: {
        id: event.id,
        title: event.title,
        description: event.description,
        venue: event.venue,
        category: event.category,
        subcategory: event.subcategory,
        startTime: event.startTime,
        endTime: event.endTime,
        popularity: event.popularity,
        isFree: event.price.isFree,
        minPrice: event.price.min,
        maxPrice: event.price.max,
        // Category counters for cluster aggregation
        Music: event.category === 'Music' ? 1 : 0,
        Sports: event.category === 'Sports' ? 1 : 0,
        Food: event.category === 'Food' ? 1 : 0,
        Arts: event.category === 'Arts' ? 1 : 0,
        Technology: event.category === 'Technology' ? 1 : 0,
        Community: event.category === 'Community' ? 1 : 0,
        Markets: event.category === 'Markets' ? 1 : 0,
        Fitness: event.category === 'Fitness' ? 1 : 0
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [event.longitude, event.latitude]
      }
    }))

    return {
      type: 'FeatureCollection' as const,
      features
    }
  }

  // Clean up method
  destroy() {
    try {
      // Remove layers
      if (this.map.getLayer('unclustered-icons')) this.map.removeLayer('unclustered-icons')
      if (this.map.getLayer(this.unclusteredLayerName)) this.map.removeLayer(this.unclusteredLayerName)
      if (this.map.getLayer(this.clusterCountLayerName)) this.map.removeLayer(this.clusterCountLayerName)
      if (this.map.getLayer(this.clusterLayerName)) this.map.removeLayer(this.clusterLayerName)

      // Remove source
      if (this.map.getSource(this.sourceName)) this.map.removeSource(this.sourceName)
    } catch (error) {
      console.warn('Error during cleanup:', error)
    }
  }
}