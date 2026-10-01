import fs from 'fs'
import path from 'path'
import { normalizeClasses } from './parseRoutine'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'routine.json')

const DEFAULT_STATE = {
  university: 'Sonargaon University',
  department: '',
  program: '',
  semester: '',
  section: '',
  batch: '',
  timezone: 'Asia/Dhaka',
  reminderMinutes: 15,
  sourceUrl: '',
  revision: 1,
  updatedAt: null,
  classes: []
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2))
  }
}

export function readStore() {
  ensureStore()
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  return {
    ...DEFAULT_STATE,
    ...raw,
    classes: normalizeClasses(raw.classes || [])
  }
}

export function writeStore(next) {
  ensureStore()
  const current = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {}
  const payload = {
    ...DEFAULT_STATE,
    ...next,
    classes: normalizeClasses(next.classes || []),
    revision: Number(current.revision || 0) + 1,
    updatedAt: new Date().toISOString()
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2))
  return payload
}
