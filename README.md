# Eppy - Event Discovery Platform

A beautiful, interactive map-based event discovery platform for San Francisco. Explore local events with intelligent clustering, animated visualizations, and neighborhood-based browsing.

![Eppy Screenshot](docs/screenshot.png)

## Features

### 🗺️ Interactive Map
- **Mapbox GL JS** powered interactive map with smooth animations
- **3-tier clustering system**:
  - Zoom 0-10: Popularity heat clusters (size-based event grouping)
  - Zoom 11-14: Neighborhood hexagons (one per neighborhood)
  - Zoom 15+: Individual event sprites

### ✨ Smart Overview Animation
- Click "Smart Overview" to trigger a stunning particle burst animation
- Events dissolve into particles that morph toward neighborhood clusters
- Canvas-based animation with physics simulation
- Particles validate targets to prevent visual artifacts

### 🏘️ Neighborhood Declustering
- Click any neighborhood polygon to zoom in and decluster
- Individual event sprites appear for detailed browsing
- Smooth transitions with event-driven timing
- Persistent declustered state until zoom out

### 🎨 Beautiful UI
- Modern gradient design with glassmorphism effects
- Responsive mobile interface with drawer navigation
- Dark/light mode support
- Smooth animations throughout

### 🔍 Event Browsing
- **EventBrowser** with desktop sidebar and mobile drawer
- Filter and search events
- Click events to see holographic detail cards
- Beautiful category-based color coding

## Tech Stack

- **Next.js 15.5.4** with Turbopack
- **React 18** with TypeScript
- **Mapbox GL JS** for mapping
- **Tailwind CSS** for styling
- **Vaul** for mobile drawer component
- **Canvas API** for particle animations

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Mapbox API token (get one at [mapbox.com](https://mapbox.com))

### Installation

1. Clone the repository
```bash
git clone https://github.com/conorlee8/Eppy-Events.git
cd Eppy-Events/eppy
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
# Create .env.local file
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
eppy/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── page.tsx           # Main application page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── EventBrowser.tsx   # Event list sidebar/drawer
│   │   ├── HolographicEventCard.tsx  # Event detail modal
│   │   └── MapControls.tsx    # Map control buttons
│   ├── lib/                   # Core libraries
│   │   ├── clusteringV2.ts   # 3-tier clustering system
│   │   ├── particleMorphAnimation.ts  # Particle animation
│   │   └── geoUtils.ts       # Geographic utilities
│   └── types/                # TypeScript definitions
├── public/
│   └── data/
│       └── neighborhoods/    # GeoJSON neighborhood data
└── scripts/
    └── generateMockEvents.ts # Mock data generator
```

## Key Features Explained

### Clustering System

The clustering system (`src/lib/clusteringV2.ts`) implements three zoom-based levels:

1. **Popularity Clusters (zoom < 11)**: Groups events by popularity and proximity
2. **Neighborhood Hexagons (zoom 11-14)**: One hexagon per neighborhood with event count
3. **Individual Sprites (zoom 15+)**: Shows each event as a separate icon

### Particle Animation

The particle morph animation (`src/lib/particleMorphAnimation.ts`) creates a stunning visual effect:

1. Collects sprite positions from visible map markers
2. Calculates neighborhood cluster centers
3. Creates 8-12 particles per sprite
4. Animates particles in two phases:
   - **Phase 1 (0-30%)**: Explosion outward with random velocities
   - **Phase 2 (30-100%)**: Smooth morphing toward cluster centers
5. Validates all positions to prevent visual artifacts

### Neighborhood Declustering

When you click a neighborhood polygon:

1. Map zooms to fit the neighborhood bounds (maxZoom: 14)
2. Neighborhood is added to `declusteredNeighborhoods` Set
3. Uses `map.once('moveend')` to wait for zoom completion
4. Calls `update()` to re-render with individual sprites
5. Only that neighborhood shows sprites; others remain hexagons

## Mock Data

The application uses generated mock data for development. To regenerate:

```bash
npm run generate-mock-data
```

This creates realistic events across San Francisco neighborhoods with:
- Various categories (music, food, arts, sports, etc.)
- Pricing ranges
- Time-based distribution
- Geographic accuracy

## Configuration

### Environment Variables

- `NEXT_PUBLIC_MAPBOX_TOKEN` - Your Mapbox access token (required)

### Map Settings

Default map center and zoom can be adjusted in `src/app/page.tsx`:

```typescript
map.current = new mapboxgl.Map({
  container: mapContainer.current,
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-122.4194, 37.7749],  // San Francisco
  zoom: 12,
  // ...
})
```

## Known Issues & Future Improvements

### Current Issues
- HolographicEventCard has parsing warnings (functionally works)
- Particle animation may show brief artifacts on slow devices
- Mobile drawer accessibility improvements needed

### Planned Features
- [ ] Backend API with PostgreSQL + PostGIS
- [ ] Real event data integration (PredictHQ, Eventbrite)
- [ ] User authentication and favorites
- [ ] Real-time venue busyness (BestTime API)
- [ ] Progressive Web App (PWA) support
- [ ] Event search and filtering
- [ ] Social sharing
- [ ] Multi-city support (Austin, NYC, etc.)

## Documentation

- [CHANGELOG.md](CHANGELOG.md) - Version history and fixes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture details
- [docs/PARTICLE_ANIMATION.md](docs/PARTICLE_ANIMATION.md) - Animation system deep dive
- [docs/CLUSTERING.md](docs/CLUSTERING.md) - Clustering algorithm explanation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Credits

- Built with [Next.js](https://nextjs.org)
- Maps powered by [Mapbox](https://mapbox.com)
- Icons from emoji and category system
- San Francisco neighborhood data from SF Open Data

## Contact

For questions or feedback, please open an issue on GitHub.

---

**Made with ❤️ for discovering amazing local events**
