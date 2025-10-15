#!/usr/bin/env node

/**
 * Fetch neighborhood boundaries from Overpass API (OpenStreetMap)
 * This script downloads GeoJSON polygon data for neighborhoods worldwide
 *
 * Usage:
 *   node scripts/fetchNeighborhoods.js [city] [state/country]
 *
 * Examples:
 *   node scripts/fetchNeighborhoods.js "San Francisco" "California"
 *   node scripts/fetchNeighborhoods.js "New York" "New York"
 *   node scripts/fetchNeighborhoods.js "Austin" "Texas"
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

// City configurations - can be expanded for nationwide/worldwide
const CITY_CONFIGS = {
  'san-francisco': {
    name: 'San Francisco',
    state: 'California',
    country: 'USA',
    // Bounding box: [south, west, north, east]
    bbox: [37.7, -122.52, 37.83, -122.35],
    adminLevel: 10, // SF uses admin_level 10 for neighborhoods
  },
  'austin': {
    name: 'Austin',
    state: 'Texas',
    country: 'USA',
    bbox: [30.1, -97.95, 30.5, -97.55],
    adminLevel: 10,
  },
  'new-york': {
    name: 'New York',
    state: 'New York',
    country: 'USA',
    bbox: [40.5, -74.3, 40.92, -73.7],
    adminLevel: 9, // NYC uses different admin levels
  }
}

/**
 * Build Overpass QL query for neighborhood boundaries
 */
function buildOverpassQuery(cityConfig) {
  const { bbox, adminLevel } = cityConfig
  const [south, west, north, east] = bbox

  // Overpass QL query to get neighborhood boundaries
  const query = `
    [out:json][timeout:60];
    (
      // Get administrative boundaries at neighborhood level
      relation["boundary"="administrative"]["admin_level"="${adminLevel}"](${south},${west},${north},${east});

      // Also get suburb/neighbourhood tagged areas
      relation["place"="suburb"](${south},${west},${north},${east});
      relation["place"="neighbourhood"](${south},${west},${north},${east});
    );
    out geom;
  `.trim()

  return query
}

/**
 * Fetch data from Overpass API
 */
function fetchFromOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(query)}`

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    console.log('🌍 Fetching neighborhood data from Overpass API...')
    console.log('⏳ This may take 10-30 seconds...')

    const req = https.request(OVERPASS_API, options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (err) {
            reject(new Error(`Failed to parse JSON: ${err.message}`))
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Convert Overpass JSON to GeoJSON
 */
function convertToGeoJSON(overpassData) {
  const features = []

  overpassData.elements.forEach((element) => {
    if (element.type === 'relation' && element.members) {
      // Extract polygon coordinates from relation members
      const coordinates = []
      const ways = {}

      // First pass: collect all ways
      element.members.forEach((member) => {
        if (member.type === 'way' && member.geometry) {
          ways[member.ref] = member.geometry.map(node => [node.lon, node.lat])
        }
      })

      // Second pass: build outer rings
      element.members.forEach((member) => {
        if (member.role === 'outer' && ways[member.ref]) {
          coordinates.push(ways[member.ref])
        }
      })

      // Skip if no valid geometry
      if (coordinates.length === 0) return

      const feature = {
        type: 'Feature',
        properties: {
          id: element.id,
          name: element.tags?.name || 'Unnamed',
          adminLevel: element.tags?.admin_level,
          type: element.tags?.place || element.tags?.boundary,
          ...element.tags
        },
        geometry: {
          type: coordinates.length === 1 ? 'Polygon' : 'MultiPolygon',
          coordinates: coordinates.length === 1 ? coordinates : [coordinates]
        }
      }

      features.push(feature)
    }
  })

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      generated: new Date().toISOString(),
      source: 'OpenStreetMap via Overpass API',
      license: 'ODbL',
      count: features.length
    }
  }
}

/**
 * Save GeoJSON to file
 */
function saveGeoJSON(geojson, citySlug) {
  const outputDir = path.join(__dirname, '..', 'public', 'data', 'neighborhoods')
  const outputFile = path.join(outputDir, `${citySlug}.geojson`)

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2))

  return outputFile
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const citySlug = args[0] || 'san-francisco'

  const cityConfig = CITY_CONFIGS[citySlug]

  if (!cityConfig) {
    console.error(`❌ Unknown city: ${citySlug}`)
    console.log('\n📋 Available cities:')
    Object.keys(CITY_CONFIGS).forEach(slug => {
      const config = CITY_CONFIGS[slug]
      console.log(`   - ${slug} (${config.name}, ${config.state})`)
    })
    process.exit(1)
  }

  console.log(`\n🏙️  Fetching neighborhoods for: ${cityConfig.name}, ${cityConfig.state}`)
  console.log(`📍 Bounding box: ${cityConfig.bbox.join(', ')}`)
  console.log(`🏛️  Admin level: ${cityConfig.adminLevel}\n`)

  try {
    // Build and execute query
    const query = buildOverpassQuery(cityConfig)
    const overpassData = await fetchFromOverpass(query)

    console.log(`✅ Received ${overpassData.elements.length} elements from Overpass API`)

    // Convert to GeoJSON
    const geojson = convertToGeoJSON(overpassData)

    console.log(`🗺️  Converted to ${geojson.features.length} neighborhood features`)

    // Save to file
    const outputFile = saveGeoJSON(geojson, citySlug)

    console.log(`\n💾 Saved to: ${outputFile}`)
    console.log(`📊 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`)

    // Print neighborhood names
    console.log('\n📝 Neighborhoods found:')
    geojson.features
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
      .forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature.properties.name}`)
      })

    console.log('\n✨ Done! You can now use this data in your application.\n')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { CITY_CONFIGS, buildOverpassQuery, convertToGeoJSON }
