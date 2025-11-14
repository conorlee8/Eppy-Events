/**
 * API Route: Discover venues via BestTime API with 24-hour Supabase cache
 * POST /api/venues/discover
 * Body: { citySlug: 'austin' | 'san-francisco', forceRefresh?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchEventVenuesGrid, type BestTimeVenue } from '@/lib/besttime'
import { getCityBySlug } from '@/lib/cityDetection'
import { supabase } from '@/lib/supabase'
import { getVenuePhotoUrl, googlePlacesRateLimiter } from '@/lib/googlePlaces'

const CACHE_DURATION_HOURS = 24

export async function POST(request: NextRequest) {
  try {
    const { citySlug, forceRefresh = false } = await request.json()

    if (!citySlug) {
      return NextResponse.json(
        { error: 'citySlug is required' },
        { status: 400 }
      )
    }

    // Get city from Supabase
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('id, name, slug, lat, lng')
      .eq('slug', citySlug)
      .single()

    if (cityError || !cityData) {
      return NextResponse.json(
        { error: `City not found: ${citySlug}` },
        { status: 404 }
      )
    }

    // Check if we have cached venues (less than 1 hour old)
    if (!forceRefresh) {
      const oneHourAgo = new Date(Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000).toISOString()

      const { data: cachedVenues, error: cacheError } = await supabase
        .from('venues')
        .select('*')
        .eq('city_id', cityData.id)
        .gte('last_queried_at', oneHourAgo)

      if (!cacheError && cachedVenues && cachedVenues.length > 0) {
        console.log(`✅ Using cached venues for ${cityData.name} (${cachedVenues.length} venues)`)
        return NextResponse.json({
          city: cityData.name,
          count: cachedVenues.length,
          cached: true,
          venues: cachedVenues.map((v: any) => ({
            id: v.id,
            name: v.name,
            address: v.address,
            lat: parseFloat(v.lat),
            lng: parseFloat(v.lng),
            type: v.venue_type,
            besttime_id: v.besttime_venue_id,
            photo_url: v.photo_url, // Include cached photo URL
            last_queried_at: v.last_queried_at
          }))
        })
      }
    }

    console.log(`🔍 Discovering venues in ${cityData.name} via BestTime API...`)

    // Grid search for ~500 venues (1 slow downtown + 4 fast cardinal)
    const venues = await searchEventVenuesGrid(
      cityData.lat,
      cityData.lng
    )

    console.log(`✅ Found ${venues.length} venues from BestTime API`)

    // Store/update venues in Supabase (filter out incomplete data)
    const now = new Date().toISOString()
    const validVenues = venues.filter((v: BestTimeVenue) =>
      v.venue_lat && v.venue_lon && v.venue_id && v.venue_name
    )

    console.log(`📦 Filtered ${validVenues.length}/${venues.length} venues with valid data`)

    // Calculate scoring for prioritization
    // Formula: score = busyness × neighborhood_weight
    const scoredVenues = validVenues.map((v: BestTimeVenue) => {
      // Calculate distance from city center (simple euclidean distance)
      const latDiff = v.venue_lat - cityData.lat
      const lngDiff = v.venue_lon - cityData.lng
      const distanceFromCenter = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

      // Downtown: within ~0.015 degrees (~1.5km) = 1.5× weight
      // Other areas: 1.0× weight
      const neighborhoodWeight = distanceFromCenter < 0.015 ? 1.5 : 1.0

      // Get current hour busyness from forecast (if available)
      // BestTime forecast data structure: venue.forecast_simple[day][hour]
      let busyness = 50 // Default medium busyness

      if (v.forecast_simple && Array.isArray(v.forecast_simple)) {
        const currentDay = new Date().getDay() // 0-6
        const currentHour = new Date().getHours() // 0-23

        try {
          const dayForecast = v.forecast_simple[currentDay]
          if (dayForecast && dayForecast[currentHour]) {
            busyness = dayForecast[currentHour].intensity_nr || 50
          }
        } catch (e) {
          // Use default if forecast data is malformed
        }
      }

      const score = busyness * neighborhoodWeight

      return {
        ...v,
        busyness,
        neighborhoodWeight,
        score
      }
    })

    // Sort by score descending (show busiest/most important venues first)
    scoredVenues.sort((a, b) => b.score - a.score)

    console.log(`🎯 Scored ${scoredVenues.length} venues (top venue score: ${scoredVenues[0]?.score.toFixed(1)})`)

    const venueInserts = scoredVenues.map((v: any) => ({
      city_id: cityData.id,
      name: v.venue_name,
      address: v.venue_address || '',
      lat: v.venue_lat,
      lng: v.venue_lon,  // BestTime uses 'lon' not 'lng'
      venue_type: v.venue_type || 'UNKNOWN',
      besttime_venue_id: v.venue_id,
      is_event_venue: true,
      // busyness: v.busyness, // TODO: Add busyness column to Supabase
      last_queried_at: now,
      updated_at: now
    }))

    // Use upsert to update existing venues or insert new ones
    const { error: insertError } = await supabase
      .from('venues')
      .upsert(venueInserts, {
        onConflict: 'besttime_venue_id',
        ignoreDuplicates: false
      })

    if (insertError) {
      console.error('⚠️ Failed to cache venues in Supabase:', insertError)
      // Continue anyway, return the data from BestTime
    } else {
      console.log(`💾 Cached ${scoredVenues.length} venues in Supabase`)
    }

    // Fetch Google Places photos for venues (async, don't block response)
    console.log(`📸 Starting photo fetch for ${scoredVenues.length} venues...`)

    // Process photos in the background (first 10 venues only to avoid rate limits)
    const venuesToEnrich = scoredVenues.slice(0, 10)

    Promise.all(
      venuesToEnrich.map(async (venue: BestTimeVenue) => {
        try {
          const photoUrl = await googlePlacesRateLimiter.add(() =>
            getVenuePhotoUrl(venue.venue_name, venue.venue_lat, venue.venue_lon)
          )

          if (photoUrl) {
            // Update venue with photo URL
            await supabase
              .from('venues')
              .update({ photo_url: photoUrl })
              .eq('besttime_venue_id', venue.venue_id)
          }
        } catch (error) {
          console.error(`Failed to fetch photo for ${venue.venue_name}:`, error)
        }
      })
    ).then(() => {
      console.log(`✅ Photo enrichment complete for ${venuesToEnrich.length} venues`)
    }).catch(error => {
      console.error('⚠️ Photo enrichment error:', error)
    })

    return NextResponse.json({
      city: cityData.name,
      count: scoredVenues.length,
      cached: false,
      venues: scoredVenues.map((v: any) => ({
        name: v.venue_name,
        address: v.venue_address,
        lat: v.venue_lat,
        lng: v.venue_lon,  // BestTime uses 'lon' not 'lng'
        type: v.venue_type,
        besttime_id: v.venue_id,
        busyness: v.busyness, // Include busyness score in response
        photo_url: null // Photos will be available on next request after background processing
      }))
    })
  } catch (error: any) {
    console.error('❌ Venue discovery error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to discover venues' },
      { status: 500 }
    )
  }
}
