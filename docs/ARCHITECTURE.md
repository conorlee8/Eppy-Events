# Eppy Architecture Documentation

## Overview

Eppy is a Next.js-based event discovery platform featuring an interactive Mapbox map with intelligent clustering, particle animations, and neighborhood-based browsing.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │   page.tsx      │  │  EventBrowser    │               │
│  │  (Main App)     │  │   Component      │               │
│  └────────┬────────┘  └────────┬─────────┘               │
│           │                    │                          │
│  ┌────────▼────────┐  ┌────────▼─────────┐               │
│  │  Mapbox GL JS   │  │ HolographicCard  │               │
│  │   (Map View)    │  │   (Detail View)  │               │
│  └────────┬────────┘  └──────────────────┘               │
│           │                                                │
│  ┌────────▼────────────────────────────────┐             │
│  │         ClusteringSystemV2              │             │
│  │  (3-tier zoom-based clustering)         │             │
│  └────────┬────────────────────────────────┘             │
│           │                                                │
│  ┌────────▼────────────────────────────────┐             │
│  │     ParticleMorphAnimation              │             │
│  │  (Canvas-based particle system)         │             │
│  └─────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │  Mock Data   │
                    │ (JSON Files) │
                    └──────────────┘
```

## Core Components

### 1. Main Application (`src/app/page.tsx`)

**Responsibilities:**
- Initialize Mapbox map
- Manage application state
- Coordinate between clustering system and UI
- Handle neighborhood polygon interactions
- Trigger particle animations

**Key State:**
```typescript
const map = useRef<mapboxgl.Map | null>(null)
const clusteringSystem = useRef<ClusteringSystemV2 | null>(null)
const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
const [selectedCluster, setSelectedCluster] = useState<Event[]>([])
const [showClusterDetails, setShowClusterDetails] = useState(false)
```

**Map Lifecycle:**
1. Initialize map on component mount
2. Load neighborhood GeoJSON data
3. Create clustering system
4. Set up event listeners
5. Clean up on unmount

### 2. Clustering System (`src/lib/clusteringV2.ts`)

**Architecture:**

```
ClusteringSystemV2
├── Private State
│   ├── map: mapboxgl.Map
│   ├── events: Event[]
│   ├── neighborhoods: NeighborhoodCollection
│   ├── markers: Map<string, mapboxgl.Marker>
│   └── declusteredNeighborhoods: Set<string>
│
├── Public Methods
│   ├── update()                    # Re-cluster based on zoom
│   ├── setEvents(events)           # Update event data
│   └── setNeighborhoods(data)      # Update neighborhood data
│
└── Private Methods
    ├── renderPopularityClusters()  # Zoom < 11
    ├── renderNeighborhoodHexagons()# Zoom 11-14
    └── renderIndividualSprites()   # Zoom 15+ or declustered
```

**Clustering Logic:**

```typescript
update() {
  const zoom = this.map.getZoom()

  // Recluster if zoomed out too far
  if (zoom < 14) {
    this.declusteredNeighborhoods.clear()
  }

  // Choose rendering mode
  if (zoom >= 15) {
    this.renderIndividualSprites(eventsInView)
  } else if (zoom >= 11) {
    this.renderNeighborhoodHexagons(eventsInView)
  } else {
    this.renderPopularityClusters(eventsInView)
  }
}
```

### 3. Particle Animation System (`src/lib/particleMorphAnimation.ts`)

**Architecture:**

```
ParticleMorphAnimation
├── Canvas Setup
│   ├── Creates fullscreen canvas overlay
│   ├── Sets up 2D rendering context
│   └── Manages canvas lifecycle
│
├── Particle Creation
│   ├── Collects sprite positions from map
│   ├── Calculates cluster centers
│   ├── Assigns nearest cluster to each sprite
│   └── Creates 8-12 particles per sprite
│
└── Animation Loop
    ├── Phase 1 (0-30%): Explosion
    │   ├── Particles move with initial velocity
    │   └── Life decreases to 70%
    │
    └── Phase 2 (30-100%): Morph
        ├── Particles smoothly move toward targets
        ├── Easing function accelerates over time
        └── Life increases back to 100%
```

**Validation Pipeline:**

```
Sprite Position Validation
  ↓
Cluster Center Validation
  ↓
Particle Creation (only if both valid)
  ↓
Runtime Validation (check for NaN/off-screen)
  ↓
Rendering (skip invalid particles)
```

### 4. EventBrowser Component

**Responsive Behavior:**

```
Desktop (≥1024px):
  ├── Fixed left sidebar
  ├── Always visible
  └── Height: 100vh

Mobile (<1024px):
  ├── Vaul drawer component
  ├── Swipe up to open
  ├── Drag handle at top
  └── Can be dismissed by swiping down
```

**Component Tree:**

```
EventBrowser
├── Desktop Mode
│   └── <div> fixed sidebar
│       ├── Header
│       ├── Event List
│       └── Footer
│
└── Mobile Mode
    └── <Drawer.Root>
        └── <Drawer.Content>
            ├── <Drawer.Title> (sr-only)
            ├── Drag Handle
            ├── Header
            ├── Event List
            └── Footer
```

## Data Flow

### Event Loading Flow

```
1. App Initialization
   ↓
2. Load Mock Events (src/data/mockEvents.json)
   ↓
3. Load Neighborhoods (public/data/neighborhoods/*.geojson)
   ↓
4. Create Clustering System
   ↓
5. Initial Render (based on zoom)
```

### User Interaction Flow

#### Clicking Neighborhood Polygon

```
1. User clicks polygon
   ↓
2. page.tsx: 'neighborhoods-fill' click event
   ↓
3. Filter events in clicked neighborhood
   ↓
4. Update EventBrowser with filtered events
   ↓
5. fitBounds to neighborhood (maxZoom: 14)
   ↓
6. Wait for 'moveend' event
   ↓
7. Add neighborhood to declusteredNeighborhoods Set
   ↓
8. Call clusteringSystem.update()
   ↓
9. renderNeighborhoodHexagons()
   ↓
10. Check if neighborhood is declustered
   ↓
11. If yes: renderIndividualSprites() for that neighborhood
```

#### Smart Overview Animation

```
1. User clicks "Smart Overview" button
   ↓
2. page.tsx: handleZoomToOverview()
   ↓
3. getSpritePositionsFromMap() - collect all visible markers
   ↓
4. getClusterCenters() - calculate neighborhood centroids
   ↓
5. Validate sprite positions and cluster centers
   ↓
6. particleAnimation.start(sprites, clusters)
   ↓
7. Create particles (8-12 per sprite)
   ↓
8. Animate in 2 phases over 2000ms
   ↓
9. Remove canvas overlay
   ↓
10. Zoom out to overview (zoom: 11.5)
```

## State Management

### Global State (React State)
- `filteredEvents`: Currently displayed events
- `selectedCluster`: Events in selected hexagon/cluster
- `showClusterDetails`: Boolean for detail modal
- `currentNeighborhood`: Name of selected neighborhood

### Clustering System State
- `markers`: Map of active Mapbox markers
- `declusteredNeighborhoods`: Set of neighborhood names showing sprites

### Map State
- Current zoom level
- Current bounds (viewport)
- Loaded GeoJSON sources and layers

## Performance Optimizations

### 1. Clustering
- Only process events in viewport
- Use zoom thresholds to determine rendering mode
- Reuse marker instances when possible
- Debounce map movement events

### 2. Particle Animation
- Validate before creating particles
- Skip rendering invalid particles
- Use requestAnimationFrame for smooth 60fps
- Remove canvas after animation completes

### 3. EventBrowser
- Virtualize long event lists (future improvement)
- Lazy load event details
- Debounce search input

## Error Handling

### Validation Points

1. **Sprite Position Collection**
   - Check if markers exist
   - Validate rect dimensions
   - Check for NaN coordinates

2. **Cluster Center Calculation**
   - Handle both Polygon and MultiPolygon
   - Validate each coordinate
   - Check for empty geometry

3. **Particle Creation**
   - Validate sprite positions
   - Validate cluster centers
   - Skip invalid combinations

4. **Animation Rendering**
   - Check particle.life > 0
   - Validate x,y coordinates
   - Skip NaN or off-screen particles

## Future Architecture Plans

### Backend Integration
```
Current: Mock Data → Frontend
Future:  PostgreSQL + PostGIS
         ↓
         REST API
         ↓
         Redis Cache
         ↓
         Frontend
```

### Real-time Updates
```
WebSocket Connection
  ↓
Event Changes
  ↓
Update Clustering System
  ↓
Re-render Affected Areas
```

### Multi-City Support
```
City Selection
  ↓
Load City-Specific Data
  ├── Neighborhoods
  ├── Events
  └── Configuration
  ↓
Initialize Map with City Center
  ↓
Use City-Specific Clustering
```

## Security Considerations

- All Mapbox tokens are public (read-only)
- No sensitive data stored client-side
- XSS prevention via React's built-in escaping
- CSP headers recommended for production

## Deployment

### Build Process
```bash
npm run build    # Creates optimized production build
npm run start    # Serves production build
```

### Environment Variables
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Required for map functionality

### Static Assets
- Mock event data
- Neighborhood GeoJSON files
- Category icons/emojis

---

Last Updated: January 14, 2025
