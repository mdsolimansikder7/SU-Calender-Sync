import { NextResponse } from 'next/server'
import { readStore, writeStore } from '../../../lib/store'

export async function POST() {
  const current = readStore()
  const next = writeStore(current)
  return NextResponse.json({
    revision: next.revision,
    updatedAt: next.updatedAt,
    classes: next.classes.length
  })
}
