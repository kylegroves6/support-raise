// Generates icon-192.png and icon-512.png from scratch using pure Node.js
// Cru Deep Blue circle with white upward arrow
import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'

function generatePNG(size) {
  const bg = { r: 0, g: 115, b: 152 }   // #007398
  const fg = { r: 255, g: 255, b: 255 } // white
  const pixels = new Uint8Array(size * size * 4)

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2

  // Arrow geometry scaled to icon size
  const strokeW = size * 0.078   // ~40px at 512
  const arrowTop = size * 0.313  // ~160px at 512
  const arrowBot = size * 0.688  // ~352px at 512
  const arrowLeft = size * 0.313 // ~160px at 512
  const arrowRight = size * 0.688
  const arrowMid = size * 0.5

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > radius) {
        // Transparent outside circle
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0
        continue
      }

      // Default: background blue
      let r = bg.r, g = bg.g, b = bg.b

      // Vertical stem: x near center, y between arrowTop and arrowBot
      const onStem = Math.abs(x - arrowMid) <= strokeW / 2 && y >= arrowTop && y <= arrowBot

      // Chevron: two diagonal arms meeting at (arrowMid, arrowTop)
      // Left arm: from (arrowLeft, arrowMid) to (arrowMid, arrowTop)
      const leftArmDx = arrowMid - arrowLeft
      const leftArmDy = arrowTop - arrowMid  // negative (going up)
      const leftLen = Math.sqrt(leftArmDx * leftArmDx + leftArmDy * leftArmDy)
      const leftUx = leftArmDx / leftLen
      const leftUy = leftArmDy / leftLen
      const lPx = x - arrowLeft
      const lPy = y - arrowMid
      const lT = lPx * leftUx + lPy * leftUy
      const lPerp = Math.abs(lPx * (-leftUy) + lPy * leftUx)
      const onLeft = lT >= 0 && lT <= leftLen && lPerp <= strokeW / 2

      // Right arm: from (arrowMid, arrowTop) to (arrowRight, arrowMid)
      const rightArmDx = arrowRight - arrowMid
      const rightArmDy = arrowMid - arrowTop
      const rightLen = Math.sqrt(rightArmDx * rightArmDx + rightArmDy * rightArmDy)
      const rightUx = rightArmDx / rightLen
      const rightUy = rightArmDy / rightLen
      const rPx = x - arrowMid
      const rPy = y - arrowTop
      const rT = rPx * rightUx + rPy * rightUy
      const rPerp = Math.abs(rPx * (-rightUy) + rPy * rightUx)
      const onRight = rT >= 0 && rT <= rightLen && rPerp <= strokeW / 2

      if (onStem || onLeft || onRight) {
        r = fg.r; g = fg.g; b = fg.b
      }

      pixels[idx] = r; pixels[idx+1] = g; pixels[idx+2] = b; pixels[idx+3] = 255
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

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB (we'll handle alpha via RGBA → use type 6)
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  chunks.push(chunk('IHDR', ihdr))

  // IDAT — filter byte 0 before each row
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0  // filter type None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      raw[dst] = pixels[src]
      raw[dst+1] = pixels[src+1]
      raw[dst+2] = pixels[src+2]
      raw[dst+3] = pixels[src+3]
    }
  }
  chunks.push(chunk('IDAT', deflateSync(raw)))

  // IEND
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
