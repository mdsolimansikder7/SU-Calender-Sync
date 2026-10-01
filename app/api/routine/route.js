import { NextResponse } from 'next/server'
import { isImageFile, ocrImage } from '../../../lib/ocr'
import { parseOcrText } from '../../../lib/parseOcr'
import { classesFromJson, normalizeClasses, parseUploadedRoutine } from '../../../lib/parseRoutine'
import { readStore, writeStore } from '../../../lib/store'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(readStore())
}

export async function PUT(request) {
  const body = await request.json()
  const current = readStore()
  const next = writeStore({
    ...current,
    ...body,
    classes: Array.isArray(body.classes) ? normalizeClasses(body.classes) : current.classes
  })
  return NextResponse.json(next)
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || ''
  const current = readStore()

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('file')
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const name = String(file.name || 'upload')
    const mime = String(file.type || '')

    if (isImageFile(name, mime)) {
      const buffer = Buffer.from(await file.arrayBuffer())
      let text = ''
      try {
        text = await ocrImage(buffer, name)
      } catch {
        return NextResponse.json({ error: 'Could not read text from this photo' }, { status: 422 })
      }
      const classes = parseOcrText(text)
      if (!classes.length) {
        return NextResponse.json({
          error: 'Photo read, but no class times were found. Use a clearer routine screenshot.',
          ocrText: text.slice(0, 1200)
        }, { status: 422 })
      }
      const next = writeStore({
        ...current,
        sourceUrl: '/api/routine.json',
        classes
      })
      return NextResponse.json({ ...next, ocrText: text, fromPhoto: true })
    }

    const lower = name.toLowerCase()
    if (!lower.endsWith('.csv') && !lower.endsWith('.json') && !lower.endsWith('.txt')) {
      return NextResponse.json(
        { error: 'Upload a routine photo, .csv or .json file' },
        { status: 400 }
      )
    }
    const text = await file.text()
    const parsed = parseUploadedRoutine(text, name)
    if (!parsed.classes.length) {
      return NextResponse.json(
        { error: 'No classes found. Use CSV columns: day, start, end, courseCode, courseName, teacher, room, type' },
        { status: 422 }
      )
    }
    const next = writeStore({
      ...current,
      ...Object.fromEntries(Object.entries(parsed.meta).filter(([, value]) => value)),
      classes: parsed.classes
    })
    return NextResponse.json(next)
  }

  const body = await request.json()
  const parsed = parseUploadedRoutine(JSON.stringify(body), 'routine.json')
  const next = writeStore({
    ...current,
    ...body,
    classes: parsed.classes.length ? parsed.classes : normalizeClasses(classesFromJson(body))
  })
  return NextResponse.json(next)
}
