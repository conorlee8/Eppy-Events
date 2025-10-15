# Changelog

All notable changes to the Eppy Events project will be documented in this file.

## [Unreleased] - 2025-01-14

### Added
- **3-Tier Clustering System**: Intelligent event clustering based on zoom level
  - Zoom 0-10: Popularity heat clusters
  - Zoom 11-14: Neighborhood hexagons
  - Zoom 15+: Individual event sprites
- **Particle Morph Animation**: Stunning "Smart Overview" button effect
  - Canvas-based particle system with physics
  - Two-phase animation (explosion + morphing)
  - Comprehensive validation to prevent visual artifacts
- **Neighborhood Declustering**: Click polygons to see individual events
  - Event-driven zoom completion detection
  - Persistent declustered state
  - Smooth transitions and animations
- **EventBrowser Component**: Responsive event list
  - Desktop: Fixed left sidebar
  - Mobile: Swipe-up drawer with Vaul
  - Search and filter functionality
- **HolographicEventCard**: Beautiful event detail modal
  - Glassmorphism effects
  - Category-based color coding
  - Animated entry/exit transitions
- **MapControls**: Clustering settings and Smart Overview button
  - Toggle clustering on/off
  - Trigger particle animation
  - Responsive stacked layout on mobile
- **Mock Data Generator**: Creates realistic SF events
  - Multiple categories (music, food, arts, sports, etc.)
  - Geographic accuracy across neighborhoods
  - Price ranges and time distribution
- **San Francisco Neighborhood Data**: GeoJSON boundary data
  - 36 neighborhoods with accurate polygons
  - Used for clustering and geographic queries

### Fixed
- **Declustering Bug**: Fixed neighborhoods not declustering on click
  - Changed `maxZoom: 16` to `maxZoom: 14` to stay in declustering range
  - Zoom 15+ bypasses declustering logic and shows all sprites
- **Particle Animation Artifacts**: Eliminated random blue/cyan dots
  - Added comprehensive validation for sprite positions
  - Filter out invalid cluster centers before creating particles
  - Skip particles with NaN or off-screen target coordinates
  - Fade out particles that explode beyond canvas bounds
  - Disabled cyan glow trails that caused visual noise
- **Mobile Button Overlap**: Fixed Smart Overview and Clustering buttons
  - Changed from horizontal to vertical stack on mobile
  - Used `flex-col lg:flex-row` for responsive layout
- **Vaul Drawer Accessibility**: Fixed DialogTitle requirement
  - Added screen-reader-only title to EventBrowser drawer
  - Resolved console warning about accessibility
- **HolographicEventCard Parsing**: Fixed style tag syntax
  - Changed from `></style>` to ` />` for self-closing tag
  - Eliminated Turbopack parsing errors

### Technical Improvements
- **Event-Driven Zoom Detection**: Replaced `setTimeout` with `map.once('moveend')`
  - More reliable declustering timing
  - Prevents race conditions
- **Comprehensive Validation**: Added checks throughout particle system
  - Validate sprite positions before particle creation
  - Check cluster center validity
  - Skip invalid particles in animation loop
  - Prevent NaN coordinates in rendering
- **Debug Logging**: Added detailed console logs for troubleshooting
  - Declustering state tracking
  - Particle creation/validation
  - Neighborhood grouping
  - Cluster center calculation

### Known Issues
- HolographicEventCard shows cached parsing warnings but functions correctly
- Particle animation may briefly show artifacts on very slow devices
- Mobile drawer needs additional accessibility improvements

## Project Initialization

### Added
- Next.js 15.5.4 with Turbopack
- TypeScript configuration
- Tailwind CSS setup
- Mapbox GL JS integration
- Basic project structure

---

## Version History Format

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Types of changes
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities
