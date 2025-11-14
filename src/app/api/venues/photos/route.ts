/**
 * API Route: Fetch venue photos from Google Places API
 * POST /api/venues/photos
 * Body: { venues: [{ name, lat, lng, besttime_id }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getVenuePhotoUrl, googlePlacesRateLimiter } from '@/lib/googlePlaces'
import { supabase } from '@/lib/supabase'

interface VenuePhotoRequest {
  name: string
  lat: number
  lng: number
  besttime_id: string
}

interface VenuePhotoResult {
  besttime_id: string
  name: string
  photo_url: string | null
  success: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { venues } = await request.json() as { venues: VenuePhotoRequest[] }

    if (!venues || !Array.isArray(venues)) {
      return NextResponse.json(
        { error: 'venues array is required' },
        { status: 400 }
      )
    }

    console.log(`📸 Fetching photos for ${venues.length} venues...`)

    // Process venues with rate limiting
    const results: VenuePhotoResult[] = []

    for (const venue of venues) {
      try {
        // Use rate limiter to avoid hitting API limits
        const photoUrl = await googlePlacesRateLimiter.add(() =>
          getVenuePhotoUrl(venue.name, venue.lat, venue.lng)
        )

        results.push({
          besttime_id: venue.besttime_id,
          name: venue.name,
          photo_url: photoUrl,
          success: photoUrl !== null
        })

        // Update venue in Supabase if photo found
        if (photoUrl) {
          const { error: updateError } = await supabase
            .from('venues')
            .update({
              photo_url: photoUrl,
              updated_at: new Date().toISOString()
            })
            .eq('besttime_venue_id', venue.besttime_id)

          if (updateError) {
            console.error(`⚠️  Failed to update photo for ${venue.name}:`, updateError)
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching photo for ${venue.name}:`, error)
        results.push({
          besttime_id: venue.besttime_id,
          name: venue.name,
          photo_url: null,
          success: false
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`✅ Successfully fetched ${successCount}/${venues.length} venue photos`)

    return NextResponse.json({
      success: true,
      count: venues.length,
      photos_found: successCount,
      results
    })
  } catch (error: any) {
    console.error('❌ Venue photos error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch venue photos' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check photo status for venues
 * GET /api/venues/photos?city_id=1
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cityId = searchParams.get('city_id')

    if (!cityId) {
      return NextResponse.json(
        { error: 'city_id query parameter is required' },
        { status: 400 }
      )
    }

    // Get venues with and without photos
    const { data: venues, error } = await supabase
      .from('venues')
      .select('id, name, besttime_venue_id, photo_url')
      .eq('city_id', cityId)

    if (error) {
      throw error
    }

    const withPhotos = venues?.filter(v => v.photo_url) || []
    const withoutPhotos = venues?.filter(v => !v.photo_url) || []

    return NextResponse.json({
      total: venues?.length || 0,
      with_photos: withPhotos.length,
      without_photos: withoutPhotos.length,
      venues: venues
    })
  } catch (error: any) {
    console.error('❌ Error getting photo status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get photo status' },
      { status: 500 }
    )
  }
}
