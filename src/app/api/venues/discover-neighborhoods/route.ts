/**
 * Per-neighborhood venue discovery endpoint
 * Ensures every neighborhood gets venue coverage
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchEventVenues } from '@/lib/besttime'
import { getVenuePhotoUrl, GooglePlacesRateLimiter } from '@/lib/googlePlaces'
import { loadNeighborhoods, getNeighborhoodCentroids } from '@/lib/neighborhoods'

const googlePlacesRateLimiter = new GooglePlacesRateLimiter()

interface BestTimeVenue {
  venue_id: string
  venue_name: string
  venue_address: string
  venue_lat: number
  venue_lon: number
  venue_type: string
  venue_types?: string[]
  day_raw?: any
}

export async function POST(request: Request) {
  try {
    const { citySlug } = await request.json()

    if (!citySlug) {
      return NextResponse.json(
        { error: 'City slug is required' },
        { status: 400 }
      )
    }

    console.log(`🏘️  Starting per-neighborhood venue discovery for: ${citySlug}`)

    // First, check if we already have cached venues for this city
    const { data: existingVenues, error: checkError } = await supabase
      .from('venues')
      .select('*')
      .eq('city_slug', citySlug)

    if (!checkError && existingVenues && existingVenues.length > 0) {
      console.log(`✅ Using cached venues for ${citySlug} (${existingVenues.length} venues)`)
      return NextResponse.json({
        success: true,
        venues: existingVenues,
        count: existingVenues.length,
        neighborhoods: { total: 0, successful: 0, failed: 0 },
        cached: true,
        photosEnriching: false
      })
    }

    console.log(`🔍 No cached venues found, fetching from BestTime API...`)

    // Load neighborhood data
    const neighborhoods = await loadNeighborhoods(citySlug)
    const centroids = getNeighborhoodCentroids(neighborhoods)

    console.log(`📍 Found ${centroids.length} neighborhoods to search`)

    // Track all venues from all neighborhoods
    const allVenues: BestTimeVenue[] = []
    const venueIds = new Set<string>() // Deduplicate

    // Fetch venues for each neighborhood
    let successfulFetches = 0
    let failedFetches = 0

    for (const [index, centroid] of centroids.entries()) {
      try {
        console.log(`🔍 [${index + 1}/${centroids.length}] Fetching venues for: ${centroid.name}`)

        const venues = await searchEventVenues(
          centroid.lat,
          centroid.lng,
          1000, // 1km radius per neighborhood
          30    // 30 venues per neighborhood
        )

        // Deduplicate venues
        let newVenuesCount = 0
        for (const venue of venues) {
          if (!venueIds.has(venue.venue_id)) {
            venueIds.add(venue.venue_id)
            allVenues.push(venue)
            newVenuesCount++
          }
        }

        console.log(`   ✅ ${centroid.name}: Found ${newVenuesCount} new venues (${venues.length} total)`)
        successfulFetches++

        // Rate limiting: wait 500ms between requests
        if (index < centroids.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (error) {
        console.error(`   ❌ ${centroid.name}: Failed to fetch venues:`, error)
        failedFetches++
      }
    }

    console.log(`\n📊 Discovery complete:`)
    console.log(`   Total neighborhoods: ${centroids.length}`)
    console.log(`   Successful: ${successfulFetches}`)
    console.log(`   Failed: ${failedFetches}`)
    console.log(`   Total unique venues: ${allVenues.length}`)

    if (allVenues.length === 0) {
      return NextResponse.json({
        success: true,
        venues: [],
        count: 0,
        neighborhoods: centroids.length,
        message: 'No venues found in any neighborhood'
      })
    }

    // Filter valid venues
    const validVenues = allVenues.filter(
      v => v.venue_id && v.venue_name && v.venue_lat && v.venue_lon
    )

    console.log(`📦 Filtered ${validVenues.length}/${allVenues.length} venues with valid data`)

    // Cache venues in Supabase
    const venuesToCache = validVenues.map(v => ({
      besttime_venue_id: v.venue_id,
      name: v.venue_name,
      address: v.venue_address || '',
      lat: v.venue_lat,
      lng: v.venue_lon,
      type: v.venue_type || 'UNKNOWN',
      types: v.venue_types || [],
      city_slug: citySlug,
      raw_data: v.day_raw || {},
      last_updated: new Date().toISOString()
    }))

    const { error: cacheError } = await supabase
      .from('venues')
      .upsert(venuesToCache, {
        onConflict: 'besttime_venue_id',
        ignoreDuplicates: false
      })

    if (cacheError) {
      console.error('❌ Failed to cache venues:', cacheError)
    } else {
      console.log(`💾 Cached ${venuesToCache.length} venues in Supabase`)
    }

    // Fetch photos for first 20 venues (to avoid rate limits)
    console.log(`📸 Starting photo fetch for ${Math.min(20, validVenues.length)} venues...`)

    const venuesToEnrich = validVenues.slice(0, 20)
    let photosFound = 0

    Promise.all(
      venuesToEnrich.map(async (venue: BestTimeVenue) => {
        try {
          const photoUrl = await googlePlacesRateLimiter.add(() =>
            getVenuePhotoUrl(venue.venue_name, venue.venue_lat, venue.venue_lon)
          )

          if (photoUrl) {
            await supabase
              .from('venues')
              .update({ photo_url: photoUrl })
              .eq('besttime_venue_id', venue.venue_id)

            photosFound++
            console.log(`✅ Found photo for: ${venue.venue_name}`)
          }
        } catch (error) {
          console.error(`Failed to fetch photo for ${venue.venue_name}:`, error)
        }
      })
    ).then(() => {
      console.log(`✅ Photo enrichment complete: ${photosFound}/${venuesToEnrich.length} photos found`)
    }).catch(error => {
      console.error('⚠️  Photo enrichment error:', error)
    })

    // Return venues immediately (photos will load in background)
    return NextResponse.json({
      success: true,
      venues: validVenues,
      count: validVenues.length,
      neighborhoods: {
        total: centroids.length,
        successful: successfulFetches,
        failed: failedFetches
      },
      cached: true,
      photosEnriching: true
    })

  } catch (error: any) {
    console.error('❌ Per-neighborhood discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to discover venues', details: error.message },
      { status: 500 }
    )
  }
}
