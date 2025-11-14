/**
 * Heatmap data endpoint
 * Provides both venue density and live foot-traffic heatmap data
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const citySlug = searchParams.get('citySlug')
    const mode = searchParams.get('mode') || 'density' // 'density' or 'foottraffic'

    if (!citySlug) {
      return NextResponse.json(
        { error: 'citySlug is required' },
        { status: 400 }
      )
    }

    console.log(`🗺️  Fetching ${mode} heatmap data for: ${citySlug}`)

    // First, get the city to get its ID
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('id, name, slug')
      .eq('slug', citySlug)
      .single()

    if (cityError || !cityData) {
      return NextResponse.json(
        { error: `City not found: ${citySlug}` },
        { status: 404 }
      )
    }

    // Fetch all venues for this city using city_id
    const { data: venues, error } = await supabase
      .from('venues')
      .select('*')
      .eq('city_id', cityData.id)

    if (error) {
      throw error
    }

    if (!venues || venues.length === 0) {
      return NextResponse.json({
        success: true,
        mode,
        data: [],
        count: 0,
        message: 'No venues found for heatmap'
      })
    }

    console.log(`📊 Processing ${venues.length} venues for ${mode} heatmap`)

    let heatmapData

    if (mode === 'density') {
      // Venue Density Heatmap - just location + constant intensity
      heatmapData = venues.map(v => ({
        lat: v.lat,
        lng: v.lng,
        intensity: 1.0 // All venues have same weight for density visualization
      }))

      console.log(`✅ Generated density heatmap with ${heatmapData.length} points`)

    } else if (mode === 'foottraffic') {
      // Live Foot-Traffic Heatmap - location + busyness intensity
      const currentHour = new Date().getHours()
      const currentDay = new Date().getDay()

      heatmapData = venues
        .map(v => {
          let intensity = 0.5 // Default moderate intensity

          // Try to get live busyness data if available
          if (v.raw_data && v.raw_data.analysis) {
            const dayData = v.raw_data.analysis[currentDay]
            if (dayData && dayData.hour_analysis && dayData.hour_analysis[currentHour]) {
              const busyness = dayData.hour_analysis[currentHour].intensity_nr
              intensity = busyness / 100 // Convert 0-100 to 0-1
            }
          }

          return {
            lat: v.lat,
            lng: v.lng,
            intensity,
            venueName: v.name,
            busyness: Math.round(intensity * 100)
          }
        })
        .filter(point => point.intensity > 0.1) // Filter out closed/empty venues

      console.log(`✅ Generated foot-traffic heatmap with ${heatmapData.length} points`)

    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "density" or "foottraffic"' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      mode,
      data: heatmapData,
      count: heatmapData.length,
      city: citySlug,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Heatmap data error:', error)
    return NextResponse.json(
      { error: 'Failed to generate heatmap data', details: error.message },
      { status: 500 }
    )
  }
}
