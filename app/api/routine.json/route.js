import { NextResponse } from 'next/server'
import { buildRoutineApi } from '../../../lib/parseOcr'
import { readStore } from '../../../lib/store'

export async function GET() {
  return NextResponse.json(buildRoutineApi(readStore()), {
    headers: { 'Cache-Control': 'no-store' }
  })
}
