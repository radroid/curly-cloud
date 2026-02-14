'use client'

import { useEffect, useState } from 'react'

interface LocationData {
  city: string
  full: string
  estimated: boolean
}

// Module-level cache so only one fetch fires across all consumers
let locationPromise: Promise<LocationData> | null = null

function fetchLocation(): Promise<LocationData> {
  if (locationPromise) return locationPromise

  locationPromise = (async () => {
    try {
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      if (data.city && data.region) {
        return {
          city: data.city,
          full: `${data.city}, ${data.region}, ${data.country_name}`,
          estimated: false,
        }
      }
      if (data.country_name) {
        return { city: data.country_name, full: data.country_name, estimated: false }
      }
    } catch {
      // Primary failed, try fallback
    }

    try {
      const res = await fetch('https://ip-api.com/json/')
      const data = await res.json()
      if (data.city && data.regionName) {
        return {
          city: data.city,
          full: `${data.city}, ${data.regionName}, ${data.country}`,
          estimated: false,
        }
      }
      if (data.country) {
        return { city: data.country, full: data.country, estimated: false }
      }
    } catch {
      // Fallback also failed
    }

    // Both IP services failed — estimate from browser timezone
    // e.g. "America/Toronto" → "Toronto"
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz.includes('/')) {
      const city = tz.split('/').pop()!.replace(/_/g, ' ')
      return { city, full: city, estimated: true }
    }

    return { city: 'Unknown', full: 'Unknown', estimated: false }
  })()

  return locationPromise
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData>({ city: 'Loading...', full: 'Loading...', estimated: false })

  useEffect(() => {
    fetchLocation().then(setLocation)
  }, [])

  return location
}
