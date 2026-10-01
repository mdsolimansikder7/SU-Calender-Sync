export function parseFloorRoom(text) {
  const source = String(text || '')
  const match = source.match(/floor\s*0?(\d{1,2})\s*,?\s*room\s*:?\s*([A-Za-z]+-?\d{2,4})/i)
    || source.match(/\(\s*floor\s*0?(\d{1,2})\s*,\s*room\s*:?\s*([A-Za-z]+-?\d{2,4})\s*\)/i)
  if (!match) {
    const floorOnly = source.match(/floor\s*0?(\d{1,2})/i)
    return { floor: floorOnly ? floorOnly[1].padStart(2, '0') : '', roomCode: '' }
  }
  return {
    floor: match[1].padStart(2, '0'),
    roomCode: match[2].replace(/\s+/g, '')
  }
}

export function formatLocation(item = {}) {
  if (item.floor && item.roomCode) return `Floor ${item.floor}, Room ${item.roomCode}`
  if (item.floor && item.room && !/floor/i.test(item.room)) return `Floor ${item.floor}, Room ${item.room}`
  return item.room || ''
}
