import { formatLocation, parseFloorRoom } from './faculty'

const JUNK = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|theory|lab|class|routine|sonargaon|university|section|batch|campus|floor|floar|west|east|north|south|sessional|stheory)\b/gi
const DIRECTIONS = new Set(['west', 'east', 'north', 'south', 'left', 'right'])

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function repairEmail(text) {
  const source = compact(text)
    .replace(/\s*\[at\]\s*/gi, '@')
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s+@\s+/g, '@')
  const direct = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  if (direct) return direct[0].toLowerCase()

  const glued = source.match(/([A-Z0-9._%+-]{3,})(?:\s+[A-Z0-9._%+-]{1,12})?\s+(gmail|yahoo|hotmail|outlook|icloud)[\s.]*(com|icom|edu|bd)?/i)
  if (!glued) return ''
  const local = glued[1].toLowerCase().replace(/[._-]+$/, '')
  const domain = glued[2].toLowerCase()
  return `${local}@${domain}.com`
}

export function extractRoom(text) {
  const source = compact(text)
  const paired = source.match(/floor\s*0?(\d{1,2})\s*,?\s*room\s*:?\s*([A-Za-z]+-?\d{2,4})/i)
  if (paired) return `Floor ${paired[1].padStart(2, '0')}, Room ${paired[2]}`
  const campus = source.match(/campus\s+flo+a?r\s+([A-Za-z]+)/i)
  if (campus) {
    const side = DIRECTIONS.has(campus[1].toLowerCase()) ? campus[1] : ''
    return compact(`Campus Floor ${side}`).replace(/\b\w/g, (ch) => ch.toUpperCase())
  }
  const labeled = source.match(/\b(?:room|rm|lab)\s*[:#-]?\s*([A-Z]?\d{1,4}[A-Z]?)\b(?!\s*[:.]\d)/i)
  if (labeled) return `${/lab/i.test(labeled[0]) ? 'Lab' : 'Room'} ${labeled[1]}`
  return ''
}

export function extractTeacher(text) {
  const source = compact(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/campus\s+flo+a?r\s+[A-Za-z]+/gi, ' ')
  const titled = source.match(/\b(?:mr|ms|mrs|dr|md|prof)\.?\s+[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3}\b/i)
  if (titled) return compact(titled[0])
  const caps = source.match(/\b[A-Z]{3,}(?:\s+[A-Z]{3,}){1,3}\b/)
  if (caps && !/^(ROOM|LAB|HALL|CAMPUS|FLOOR|WEST|EAST|NORTH|SOUTH|TIME|DATE)/.test(caps[0])) {
    return caps[0].toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
  }
  const names = source.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3}\b/g) || []
  const skip = /^(Campus|Floor|West|East|North|South|Room|Lab|Theory|Sessional)/
  const hit = names.find((name) => !skip.test(name))
  return hit ? compact(hit) : ''
}

export function extractCourseCode(text) {
  const match = String(text || '').toUpperCase().match(/\b([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z]?)\b/)
  if (!match) return ''
  if (['ROOM', 'LAB', 'HALL', 'TIME', 'DATE', 'YEAR', 'BATCH', 'SEM'].includes(match[1])) return ''
  return `${match[1]}-${match[2]}`
}

function courseHead(text) {
  const source = compact(text)
  const cuts = [
    source.search(/\b(?:mr|ms|mrs|dr|md|prof)\.?\s+[A-Z]/i),
    source.search(/campus\s+flo/i),
    source.search(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i),
    source.search(/\b(?:gmail|yahoo|hotmail)\b/i)
  ].filter((index) => index >= 8)
  if (!cuts.length) return source
  return compact(source.slice(0, Math.min(...cuts)))
}

export function cleanCourseName(text, extras = []) {
  let name = courseHead(text)
  extras.filter(Boolean).forEach((extra) => {
    extra.split(/[\s@._-]+/).filter((part) => part.length > 2).forEach((part) => {
      name = name.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), ' ')
    })
  })
  name = name
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/\b[A-Z]{2,5}[\s-]?\d{3,4}[A-Z]?\b/g, ' ')
    .replace(/campus\s+flo+a?r\s+[A-Za-z]+(?:\s+[A-Za-z]+)?/gi, ' ')
    .replace(/\b(?:room|rm|lab)\s*[:#-]?\s*[A-Z]?\d{1,4}[A-Z]?\b/gi, ' ')
    .replace(/\b(?:gmail|yahoo|hotmail|outlook|icloud)(?:com|icom)?\b/gi, ' ')
    .replace(JUNK, ' ')
    .replace(/[^A-Za-z0-9 .&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .trim()
  return name || 'Class'
}

export function enrichClass(item = {}) {
  const blob = [item.courseName, item.teacher, item.email, item.room, item.courseCode, item.floor].filter(Boolean).join(' ')
  const email = item.email && item.email.includes('@') ? item.email.toLowerCase() : repairEmail(blob)
  const parsedRoom = parseFloorRoom(blob)
  const courseCode = item.courseCode && item.courseCode !== 'COURSE'
    ? String(item.courseCode).toUpperCase()
    : (extractCourseCode(blob) || 'COURSE')
  const next = {
    ...item,
    courseCode,
    courseName: cleanCourseName(item.courseName || blob, [item.teacher, email, item.room, courseCode]),
    teacher: item.teacher && item.teacher !== 'TBA' ? item.teacher : (extractTeacher(blob) || ''),
    email: email || '',
    mobile: item.mobile || '',
    floor: item.floor || parsedRoom.floor || '',
    roomCode: item.roomCode || parsedRoom.roomCode || '',
    room: item.room && item.room !== 'TBA' && !/campus floor/i.test(item.room) ? item.room : (extractRoom(blob) || ''),
    type: item.type === 'Lab' || /sessional|lab/i.test(item.courseName || item.type || '') ? 'Lab' : (item.type || 'Theory')
  }
  next.room = formatLocation(next) || next.room
  next.courseName = cleanCourseName(next.courseName, [next.teacher, next.email, next.room, next.courseCode, next.mobile])
  return next
}

export function eventDetails(item, store = {}) {
  return [
    `Class code: ${item.courseCode || 'TBA'}`,
    `Course: ${item.courseName || 'Class'}`,
    `Teacher: ${item.teacher || 'TBA'}`,
    item.mobile ? `Mobile: ${item.mobile}` : '',
    `Email: ${item.email || 'TBA'}`,
    item.floor ? `Floor: ${item.floor}` : '',
    `Room: ${item.roomCode || item.room || 'TBA'}`,
    `Type: ${item.type || 'Class'}`,
    store.department ? `Department: ${store.department}` : '',
    store.program ? `Program: ${store.program}` : '',
    store.section ? `Section: ${store.section}` : '',
    store.batch ? `Batch: ${store.batch}` : '',
    store.semester || ''
  ].filter(Boolean)
}
