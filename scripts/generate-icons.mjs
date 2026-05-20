// Generates icon-192.png and icon-512.png
// Solid blue square (maskable-safe) with white chevron+stem arrow
import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'

function generatePNG(size) {
  const bg = { r: 0, g: 115, b: 152 }
  const fg = { r: 255, g: 255, b: 255 }
  const pixels = new Uint8Array(size * size * 4)

  // Full-bleed blue square (Android/iOS mask to their shape)
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4]     = bg.r
    pixels[i * 4 + 1] = bg.g
    pixels[i * 4 + 2] = bg.b
    pixels[i * 4 + 3] = 255
  }

  const s = size
  const strokeW = s * 0.09

  // Safe zone inset 20% each side → content between 0.2–0.8
  // Arrow centered in safe zone
  const tipX     = s * 0.50
  const tipY     = s * 0.22   // top of chevron (the point)
  const midY     = s * 0.45   // where wings meet stem
  const botY     = s * 0.80   // bottom of stem (taller)
  const wingX    = s * 0.27   // outer x of each wing tip
  const crossY   = s * 0.63   // crossbar — lower third of stem
  const crossX   = s * 0.27   // crossbar extends same width as wings

  // Helper: signed distance from point (px,py) to line segment (ax,ay)→(bx,by)
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(px - ax, py - ay)
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  }

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const idx = (y * s + x) * 4

      // Vertical stem: chevron join down to bottom
      const onStem = distToSegment(x, y, tipX, midY, tipX, botY) <= strokeW / 2

      // Left arm: from left wing tip to arrow tip
      const onLeft = distToSegment(x, y, wingX, midY, tipX, tipY) <= strokeW / 2

      // Right arm: from arrow tip to right wing tip
      const onRight = distToSegment(x, y, tipX, tipY, s - wingX, midY) <= strokeW / 2

      // Horizontal crossbar (makes stem a cross)
      const onCross = distToSegment(x, y, crossX, crossY, s - crossX, crossY) <= strokeW / 2

      if (onStem || onLeft || onRight || onCross) {
        pixels[idx]     = fg.r
        pixels[idx + 1] = fg.g
        pixels[idx + 2] = fg.b
        pixels[idx + 3] = 255
      }
    }
  }

  // PNG encode
  const chunks = []

  function crc32(buf) {
    let crc = 0xFFFFFFFF
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256)
      for (let i = 0; i < 256; i++) {
        let c = i
        for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
        t[i] = c
      }
      return t
    })())
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
    return Buffer.concat([len, typeBytes, data, crcVal])
  }

  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  chunks.push(chunk('IHDR', ihdr))

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]
      raw[dst+2] = pixels[src+2]; raw[dst+3] = pixels[src+3]
    }
  }
  chunks.push(chunk('IDAT', deflateSync(raw)))
  chunks.push(chunk('IEND', Buffer.alloc(0)))

  return Buffer.concat(chunks)
}

for (const size of [192, 512]) {
  const png = generatePNG(size)
  const path = `public/icon-${size}.png`
  const ws = createWriteStream(path)
  ws.write(png)
  ws.end()
  console.log(`Written ${path} (${png.length} bytes)`)
}
