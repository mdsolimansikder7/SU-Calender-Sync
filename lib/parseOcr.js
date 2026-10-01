import { extractRoom, extractTeacher, repairEmail } from './classDetails'
import { normalizeClasses } from './parseRoutine'

const DAY_ALIASES = {
  sun: 'Sunday',
  sunday: 'Sunday',
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday'
}

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function uid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function padTime(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function to24(hour, minute, meridian) {
  let h = Number(hour)
  const m = Number(minute || 0)
  const mer = String(meridian || '').toUpperCase()
  if (mer === 'PM' && h < 12) h += 12
  if (mer === 'AM' && h === 12) h = 0
  return padTime(h, m)
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return padTime(Math.floor(wrapped / 60), wrapped % 60)
}

function normalizeDay(value) {
  const raw = String(value || '').trim().toLowerCase()
  return DAY_ALIASES[raw] || null
}

function findDays(text) {
  const found = []
  const re = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi
  let match
  while ((match = re.exec(text))) {
    found.push({
      day: DAY_ALIASES[match[1].toLowerCase()],
      index: match.index
    })
  }
  return found
}

function findTimes(text) {
  const found = []
  const re = /(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?\s*(?:-|–|—|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?/gi
  let match
  while ((match = re.exec(text))) {
    const startMer = match[3] || match[6] || ''
    const endMer = match[6] || match[3] || ''
    found.push({
      start: to24(match[1], match[2] || '00', startMer),
      end: to24(match[4], match[5] || '00', endMer),
      index: match.index,
      raw: match[0]
    })
  }
  if (found.length) return found

  const single = /(\d{1,2})[:.](\d{2})\s*(AM|PM)?/gi
  while ((match = single.exec(text))) {
    const start = to24(match[1], match[2], match[3] || '')
    found.push({
      start,
      end: addMinutes(start, 90),
      index: match.index,
      raw: match[0]
    })
  }
  return found
}

const FAKE_CODES = new Set(['ROOM', 'LAB', 'HALL', 'TIME', 'DATE', 'SEC', 'BATCH', 'YEAR', 'SEM', 'SLOT', 'FLOOR', 'BLDG'])

function findCourseCodes(text) {
  const found = []
  const re = /\b([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z]?)\b/g
  const source = text.toUpperCase()
  let match
  while ((match = re.exec(source))) {
    if (FAKE_CODES.has(match[1])) continue
    found.push({
      code: `${match[1]}-${match[2]}`,
      index: match.index,
      raw: match[0]
    })
  }
  return found
}

function nearest(items, index) {
  if (!items.length) return null
  return items.reduce((best, item) => {
    const dist = Math.abs(item.index - index)
    if (!best || dist < best.dist) return { item, dist }
    return best
  }, null).item
}

function findEmail(text) {
  const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : ''
}

function cleanName(text) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/gi, ' ')
    .replace(/\b\d{1,2}[:.]\d{2}\s*(AM|PM)?\b/gi, ' ')
    .replace(/\b(AM|PM|to|lab|theory|room|rm|email|mail|sir)\b/gi, ' ')
    .replace(/\b(?:mr|ms|mrs|dr|md|prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gi, ' ')
    .replace(/\b[A-Z]{2,5}[\s-]?\d{3,4}[A-Z]?\b/g, ' ')
    .replace(/[^A-Za-z .]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function guessType(text) {
  return /\blab\b/i.test(text) ? 'Lab' : 'Theory'
}

function guessRoom(text) {
  const re = /\b(?:room|rm|lab)\s*[:#-]?\s*([A-Z]?\d{1,4}[A-Z]?)\b(?!\s*[:.]\d)/gi
  let match
  let last = null
  while ((match = re.exec(text))) {
    last = match
  }
  if (!last) return 'TBA'
  return `${/lab/i.test(last[0]) ? 'Lab' : 'Room'} ${last[1]}`
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
    .replace(/\bMd\b/g, 'Md.')
}

function guessTeacher(text) {
  const titled = String(text || '').match(/\b(?:mr|ms|mrs|dr|md|prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/i)
  if (titled) return titled[0].replace(/\s+/g, ' ').trim()
  const names = String(text || '').match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3}\b/g) || []
  const skip = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Data Structures|Computer Networks|Technical Writing|Database Systems|Digital Logic|Sonargaon University)/i
  const hit = names.find((name) => !skip.test(name))
  return hit ? titleCase(hit) : 'TBA'
}

function classFields(line, extra = '') {
  const source = `${line} ${extra}`
  return {
    teacher: extractTeacher(source) || guessTeacher(source),
    email: repairEmail(source) || findEmail(source),
    room: extractRoom(source) || guessRoom(source),
    type: guessType(source)
  }
}

function uniqueClasses(items) {
  const seen = new Set()
  return normalizeClasses(items).filter((item) => {
    const key = `${item.day}|${item.start}|${item.courseCode}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start.localeCompare(b.start))
}

function parseGrid(lines) {
  const headerIndex = lines.findIndex((line) => findTimes(line).length >= 2)
  if (headerIndex < 0) return []
  const slots = findTimes(lines[headerIndex])
  const classes = []

  for (const line of lines.slice(headerIndex + 1)) {
    const dayHit = findDays(line)[0]
    const day = dayHit?.day || normalizeDay(line.split(/\s+/)[0])
    if (!day) continue
    const rest = line.replace(/^\s*\w+\s*/, ' ')
    const codes = findCourseCodes(rest)
    if (!codes.length) continue
    codes.forEach((code, index) => {
      const slot = slots[Math.min(index, slots.length - 1)]
      classes.push({
        id: uid(),
        day,
        start: slot.start,
        end: slot.end,
        courseCode: code.code,
        courseName: cleanName(rest) || 'Class',
        ...classFields(line, rest)
      })
    })
  }
  return classes
}

export function parseOcrText(raw) {
  const text = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, ' ')
  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const grid = parseGrid(lines)
  if (grid.length) return uniqueClasses(grid)

  const classes = []
  let currentDay = null
  const headerDays = [...new Set(findDays(lines.slice(0, 8).join(' ')).map((item) => item.day))]

  for (const line of lines) {
    const days = findDays(line)
    const times = findTimes(line)
    const codes = findCourseCodes(line)

    if (days.length === 1 && !times.length && !codes.length) {
      currentDay = days[0].day
      continue
    }

    if (times.length && codes.length) {
      for (const code of codes) {
        const time = nearest(times, code.index)
        const dayHit = nearest(days, code.index)
        const day = dayHit?.day || currentDay
        if (!day || !time) continue
        classes.push({
          id: uid(),
          day,
          start: time.start,
          end: time.end,
          courseCode: code.code,
          courseName: cleanName(line) || 'Class',
          ...classFields(line)
        })
      }
      continue
    }

    if (times.length && currentDay) {
      times.forEach((time, index) => {
        classes.push({
          id: uid(),
          day: currentDay,
          start: time.start,
          end: time.end,
          courseCode: codes[index]?.code || codes[0]?.code || 'COURSE',
          courseName: cleanName(line) || 'Class',
          ...classFields(line)
        })
      })
    }
  }

  if (!classes.length && headerDays.length) {
    for (const line of lines.slice(1)) {
      const times = findTimes(line)
      const codes = findCourseCodes(line)
      if (!times.length) continue
      headerDays.forEach((day, index) => {
        const time = times[Math.min(index, times.length - 1)]
        const code = codes[Math.min(index, Math.max(codes.length - 1, 0))]
        classes.push({
          id: uid(),
          day,
          start: time.start,
          end: time.end,
          courseCode: code?.code || 'COURSE',
          courseName: cleanName(line) || 'Class',
          ...classFields(line)
        })
      })
    }
  }

  return uniqueClasses(classes)
}

export function buildRoutineApi(store) {
  return {
    university: store.university,
    department: store.department,
    semester: store.semester,
    program: store.program,
    section: store.section,
    batch: store.batch,
    timezone: store.timezone,
    updatedAt: store.updatedAt,
    classes: store.classes
  }
}
