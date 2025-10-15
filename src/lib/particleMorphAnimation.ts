/**
 * PARTICLE MORPH RECLUSTER ANIMATION
 *
 * Dissolves event sprites into particles → morphs into clusters → reclusters map
 * with a cinematic camera flight for the Smart Overview button
 */

import mapboxgl from 'mapbox-gl'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
  targetX: number
  targetY: number
}

interface ParticleSystemOptions {
  onComplete?: () => void
  duration?: number
}

export class ParticleMorphAnimation {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private animationId: number | null = null
  private startTime: number = 0
  private duration: number = 2500
  private onComplete?: () => void

  constructor(container: HTMLElement, options: ParticleSystemOptions = {}) {
    this.duration = options.duration || 2500
    this.onComplete = options.onComplete

    // Create overlay canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '100'

    this.canvas.width = container.clientWidth
    this.canvas.height = container.clientHeight

    this.ctx = this.canvas.getContext('2d')!
    container.appendChild(this.canvas)
  }

  /**
   * Start particle morph from sprite positions to cluster centers
   */
  start(spritePositions: Array<{ x: number; y: number; color: string }>, clusterCenters: Array<{ x: number; y: number }>) {
    this.particles = []

    // Create particles for each sprite
    spritePositions.forEach((sprite, index) => {
      // Validate sprite position
      if (isNaN(sprite.x) || isNaN(sprite.y)) {
        console.warn('Invalid sprite position, skipping:', sprite)
        return
      }

      // Find nearest cluster center
      const nearestCluster = this.findNearestCluster(sprite, clusterCenters)

      // Validate cluster center - skip if invalid
      if (!nearestCluster || isNaN(nearestCluster.x) || isNaN(nearestCluster.y)) {
        console.warn('Invalid cluster center for sprite, skipping:', sprite, nearestCluster)
        return
      }

      // Create 8-12 particles per sprite
      const particleCount = 8 + Math.floor(Math.random() * 5)

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5
        const speed = 2 + Math.random() * 3

        this.particles.push({
          x: sprite.x,
          y: sprite.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: sprite.color,
          size: 2 + Math.random() * 3,
          life: 1,
          targetX: nearestCluster.x,
          targetY: nearestCluster.y
        })
      }
    })

    this.startTime = performance.now()
    this.animate()
  }

  private findNearestCluster(sprite: { x: number; y: number }, clusters: Array<{ x: number; y: number }>) {
    if (!clusters || clusters.length === 0) {
      return null
    }

    let nearest = null
    let minDist = Infinity

    clusters.forEach(cluster => {
      // Skip invalid clusters
      if (!cluster || isNaN(cluster.x) || isNaN(cluster.y)) {
        return
      }

      const dist = Math.sqrt(
        Math.pow(cluster.x - sprite.x, 2) +
        Math.pow(cluster.y - sprite.y, 2)
      )

      if (dist < minDist && !isNaN(dist)) {
        minDist = dist
        nearest = cluster
      }
    })

    return nearest
  }

  private animate = () => {
    const now = performance.now()
    const elapsed = now - this.startTime
    const progress = Math.min(elapsed / this.duration, 1)

    // Easing function (ease-in-out-cubic)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Update and draw particles
    this.particles.forEach(particle => {
      // Skip particles with invalid targets
      if (isNaN(particle.targetX) || isNaN(particle.targetY)) {
        particle.life = 0 // Fade out invalid particles
        return
      }

      // Phase 1 (0-0.3): Explode outward
      if (progress < 0.3) {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.life = 1 - (progress / 0.3) * 0.3

        // Fade out particles that go off-screen during explosion
        if (particle.x < -50 || particle.x > this.canvas.width + 50 ||
            particle.y < -50 || particle.y > this.canvas.height + 50) {
          particle.life = 0
        }
      }
      // Phase 2 (0.3-1.0): Morph toward cluster centers
      else {
        const morphProgress = (progress - 0.3) / 0.7
        const dx = particle.targetX - particle.x
        const dy = particle.targetY - particle.y

        // Smooth attraction with easing
        particle.x += dx * 0.08 * (1 + morphProgress * 2)
        particle.y += dy * 0.08 * (1 + morphProgress * 2)

        // Fade in as approaching target
        particle.life = 0.7 + morphProgress * 0.3
      }

      // Draw particle with glow
      const alpha = particle.life

      // Skip rendering if particle is dead or position is invalid
      if (alpha <= 0 || isNaN(particle.x) || isNaN(particle.y)) {
        return
      }

      // Outer glow
      const gradient = this.ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.size * 3
      )
      gradient.addColorStop(0, `${particle.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`)
      gradient.addColorStop(0.5, `${particle.color}${Math.floor(alpha * 128).toString(16).padStart(2, '0')}`)
      gradient.addColorStop(1, `${particle.color}00`)

      this.ctx.fillStyle = gradient
      this.ctx.beginPath()
      this.ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2)
      this.ctx.fill()

      // Core particle
      this.ctx.fillStyle = `${particle.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`
      this.ctx.beginPath()
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      this.ctx.fill()

      // Cyan glow trail disabled - was causing random dots
      // if (progress > 0.3) {
      //   const isTargetValid =
      //     !isNaN(particle.targetX) && !isNaN(particle.targetY) &&
      //     particle.targetX >= 0 && particle.targetX <= this.canvas.width &&
      //     particle.targetY >= 0 && particle.targetY <= this.canvas.height

      //   if (isTargetValid) {
      //     this.ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.3})`
      //     this.ctx.lineWidth = 1
      //     this.ctx.beginPath()
      //     this.ctx.moveTo(particle.x, particle.y)
      //     this.ctx.lineTo(particle.targetX, particle.targetY)
      //     this.ctx.stroke()
      //   }
      // }
    })

    // Continue animation
    if (progress < 1) {
      this.animationId = requestAnimationFrame(this.animate)
    } else {
      this.cleanup()
      this.onComplete?.()
    }
  }

  private cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // Fade out canvas
    this.canvas.style.transition = 'opacity 0.3s ease-out'
    this.canvas.style.opacity = '0'

    setTimeout(() => {
      this.canvas.remove()
    }, 300)
  }

  stop() {
    this.cleanup()
  }
}

/**
 * Perform cinematic camera flight to city overview
 */
export function performCameraFlight(
  map: mapboxgl.Map,
  targetCenter: [number, number],
  targetZoom: number,
  options: {
    duration?: number
    rotation?: number
    onComplete?: () => void
  } = {}
) {
  // Validate target center coordinates
  if (isNaN(targetCenter[0]) || isNaN(targetCenter[1])) {
    console.error('Invalid camera target coordinates:', targetCenter)
    options.onComplete?.()
    return
  }

  const duration = options.duration || 3000
  const rotation = options.rotation || 360

  // Smooth camera animation with rotation
  map.flyTo({
    center: targetCenter,
    zoom: targetZoom,
    bearing: rotation,
    pitch: 60, // Tilt for dramatic effect
    duration: duration,
    curve: 1.8, // More dramatic curve
    easing: (t) => {
      // Custom easing: ease-in-out with overshoot
      if (t < 0.5) {
        return 4 * t * t * t
      } else {
        return 1 - Math.pow(-2 * t + 2, 3) / 2
      }
    },
    essential: true
  })

  // Reset pitch after zoom completes
  setTimeout(() => {
    map.easeTo({
      pitch: 45,
      bearing: 0,
      duration: 1000
    })
    options.onComplete?.()
  }, duration)
}

/**
 * Get sprite positions from map markers
 */
export function getSpritePositionsFromMap(map: mapboxgl.Map): Array<{ x: number; y: number; color: string }> {
  const positions: Array<{ x: number; y: number; color: string }> = []

  try {
    // Get all marker elements
    const markers = document.querySelectorAll('.mapboxgl-marker')

    if (markers.length === 0) {
      console.warn('No markers found on map for particle animation')
      return positions
    }

    const mapContainer = map.getContainer()
    if (!mapContainer) {
      console.warn('Map container not found')
      return positions
    }

    const mapRect = mapContainer.getBoundingClientRect()
    if (!mapRect) {
      console.warn('Could not get map container bounding rect')
      return positions
    }

    markers.forEach(marker => {
      try {
        const rect = marker.getBoundingClientRect()

        // Validate rect has valid dimensions
        if (!rect || rect.width === 0 || rect.height === 0) {
          return // Skip this marker
        }

        // Calculate center position relative to map container
        const x = rect.left - mapRect.left + rect.width / 2
        const y = rect.top - mapRect.top + rect.height / 2

        // Validate calculated positions
        if (isNaN(x) || isNaN(y)) {
          console.warn('Invalid marker position calculated:', { x, y })
          return
        }

        // Get color from marker (if available)
        const colorElement = marker.querySelector('[style*="background"]') as HTMLElement
        const color = colorElement?.style.background?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)?.[0] || '#00d4ff'

        positions.push({
          x,
          y,
          color: color.includes('rgb') ? color : '#00d4ff'
        })
      } catch (err) {
        console.warn('Error processing marker:', err)
      }
    })

    console.log(`✨ Collected ${positions.length} sprite positions for particle animation`)
  } catch (err) {
    console.error('Error getting sprite positions:', err)
  }

  return positions
}

/**
 * Get cluster center positions for morph targets
 */
export function getClusterCenters(map: mapboxgl.Map, neighborhoods: any): Array<{ x: number; y: number }> {
  const centers: Array<{ x: number; y: number }> = []

  if (!neighborhoods?.features) {
    console.warn('No neighborhood features found')
    return centers
  }

  neighborhoods.features.forEach((feature: any, index: number) => {
    try {
      if (!feature.geometry?.coordinates) {
        console.warn(`Feature ${index} has no coordinates`)
        return
      }

      // Handle both Polygon and MultiPolygon
      let coords: number[][]

      if (feature.geometry.type === 'Polygon') {
        coords = feature.geometry.coordinates[0]
      } else if (feature.geometry.type === 'MultiPolygon') {
        // For MultiPolygon, use the first polygon's first ring
        coords = feature.geometry.coordinates[0][0]
      } else {
        console.warn(`Unsupported geometry type: ${feature.geometry.type}`)
        return
      }

      if (!coords || coords.length === 0) {
        console.warn(`Feature ${index} has empty coordinates`)
        return
      }

      // Calculate centroid - ensure we're accessing valid coordinate arrays
      let sumLng = 0
      let sumLat = 0
      let validCount = 0

      coords.forEach((coord: number[]) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const lng = coord[0]
          const lat = coord[1]

          if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
            sumLng += lng
            sumLat += lat
            validCount++
          }
        }
      })

      if (validCount === 0) {
        console.warn(`Feature ${index} has no valid coordinates`)
        return
      }

      const centerLng = sumLng / validCount
      const centerLat = sumLat / validCount

      // Validate coordinates before projecting
      if (isNaN(centerLng) || isNaN(centerLat)) {
        console.warn(`Invalid neighborhood center coordinates for feature ${index}:`, centerLng, centerLat)
        return
      }

      const point = map.project([centerLng, centerLat])

      // Validate projected point
      if (isNaN(point.x) || isNaN(point.y)) {
        console.warn(`Invalid projected point for feature ${index}:`, point)
        return
      }

      centers.push({ x: point.x, y: point.y })
    } catch (err) {
      console.warn(`Error processing neighborhood feature ${index}:`, err)
    }
  })

  console.log(`🎯 Found ${centers.length} valid cluster centers from ${neighborhoods.features.length} neighborhoods`)
  return centers
}
