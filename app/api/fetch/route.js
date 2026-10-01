import { NextResponse } from 'next/server'
import { readStore, writeStore } from '../../../lib/store'
import { classesFromJson, normalizeClasses, parseUploadedRoutine } from '../../../lib/parseRoutine'

export async function POST(request) {
  const body = await request.json()
  const url = String(body.url || '').trim()
  if (!url) {
    return NextResponse.json({ error: 'Routine API URL is required' }, { status: 400 })
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'Only HTTP URLs are allowed' }, { status: 400 })
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: { Accept: 'application/json, text/csv, text/plain' },
    cache: 'no-store'
  })

  if (!response.ok) {
    return NextResponse.json(
      { error: `Routine API returned ${response.status}` },
      { status: 502 }
    )
  }

  const text = await response.text()
  let parsed
  try {
    parsed = parseUploadedRoutine(text, parsedUrl.pathname)
  } catch {
    return NextResponse.json({ error: 'Could not parse routine API response' }, { status: 422 })
  }

  if (!parsed.classes.length) {
    try {
      const json = JSON.parse(text)
      parsed.classes = normalizeClasses(classesFromJson(json))
      parsed.meta = {
        semester: json.semester,
        program: json.program,
        section: json.section,
        batch: json.batch
      }
    } catch {
      return NextResponse.json({ error: 'No classes found in API response' }, { status: 422 })
    }
  }

  const current = readStore()
  const next = writeStore({
    ...current,
    ...Object.fromEntries(Object.entries(parsed.meta).filter(([, value]) => value)),
    sourceUrl: parsedUrl.toString(),
    classes: parsed.classes
  })

  return NextResponse.json(next)
}
