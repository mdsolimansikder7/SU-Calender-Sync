import { eventDetails } from './classDetails'

const DAY_MAP = {
  Sunday: 'SU',
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA'
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function foldLine(line) {
  const chunks = []
  let remaining = line
  while (remaining.length > 73) {
    chunks.push(remaining.slice(0, 73))
    remaining = ' ' + remaining.slice(73)
  }
  chunks.push(remaining)
  return chunks.join('\r\n')
}

function escapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function parseTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

function nextOccurrence(dayName, start) {
  const target = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName)
  const now = new Date()
  const date = new Date(now)
  const diff = (target - now.getDay() + 7) % 7
  date.setDate(now.getDate() + diff)
  const { h, m } = parseTime(start)
  date.setHours(h, m, 0, 0)
  if (diff === 0 && date < now) {
    date.setDate(date.getDate() + 7)
  }
  return date
}

function formatUtc(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

function formatLocal(date) {
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    '00'
  )
}

function classDurationMinutes(start, end) {
  const a = parseTime(start)
  const b = parseTime(end)
  return b.h * 60 + b.m - (a.h * 60 + a.m)
}

function sequenceOf(store) {
  if (store.revision) return Number(store.revision)
  if (store.updatedAt) return Math.floor(new Date(store.updatedAt).getTime() / 1000)
  return 1
}

function eventUid(item) {
  const key = `${item.day}-${item.start}-${item.courseCode}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `su-${key}@sonargaon-calendar`
}

export function buildIcs(store, calendarUrl) {
  const reminder = Number(store.reminderMinutes) || 15
  const stamp = formatUtc(store.updatedAt ? new Date(store.updatedAt) : new Date())
  const seq = sequenceOf(store)
  const calName = `${store.university} Routine v${seq}`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sonargaon University//SU Calendar Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    `X-WR-CALNAME:${escapeText(calName)}`,
    `X-WR-TIMEZONE:${store.timezone || 'Asia/Dhaka'}`,
    `X-WR-CALDESC:${escapeText(`${store.program} · ${store.semester} · Section ${store.section}`)}`,
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Dhaka',
    'X-LIC-LOCATION:Asia/Dhaka',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0600',
    'TZOFFSETTO:+0600',
    'TZNAME:+06',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ]

  for (const item of store.classes || []) {
    const start = nextOccurrence(item.day, item.start)
    const end = new Date(start.getTime() + classDurationMinutes(item.start, item.end) * 60000)
    const uid = eventUid(item)
    const summary = `${item.courseCode} · ${item.courseName}`
    const room = item.room && item.room !== 'TBA' ? item.room : 'Sonargaon University'
    const details = eventDetails(item, store)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`LAST-MODIFIED:${stamp}`)
    lines.push(`CREATED:${stamp}`)
    lines.push(`SEQUENCE:${seq}`)
    lines.push(`DTSTART;TZID=Asia/Dhaka:${formatLocal(start)}`)
    lines.push(`DTEND;TZID=Asia/Dhaka:${formatLocal(end)}`)
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${DAY_MAP[item.day] || 'MO'}`)
    lines.push(foldLine(`SUMMARY:${escapeText(summary)}`))
    lines.push(foldLine(`DESCRIPTION:${details.map(escapeText).join('\\n')}`))
    const location = room.includes('Sonargaon') ? room : `${room}, Sonargaon University`
    lines.push(foldLine(`LOCATION:${escapeText(location)}`))
    if (item.email) {
      lines.push(foldLine(`ORGANIZER;CN=${escapeText(item.teacher || 'Faculty')}:mailto:${item.email}`))
    }
    lines.push('CATEGORIES:EDUCATION,CLASS')
    lines.push('STATUS:CONFIRMED')
    lines.push('TRANSP:OPAQUE')
    if (calendarUrl) {
      lines.push(foldLine(`URL:${calendarUrl}`))
    }
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push(`TRIGGER:-PT${reminder}M`)
    lines.push(foldLine(`DESCRIPTION:${escapeText(`Class starts soon: ${summary}`)}`))
    lines.push('END:VALARM')
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push('TRIGGER:PT0M')
    lines.push(foldLine(`DESCRIPTION:${escapeText(`Class now: ${summary} at ${item.room || 'campus'}`)}`))
    lines.push('END:VALARM')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
