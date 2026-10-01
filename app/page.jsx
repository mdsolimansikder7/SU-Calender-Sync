'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function googleUrl(icsUrl) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsUrl.replace(/^https?:/, 'webcal:'))}`
}

function withVersion(url, revision) {
  if (!url) return url
  const next = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  next.searchParams.set('v', String(revision || 1))
  return next.toString()
}

export default function HomePage() {
  const [store, setStore] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [icsUrl, setIcsUrl] = useState('')
  const [jsonUrl, setJsonUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [draft, setDraft] = useState({
    day: 'Sunday',
    start: '09:00',
    end: '10:30',
    courseCode: '',
    courseName: '',
    teacher: '',
    email: '',
    mobile: '',
    floor: '',
    room: '',
    type: 'Theory'
  })
  const fileRef = useRef(null)
  const timers = useRef([])

  async function load() {
    const res = await fetch('/api/routine')
    const data = await res.json()
    setStore(data)
    if (data.sourceUrl) setApiUrl(data.sourceUrl)
  }

  useEffect(() => {
    const origin = window.location.origin
    setJsonUrl(`${origin}/api/routine.json`)
    if (!apiUrl) setApiUrl(`${origin}/api/routine.json`)
    load().catch(() => setError('Could not load routine'))
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (!store?.classes?.length) return

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      store.classes.forEach((item) => {
        const now = new Date()
        const targetDay = DAYS.indexOf(item.day)
        const next = new Date()
        const diff = (targetDay - now.getDay() + 7) % 7
        next.setDate(now.getDate() + diff)
        const [h, m] = item.start.split(':').map(Number)
        next.setHours(h, m, 0, 0)
        if (next <= now) next.setDate(next.getDate() + 7)
        const remindAt = next.getTime() - (Number(store.reminderMinutes) || 15) * 60000
        const delay = remindAt - Date.now()
        if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
          const id = setTimeout(() => {
            new Notification(`${item.courseCode} starts soon`, {
              body: `${item.courseName} · ${item.room} · ${item.start}`,
              tag: item.id
            })
          }, delay)
          timers.current.push(id)
        }
      })
    }

    return () => timers.current.forEach(clearTimeout)
  }, [store])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIcsUrl(withVersion(`${window.location.origin}/api/calendar.ics`, store?.revision || 1))
  }, [store?.revision])

  const grouped = useMemo(() => {
    const map = Object.fromEntries(DAYS.map((day) => [day, []]))
    for (const item of store?.classes || []) map[item.day]?.push(item)
    DAYS.forEach((day) => map[day].sort((a, b) => a.start.localeCompare(b.start)))
    return map
  }, [store])

  async function enableAlerts() {
    if (!('Notification' in window)) {
      setError('This browser does not support notifications')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setNotice('Browser alerts on. Google Calendar will also notify on phone, laptop and PC after you subscribe.')
      load()
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/routine', { method: 'POST', body: form })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Upload failed')
      setOcrText(data.ocrText || '')
      return
    }
    setStore(data)
    setOcrText(data.ocrText || '')
    setApiUrl(jsonUrl || '/api/routine.json')
    setNotice(
      data.fromPhoto
        ? `Photo converted to API: ${data.classes.length} classes. Use Fetch or Add to Google Calendar.`
        : `Uploaded ${data.classes.length} classes from ${file.name}`
    )
  }

  async function fetchApi() {
    setError('')
    const res = await fetch('/api/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: apiUrl })
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'API fetch failed')
      return
    }
    setStore(data)
    setNotice(`Fetched ${data.classes.length} classes from API`)
  }

  async function forceCalendarUpdate() {
    setError('')
    const res = await fetch('/api/refresh', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError('Could not refresh calendar feed')
      return
    }
    await load()
    const nextUrl = withVersion(`${window.location.origin}/api/calendar.ics`, data.revision)
    setIcsUrl(nextUrl)
    setNotice('Feed updated. Unsubscribe the old SU calendar, then click Add to Google Calendar again.')
    window.open(googleUrl(nextUrl), '_blank', 'noopener')
  }

  async function saveMeta(patch) {
    const res = await fetch('/api/routine', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...store, ...patch })
    })
    setStore(await res.json())
  }

  async function addClass() {
    setError('')
    if (!draft.courseCode || !draft.courseName) {
      setError('Course code and name are required')
      return
    }
    const next = await fetch('/api/routine', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...store, classes: [...store.classes, draft] })
    })
    setStore(await next.json())
    setNotice(`Added ${draft.courseCode}`)
    setDraft({ ...draft, courseCode: '', courseName: '', teacher: '', email: '', mobile: '', floor: '', room: '' })
  }

  if (!store) {
    return <main className="page"><p>Loading Sonargaon University routine...</p></main>
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <div className="kicker">Sonargaon University</div>
          <h1>Class routine that follows you everywhere.</h1>
          <p className="lead">
            Any SU department can upload a routine photo or CSV. It becomes a calendar feed for
            phone, laptop and PC — with alerts before class starts.
          </p>
          <div className="badge-row" style={{ marginTop: 16 }}>
            {store.department ? <span className="badge">{store.department}</span> : null}
            {store.program ? <span className="badge">{store.program}</span> : null}
            {store.semester ? <span className="badge">{store.semester}</span> : null}
            {store.section ? <span className="badge">Section {store.section}</span> : null}
            {store.batch ? <span className="badge">Batch {store.batch}</span> : null}
          </div>
        </div>
        <div className="panel stack">
          <h3>Google Calendar</h3>
          <p className="sync-url">{icsUrl}</p>
          <p>Google keeps the old copy. Unsubscribe Sonargaon University Class Routine, then add this new feed.</p>
          <div className="action-row">
            <a className="btn btn-gold" href={googleUrl(icsUrl)} target="_blank" rel="noreferrer">Add updated calendar</a>
            <a className="btn btn-ghost" href={icsUrl}>Download .ics</a>
          </div>
          <button className="btn btn-primary" onClick={forceCalendarUpdate}>Force Google update</button>
          <button className="btn btn-ghost" onClick={enableAlerts}>Enable class notifications</button>
        </div>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <section className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel stack">
          <h2>Photo to API</h2>
          <p>Upload your SU routine screenshot. Text is read, classes are extracted, and a JSON API is generated.</p>
          <label className="drop">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.csv,.json,.png,.jpg,.jpeg,.webp"
              onChange={uploadFile}
            />
            {busy ? 'Reading photo...' : 'Choose routine photo / CSV / JSON'}
          </label>
          <div className="field">
            <span>Generated routine API</span>
            <input value={jsonUrl} readOnly />
          </div>
          <div className="field">
            <span>Fetch this or another JSON URL</span>
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={fetchApi} disabled={busy}>Fetch from API</button>
          {ocrText ? <pre className="ocr">{ocrText}</pre> : null}
        </div>

        <div className="panel stack">
          <h2>Your class info</h2>
          <div className="grid-2">
            <label className="field">
              <span>Department</span>
              <input value={store.department || ''} onChange={(e) => saveMeta({ department: e.target.value })} placeholder="CSE / EEE / BBA / English" />
            </label>
            <label className="field">
              <span>Program</span>
              <input value={store.program || ''} onChange={(e) => saveMeta({ program: e.target.value })} placeholder="B.Sc. / BBA / BA" />
            </label>
            <label className="field">
              <span>Semester</span>
              <input value={store.semester || ''} onChange={(e) => saveMeta({ semester: e.target.value })} placeholder="Spring 2026" />
            </label>
            <label className="field">
              <span>Section</span>
              <input value={store.section || ''} onChange={(e) => saveMeta({ section: e.target.value })} placeholder="Section" />
            </label>
            <label className="field">
              <span>Batch</span>
              <input value={store.batch || ''} onChange={(e) => saveMeta({ batch: e.target.value })} placeholder="Batch" />
            </label>
            <label className="field">
              <span>Notify before (minutes)</span>
              <input
                type="number"
                min="0"
                value={store.reminderMinutes}
                onChange={(e) => saveMeta({ reminderMinutes: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="steps">
            <div><b>1.</b> Upload or fetch the routine.</div>
            <div><b>2.</b> Click Add to Google Calendar, or paste the ICS URL in Calendar settings.</div>
            <div><b>3.</b> Google syncs offline to phone, laptop and PC. Alarms fire at class time.</div>
          </div>
        </div>
      </section>

      <section className="panel stack" style={{ marginTop: 16 }}>
        <h2>Add one class</h2>
        <div className="grid-2">
          <label className="field">
            <span>Day</span>
            <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })}>
              {DAYS.map((day) => <option key={day}>{day}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option>Theory</option>
              <option>Lab</option>
            </select>
          </label>
          <label className="field">
            <span>Start</span>
            <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </label>
          <label className="field">
            <span>End</span>
            <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </label>
          <label className="field">
            <span>Course code</span>
            <input value={draft.courseCode} onChange={(e) => setDraft({ ...draft, courseCode: e.target.value })} placeholder="Course code" />
          </label>
          <label className="field">
            <span>Course name</span>
            <input value={draft.courseName} onChange={(e) => setDraft({ ...draft, courseName: e.target.value })} placeholder="Course name" />
          </label>
          <label className="field">
            <span>Teacher name</span>
            <input value={draft.teacher} onChange={(e) => setDraft({ ...draft, teacher: e.target.value })} placeholder="Teacher name" />
          </label>
          <label className="field">
            <span>Teacher email</span>
            <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="teacher@email.com" />
          </label>
          <label className="field">
            <span>Mobile</span>
            <input value={draft.mobile} onChange={(e) => setDraft({ ...draft, mobile: e.target.value })} placeholder="Mobile" />
          </label>
          <label className="field">
            <span>Floor</span>
            <input value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} placeholder="Floor" />
          </label>
          <label className="field">
            <span>Room</span>
            <input value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="Room" />
          </label>
        </div>
        <button className="btn btn-primary" onClick={addClass}>Add class</button>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Weekly routine</h2>
        <div className="week">
          {DAYS.map((day) => (
            <div className="day-col" key={day}>
              <h4>{day}</h4>
              {grouped[day].length === 0 ? <small>No class</small> : null}
              {grouped[day].map((item) => (
                <article className={`class-card ${String(item.type).toLowerCase() === 'lab' ? 'lab' : ''}`} key={item.id}>
                  <b>{item.start}–{item.end}</b>
                  <span>{item.courseName}</span>
                  <small>Class code: {item.courseCode}</small>
                  <small>Teacher: {item.teacher || 'TBA'}</small>
                  <small>Email: {item.email || 'TBA'}</small>
                  {item.mobile ? <small>Mobile: {item.mobile}</small> : null}
                  {item.floor ? <small>Floor: {item.floor}</small> : null}
                  <small>Room: {item.roomCode || item.room || 'TBA'}</small>
                </article>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
