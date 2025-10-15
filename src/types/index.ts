export interface Event {
  id: string
  title: string
  description: string
  venue: string
  address: string
  latitude: number
  longitude: number
  category: string
  subcategory: string
  startTime: string
  endTime: string
  price: {
    min?: number
    max?: number
    currency: string
    isFree: boolean
  }
  imageUrl?: string
  ticketUrl?: string
  tags: string[]
  popularity: number
  busyness?: {
    current: number
    forecast: number[]
  }
}

export interface EventCluster {
  id: string
  latitude: number
  longitude: number
  events: Event[]
  category?: string
  count?: number
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
  radius?: number
  isStable?: boolean
  metadata?: {
    neighborhoodName?: string
    type?: 'neighborhood' | 'neighborhood-subdivision' | 'individual'
    boundaryRadius?: number
    subcluster?: number
    totalSubclusters?: number
  }
}

export type ClusteringMode =
  | 'native'           // Mapbox native clustering
  | 'hybrid'           // Hybrid SVG clustering (your preferred)
  | 'geographic'       // Geographic distribution clustering
  | 'category'         // Category-based clustering
  | 'dynamic'          // Dynamic SVG clustering

export interface ClusteringOptions {
  mode: ClusteringMode
  maxZoom: number
  radius: number
  minPoints: number
  categoryBasedClustering: boolean
  geographicDistribution: boolean
}

export interface FilterOptions {
  categories: string[]
  subcategories: string[]
  priceRange: {
    min: number
    max: number
  }
  dateRange: {
    start: string
    end: string
  }
  radius: number
  sortBy: 'distance' | 'popularity' | 'time' | 'price'
}