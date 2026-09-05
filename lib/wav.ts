/**
 * Splicing WAV clips into one.
 *
 * The podcast generates a line at a time, but playing a queue of clips needs JS
 * to run between them — and a backgrounded tab has its timers throttled, so
 * playback stops as soon as the screen locks. A browser will play *one* long
 * audio element in the background quite happily, so a topic's clips are joined
 * into a single file and handed over as one.
 *
 * Camb returns uncompressed PCM, which makes this a matter of concatenating the
 * sample data and writing one correct header. It does not work for a compressed
 * format like MP3, so callers must fall back to per-clip playback there.
 */

export type WavFormat = {
  channels: number
  sampleRate: number
  bitsPerSample: number
}

export type ParsedWav = {
  format: WavFormat
  /** Raw sample data, header stripped. */
  pcm: Uint8Array
}

const ascii = (b: Uint8Array, at: number) =>
  String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!)

/**
 * Read a WAV's format and sample data.
 *
 * Walks the chunk list rather than assuming `data` sits at a fixed offset —
 * Camb puts a LIST/INFO chunk before it. A `data` size of 0xFFFFFFFF means
 * "streaming, length unknown", so the rest of the file is taken instead of
 * trusting the field.
 */
export function parseWav(bytes: Uint8Array): ParsedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (bytes.byteLength < 12 || ascii(bytes, 0) !== "RIFF" || ascii(bytes, 8) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file")
  }

  let format: WavFormat | null = null
  let pcm: Uint8Array | null = null
  let i = 12

  while (i + 8 <= bytes.byteLength) {
    const id = ascii(bytes, i)
    const declared = view.getUint32(i + 4, true)
    const body = i + 8

    if (id === "fmt ") {
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      }
    } else if (id === "data") {
      const available = bytes.byteLength - body
      // 0xFFFFFFFF is the streaming sentinel Camb sends, and a size past the
      // end of the buffer is equally untrustworthy. subarray() would clamp
      // either case on its own, so this is explicit rather than load-bearing —
      // it keeps the intent visible if `size` is ever used for an allocation,
      // where over-reading would not be caught for free.
      const size = declared === 0xffffffff ? available : Math.min(declared, available)
      pcm = bytes.subarray(body, body + size)
      break
    }

    if (declared === 0xffffffff) break
    i = body + declared + (declared % 2) // chunks are word-aligned
  }

  if (!format) throw new Error("WAV has no fmt chunk")
  if (!pcm) throw new Error("WAV has no data chunk")
  return { format, pcm }
}

const sameFormat = (a: WavFormat, b: WavFormat) =>
  a.channels === b.channels &&
  a.sampleRate === b.sampleRate &&
  a.bitsPerSample === b.bitsPerSample

/** Seconds of audio in `byteLength` bytes of this format. */
export function durationOf(format: WavFormat, byteLength: number): number {
  const bytesPerSecond =
    format.sampleRate * format.channels * (format.bitsPerSample / 8)
  return bytesPerSecond > 0 ? byteLength / bytesPerSecond : 0
}

export type ConcatResult = {
  wav: Uint8Array
  /** Start time of each input clip, in seconds — for highlighting the transcript. */
  offsets: number[]
  duration: number
}

/**
 * Join clips into one WAV, keeping where each began.
 *
 * The offsets are what let a single audio element still drive a per-line
 * transcript: the player maps `currentTime` back to a line.
 *
 * Clips must share a format. Mixing sample rates would play at the wrong pitch
 * rather than fail, so a mismatch throws.
 */
export function concatWav(clips: Uint8Array[]): ConcatResult {
  if (clips.length === 0) throw new Error("nothing to concatenate")

  const parsed = clips.map(parseWav)
  const format = parsed[0]!.format

  for (const [i, p] of parsed.entries()) {
    if (!sameFormat(p.format, format)) {
      throw new Error(
        `clip ${i} is ${p.format.sampleRate}Hz/${p.format.channels}ch, expected ${format.sampleRate}Hz/${format.channels}ch`
      )
    }
  }

  const offsets: number[] = []
  let running = 0
  for (const p of parsed) {
    offsets.push(durationOf(format, running))
    running += p.pcm.byteLength
  }

  const HEADER = 44
  const out = new Uint8Array(HEADER + running)
  const view = new DataView(out.buffer)
  const write = (at: number, s: string) => {
    for (let k = 0; k < s.length; k++) out[at + k] = s.charCodeAt(k)
  }

  const bytesPerFrame = format.channels * (format.bitsPerSample / 8)

  write(0, "RIFF")
  view.setUint32(4, 36 + running, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true)          // PCM fmt chunk size
  view.setUint16(20, 1, true)           // format 1 = PCM
  view.setUint16(22, format.channels, true)
  view.setUint32(24, format.sampleRate, true)
  view.setUint32(28, format.sampleRate * bytesPerFrame, true) // byte rate
  view.setUint16(32, bytesPerFrame, true)
  view.setUint16(34, format.bitsPerSample, true)
  write(36, "data")
  view.setUint32(40, running, true)

  let at = HEADER
  for (const p of parsed) {
    out.set(p.pcm, at)
    at += p.pcm.byteLength
  }

  return { wav: out, offsets, duration: durationOf(format, running) }
}

/** Silence of `seconds`, for a pause between speakers. */
export function silence(format: WavFormat, seconds: number): Uint8Array {
  const bytes = Math.max(
    0,
    Math.round(seconds * format.sampleRate) *
      format.channels *
      (format.bitsPerSample / 8)
  )
  const HEADER = 44
  const out = new Uint8Array(HEADER + bytes)
  const view = new DataView(out.buffer)
  const write = (at: number, s: string) => {
    for (let k = 0; k < s.length; k++) out[at + k] = s.charCodeAt(k)
  }
  const bytesPerFrame = format.channels * (format.bitsPerSample / 8)

  write(0, "RIFF")
  view.setUint32(4, 36 + bytes, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, format.channels, true)
  view.setUint32(24, format.sampleRate, true)
  view.setUint32(28, format.sampleRate * bytesPerFrame, true)
  view.setUint16(32, bytesPerFrame, true)
  view.setUint16(34, format.bitsPerSample, true)
  write(36, "data")
  view.setUint32(40, bytes, true)
  // Zero-filled: silence for signed PCM.
  return out
}
