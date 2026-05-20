// Generates icon-192.png and icon-512.png
// Solid blue square (maskable-safe) with a white upward arrow polygon
// Square background is required for maskable icons — Android/iOS apply their own mask shape
import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'

function generatePNG(size) {
  const bg = { r: 0, g: 115, b: 152 }   // #007398 Cru Deep Blue
  const fg = { r: 255, g: 255, b: 255 } // white

  const pixels = new Uint8Array(size * size * 4)

  // Fill entire square with blue (no transparency — maskable icons must have full bleed)
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4]     = bg.r
    pixels[i * 4 + 1] = bg.g
    pixels[i * 4 + 2] = bg.b
    pixels[i * 4 + 3] = 255
  }

  // Arrow as a filled polygon (upward pointing)
  // Safe zone for maskable: keep content within inner 60% (20% inset each side)
  // Arrow geometry — scaled from a 100-unit reference:
  //   Arrow occupies roughly 40% of the safe zone width/height
  //   Tip at top-center, base at bottom with left/right wings
  const s = size

  // Polygon vertices for a clean upward arrow (chevron + stem as one shape)
  // Using fraction of total size. Safe zone is 0.2–0.8 (60% of size).
  // Arrow fits within 0.28–0.72 horizontally, 0.22–0.72 vertically.
  const pts = [
    [0.50, 0.22],  // tip (top center)
    [0.72, 0.48],  // right wing outer
    [0.60, 0.48],  // right wing inner
    [0.60, 0.72],  // bottom right
    [0.40, 0.72],  // bottom left
    [0.40, 0.48],  // left wing inner
    [0.28, 0.48],  // left wing outer
  ].map(([fx, fy]) => [fx * s, fy * s])

  // Rasterize polygon using scanline fill
  for (let y = 0; y < s; y++) {
    const intersections = []
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[(i + 1) % n]
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        const t = (y - y0) / (y1 - y0)
        intersections.push(x0 + t * (x1 - x0))
      }
    }
    intersections.sort((a, b) => a - b)
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.ceil(intersections[i])
      const xEnd = Math.floor(intersections[i + 1])
      for (let x = xStart; x <= xEnd; x++) {
        const idx = (y * s + x) * 4
        pixels[idx]     = fg.r
        pixels[idx + 1] = fg.g
        pixels[idx + 2] = fg.b
        pixels[idx + 3] = 255
      }
    }
  }

  // Encode as PNG
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
    const crcInput = Buffer.concat([typeBytes, data])
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcInput))
    return Buffer.concat([len, typeBytes, data, crcVal])
  }

  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  chunks.push(chunk('IHDR', ihdr))

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      raw[dst]     = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
      raw[dst + 3] = pixels[src + 3]
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
