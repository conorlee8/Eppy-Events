/**
 * SIMPLE neighborhood decluster system
 * Click neighborhood -> Show all events as individual markers
 */

import type { Event, EventCluster } from '@/types'
import mapboxgl from 'mapbox-gl'

export class SimpleNeighborhoodClickHandler {
  private map: mapboxgl.Map
  private markers: Map<string, mapboxgl.Marker> = new Map()
  private declusteredNeighborhoods: Set<string> = new Set()

  constructor(map: mapboxgl.Map) {
    this.map = map
  }

  /**
   * Add click handler to a neighborhood marker element
   */
  addClickHandler(
    element: HTMLElement,
    cluster: EventCluster,
    onDecluster: () => void
  ) {
    element.addEventListener('click', (e) => {
      e.stopPropagation()

      const neighborhoodName = cluster.metadata?.neighborhoodName
      if (!neighborhoodName) return

      console.log(`🎯 Clicked: ${neighborhoodName}`)

      // Mark as declustered
      this.declusteredNeighborhoods.add(neighborhoodName)

      // Calculate bounds
      const lngs = cluster.events.map(e => e.longitude)
      const lats = cluster.events.map(e => e.latitude)
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      )

      // Zoom in
      this.map.fitBounds(bounds, {
        padding: 100,
        duration: 1500,
        maxZoom: 16
      })

      // Trigger re-render
      onDecluster()
    })
  }

  /**
   * Check if neighborhood should show individual events
   */
  isDeclustered(neighborhoodName: string): boolean {
    return this.declusteredNeighborhoods.has(neighborhoodName)
  }

  /**
   * Clear declustered state
   */
  reset() {
    this.declusteredNeighborhoods.clear()
  }
}
