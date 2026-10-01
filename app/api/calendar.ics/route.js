import { NextResponse } from 'next/server'
import { buildIcs } from '../../../lib/ics'
import { readStore } from '../../../lib/store'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const store = readStore()
  const origin = request.nextUrl.origin
  const rev = store.revision || 1
  const ics = buildIcs(store, `${origin}/api/calendar.ics?v=${rev}`)
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="su-routine.ics"',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      ETag: `"su-routine-${rev}"`
    }
  })
}
