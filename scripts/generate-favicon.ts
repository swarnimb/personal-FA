/**
 * generate-favicon.ts
 *
 * Generates `public/favicon.ico` for the AmIBroke Finance Tracker — a
 * Velvet Ledger-styled coin glyph: bright emerald (`#10b981`) filled circle
 * with a darker emerald (`#0e6f51`) inner ring on a `#0e0e0e` background.
 *
 * The script is dependency-free — it relies only on Node's standard library
 * (`zlib`, `fs`, `path`, `url`). It synthesises three raw RGBA bitmaps (16×16,
 * 32×32, 48×48), encodes each as a PNG, then packs all three PNGs into a
 * single multi-resolution ICO file (PNG-format icon entries, supported by
 * every modern browser).
 *
 * Run with:
 *   npx tsx scripts/generate-favicon.ts
 *
 * Acceptance: the resulting file starts with the ICO magic bytes
 * (`00 00 01 00`), contains entries for 16/32/48 px, and is non-empty.
 *
 * Task 67 — Favicon fix. See `docs/plan.md`.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/* ------------------------------------------------------------------ */
/* Error class                                                         */
/* ------------------------------------------------------------------ */

/**
 * Thrown when favicon generation fails. Carries the failing operation so
 * the caller can surface context (per EH-05).
 */
export class FaviconGenerationError extends Error {
  public readonly operation: string

  constructor(operation: string, message: string, cause?: unknown) {
    super(`[favicon:${operation}] ${message}`)
    this.name = 'FaviconGenerationError'
    this.operation = operation
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

/* ------------------------------------------------------------------ */
/* Velvet Ledger palette                                               */
/* ------------------------------------------------------------------ */

/** Background — surface-lowest from `docs/design-decisions.md`. */
const BG: [number, number, number] = [0x0e, 0x0e, 0x0e]
/** Primary container — bright emerald for the coin face. */
const COIN: [number, number, number] = [0x10, 0xb9, 0x81]
/** Darker emerald — inner ring stroke for "coin" affordance. */
const RING: [number, number, number] = [0x0e, 0x6f, 0x51]

/* ------------------------------------------------------------------ */
/* CRC32 (PNG spec) — table-driven                                     */
/* ------------------------------------------------------------------ */

const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

/**
 * Compute CRC32 of a buffer per the PNG/ZIP spec.
 *
 * @param buf - bytes to checksum
 * @returns unsigned 32-bit CRC
 */
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/* ------------------------------------------------------------------ */
/* PNG chunk helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Build a single PNG chunk: 4-byte length, 4-byte type, payload, CRC32 of
 * type+payload.
 */
function pngChunk(type: string, payload: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(payload.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, payload])), 0)
  return Buffer.concat([len, typeBuf, payload, crcBuf])
}

/**
 * Encode a raw RGBA pixel buffer (size×size) into a PNG file (RGBA, 8-bit,
 * no interlace). Adds the PNG filter byte (0 = none) at the start of every
 * scanline before deflating, as the spec requires.
 */
function encodePng(size: number, rgba: Buffer): Buffer {
  if (rgba.length !== size * size * 4) {
    throw new FaviconGenerationError(
      'encodePng',
      `pixel buffer length ${rgba.length} does not match ${size}x${size}x4`,
    )
  }

  // Add scanline filter bytes.
  const filtered = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    filtered[y * (size * 4 + 1)] = 0 // filter type "None"
    rgba.copy(
      filtered,
      y * (size * 4 + 1) + 1,
      y * size * 4,
      (y + 1) * size * 4,
    )
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const idat = deflateSync(filtered, { level: 9 })

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ */
/* Coin glyph rasteriser                                               */
/* ------------------------------------------------------------------ */

/** Full-alpha opaque pixel; favicons never use transparency in this design. */
const OPAQUE_ALPHA = 255

/**
 * Pick the RGB color for one pixel of the coin glyph given its distance from
 * the centre and the ring-band radii. `inDisc` is the smoothstep AA weight at
 * the outer edge — used to blend the foreground colour towards the BG so the
 * coin edge doesn't show pixel-stair artefacts.
 *
 * - dist > outerR + 0.5  → background (outside the disc entirely)
 * - ring band            → darker emerald (`RING`)
 * - elsewhere inside     → bright emerald (`COIN`) — covers both the inner
 *                          face and the 1-pixel outer AA edge, which used to
 *                          be a duplicate branch.
 */
function coinPixelColor(
  dist: number,
  outerR: number,
  ringInnerR: number,
  inDisc: number,
): [number, number, number] {
  if (dist > outerR + 0.5) return BG
  const isRingBand = dist > ringInnerR && dist < outerR - 0.2
  const target = isRingBand ? RING : COIN
  return [
    blend(BG[0], target[0], inDisc),
    blend(BG[1], target[1], inDisc),
    blend(BG[2], target[2], inDisc),
  ]
}

/**
 * Draw the Velvet Ledger coin glyph into an RGBA buffer. The design:
 * - solid #0e0e0e background fills the canvas (so the icon reads on both
 *   dark and light browser-tab tints)
 * - bright emerald #10b981 filled disc centred, radius ≈ 42% of canvas
 * - inner darker-emerald #0e6f51 ring 1px wide (or 2px on 48 size)
 *
 * @param size - square pixel dimension (16, 32, 48)
 * @returns raw RGBA buffer of length size*size*4
 */
export function drawCoin(size: number): Buffer {
  const buf = Buffer.alloc(size * size * 4)
  const centre = (size - 1) / 2
  const outerR = size * 0.42
  const ringStroke = size >= 32 ? 2 : 1
  const ringInnerR = outerR - ringStroke * 1.5 + 0.5

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centre
      const dy = y - centre
      const dist = Math.sqrt(dx * dx + dy * dy)
      const inDisc = smoothstepAA(outerR, dist)
      const [r, g, b] = coinPixelColor(dist, outerR, ringInnerR, inDisc)
      const idx = (y * size + x) * 4
      buf[idx + 0] = r
      buf[idx + 1] = g
      buf[idx + 2] = b
      buf[idx + 3] = OPAQUE_ALPHA
    }
  }

  return buf
}

/**
 * Smooth 1-pixel antialiasing for the coin edge. Returns 1.0 inside,
 * 0.0 outside, with a linear ramp across the 1-pixel boundary.
 */
function smoothstepAA(radius: number, dist: number): number {
  const edge = dist - (radius - 0.5)
  if (edge <= 0) return 1
  if (edge >= 1) return 0
  return 1 - edge
}

/** Linear blend `a` (when t=0) towards `b` (when t=1). */
function blend(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)))
}

/* ------------------------------------------------------------------ */
/* ICO container                                                       */
/* ------------------------------------------------------------------ */

interface IconEntry {
  size: number
  png: Buffer
}

/**
 * Pack a set of PNG-format icon entries into an ICO file. Format:
 *   ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes per icon) + PNG data...
 *
 * @param entries - ordered list of icon sizes and their PNG bytes
 * @returns ICO file buffer
 */
export function packIco(entries: IconEntry[]): Buffer {
  if (entries.length === 0) {
    throw new FaviconGenerationError('packIco', 'no icon entries provided')
  }

  const headerSize = 6
  const entrySize = 16
  const dataOffset = headerSize + entrySize * entries.length

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = ICO
  header.writeUInt16LE(entries.length, 4) // image count

  const directory = Buffer.alloc(entrySize * entries.length)
  const dataChunks: Buffer[] = []
  let runningOffset = dataOffset

  entries.forEach((entry, i) => {
    const off = i * entrySize
    // Width/height: 0 means "256" per spec, otherwise the size.
    directory[off + 0] = entry.size === 256 ? 0 : entry.size
    directory[off + 1] = entry.size === 256 ? 0 : entry.size
    directory[off + 2] = 0 // colour palette count (0 = none)
    directory[off + 3] = 0 // reserved
    directory.writeUInt16LE(1, off + 4) // colour planes
    directory.writeUInt16LE(32, off + 6) // bits per pixel
    directory.writeUInt32LE(entry.png.length, off + 8) // image size
    directory.writeUInt32LE(runningOffset, off + 12) // image offset
    runningOffset += entry.png.length
    dataChunks.push(entry.png)
  })

  return Buffer.concat([header, directory, ...dataChunks])
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

/**
 * Generate `public/favicon.ico` at the given project root.
 *
 * @param projectRoot - absolute path to the project root
 * @returns absolute path to the written file and its byte length
 */
export function generateFavicon(projectRoot: string): {
  path: string
  bytes: number
} {
  const sizes = [16, 32, 48]
  const entries: IconEntry[] = sizes.map((size) => {
    try {
      const rgba = drawCoin(size)
      const png = encodePng(size, rgba)
      return { size, png }
    } catch (err) {
      throw new FaviconGenerationError(
        'rasterise',
        `failed at size ${size}`,
        err,
      )
    }
  })

  const ico = packIco(entries)
  const outPath = resolve(projectRoot, 'public', 'favicon.ico')

  try {
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, ico)
  } catch (err) {
    throw new FaviconGenerationError('write', `cannot write ${outPath}`, err)
  }

  if (!existsSync(outPath)) {
    throw new FaviconGenerationError(
      'verify',
      `wrote favicon but file does not exist at ${outPath}`,
    )
  }

  return { path: outPath, bytes: ico.length }
}

// Only auto-run when executed directly (e.g. `npx tsx scripts/generate-favicon.ts`),
// not when imported by a test. Use Node's `pathToFileURL` — manual string
// concatenation of `file://${argv[1]}` mis-handles Windows drive letters (`C:`
// gets parsed as host), so the comparison silently never matches.
import { pathToFileURL } from 'node:url'

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = resolve(here, '..')
  const result = generateFavicon(root)
  // eslint-disable-next-line no-console
  console.log(`wrote ${result.path} (${result.bytes} bytes)`)
}
