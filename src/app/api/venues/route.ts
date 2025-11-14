/**
 * API Route: Query venues from Supabase
 * GET /api/venues?citySlug=austin
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const citySlug = searchParams.get('citySlug')

    if (!citySlug) {
      return NextResponse.json(
        { error: 'citySlug parameter is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Querying venues for city: ${citySlug}`)

    // Get city ID
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('id, name')
      .eq('slug', citySlug)
      .single()

    if (cityError || !cityData) {
      return NextResponse.json(
        { error: `City not found: ${citySlug}` },
        { status: 404 }
      )
    }

    // Get venues for this city
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('*')
      .eq('city_id', cityData.id)
      .eq('is_event_venue', true)
      .order('name')

    if (venuesError) {
      throw venuesError
    }

    console.log(`✅ Found ${venues?.length || 0} venues in ${cityData.name}`)

    return NextResponse.json({
      city: cityData.name,
      count: venues?.length || 0,
      venues: venues || []
    })
  } catch (error: any) {
    console.error('❌ Venue query error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to query venues' },
      { status: 500 }
    )
  }
}
