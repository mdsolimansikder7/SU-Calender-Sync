import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']

export function isImageFile(filename = '', mime = '') {
  const name = String(filename).toLowerCase()
  const type = String(mime).toLowerCase()
  return IMAGE_EXT.some((ext) => name.endsWith(ext)) || type.startsWith('image/')
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `${bin} failed`))
      else resolve(stdout)
    })
  })
}

export async function ocrImage(buffer, filename = 'routine.png') {
  const ext = path.extname(filename).toLowerCase() || '.png'
  const input = path.join(os.tmpdir(), `su-ocr-${Date.now()}${ext}`)
  fs.writeFileSync(input, buffer)
  try {
    const text = await run('tesseract', [input, 'stdout', '--psm', '6', '-l', 'eng'])
    return String(text || '').trim()
  } finally {
    try { fs.unlinkSync(input) } catch {}
  }
}
