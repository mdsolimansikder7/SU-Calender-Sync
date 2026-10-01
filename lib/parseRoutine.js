import { enrichClass } from './classDetails'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function normalizeDay(value) {
  const raw = String(value || '').trim().toLowerCase()
  const aliases = {
    sun: 'Sunday',
    sunday: 'Sunday',
    mon: 'Monday',
    monday: 'Monday',
    tue: 'Tuesday',
    tues: 'Tuesday',
    tuesday: 'Tuesday',
    wed: 'Wednesday',
    wednesday: 'Wednesday',
    thu: 'Thursday',
    thur: 'Thursday',
    thursday: 'Thursday',
    fri: 'Friday',
    friday: 'Friday',
    sat: 'Saturday',
    saturday: 'Saturday'
  }
  return aliases[raw] || DAYS.find((day) => day.toLowerCase() === raw) || null
}

function normalizeTime(value) {
  const text = String(value || '').trim().toUpperCase()
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const meridian = match[3]
  if (meridian === 'PM' && hour < 12) hour += 12
  if (meridian === 'AM' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function uid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const source = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (char === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows.filter((item) => item.some(Boolean))
}

function mapHeaders(headers) {
  const lookup = {
    day: 'day',
    weekday: 'day',
    start: 'start',
    starttime: 'start',
    from: 'start',
    end: 'end',
    endtime: 'end',
    to: 'end',
    coursecode: 'courseCode',
    code: 'courseCode',
    course: 'courseName',
    coursename: 'courseName',
    subject: 'courseName',
    teacher: 'teacher',
    faculty: 'teacher',
    instructor: 'teacher',
    sir: 'teacher',
    email: 'email',
    mail: 'email',
    room: 'room',
    venue: 'room',
    roomnumber: 'room',
    type: 'type',
    classtype: 'type'
  }
  return headers.map((header) => lookup[header.toLowerCase().replace(/[\s_-]/g, '')] || null)
}

export function classesFromJson(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.classes)) return payload.classes
  if (Array.isArray(payload?.routine)) return payload.routine
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export function normalizeClasses(items) {
  return items
    .map((item) => {
      const day = normalizeDay(item.day || item.weekday)
      const start = normalizeTime(item.start || item.startTime || item.from)
      const end = normalizeTime(item.end || item.endTime || item.to)
      if (!day || !start || !end) return null
      return enrichClass({
        id: item.id || uid(),
        day,
        start,
        end,
        courseCode: String(item.courseCode || item.code || 'COURSE').toUpperCase(),
        courseName: String(item.courseName || item.course || item.subject || 'Class').trim(),
        teacher: String(item.teacher || item.faculty || item.instructor || item.sir || '').trim(),
        email: String(item.email || item.mail || '').trim(),
        mobile: String(item.mobile || item.phone || '').trim(),
        floor: String(item.floor || '').trim(),
        roomCode: String(item.roomCode || '').trim(),
        room: String(item.room || item.venue || '').trim(),
        type: String(item.type || 'Theory').trim()
      })
    })
    .filter(Boolean)
}

export function parseUploadedRoutine(text, filename = '') {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { meta: {}, classes: [] }

  if (filename.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const json = JSON.parse(trimmed)
    return {
      meta: {
        semester: json.semester,
        program: json.program,
        section: json.section,
        batch: json.batch,
        sourceUrl: json.sourceUrl
      },
      classes: normalizeClasses(classesFromJson(json))
    }
  }

  const rows = parseCsv(trimmed)
  const header = rows[0] || []
  const keys = mapHeaders(header)
  const body = keys.some(Boolean) ? rows.slice(1) : rows
  const mapped = (keys.some(Boolean) ? body : rows).map((row) => {
    if (keys.some(Boolean)) {
      const item = {}
      keys.forEach((key, index) => {
        if (key) item[key] = row[index]
      })
      return item
    }
    return {
      day: row[0],
      start: row[1],
      end: row[2],
      courseCode: row[3],
      courseName: row[4],
      teacher: row[5],
      email: row[6],
      room: row[7],
      type: row[8]
    }
  })

  return { meta: {}, classes: normalizeClasses(mapped) }
}
