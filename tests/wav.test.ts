import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseWav, concatWav, durationOf, silence, type WavFormat } from "@/lib/wav"

const FORMAT: WavFormat = { channels: 1, sampleRate: 48000, bitsPerSample: 16 }

/** A valid WAV of `seconds`, filled with a recognisable byte. */
function makeWav(seconds: number, fill = 0, format: WavFormat = FORMAT): Uint8Array {
  const bytes =
    Math.round(seconds * format.sampleRate) * format.channels * (format.bitsPerSample / 8)
  const out = new Uint8Array(44 + bytes).fill(fill, 44)
  const view = new DataView(out.buffer)
  const w = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i)
  }
  const frame = format.channels * (format.bitsPerSample / 8)
  w(0, "RIFF"); view.setUint32(4, 36 + bytes, true); w(8, "WAVE")
  w(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, format.channels, true)
  view.setUint32(24, format.sampleRate, true)
  view.setUint32(28, format.sampleRate * frame, true)
  view.setUint16(32, frame, true)
  view.setUint16(34, format.bitsPerSample, true)
  w(36, "data"); view.setUint32(40, bytes, true)
  return out
}

describe("parsing", () => {
  test("reads the format", () => {
    const { format } = parseWav(makeWav(0.5))
    assert.deepEqual(format, FORMAT)
  })

  test("finds data past an intervening chunk", () => {
    // Camb puts a LIST/INFO chunk between fmt and data, so the offset of `data`
    // cannot be assumed.
    const base = makeWav(0.1, 7)
    const { pcm: expected } = parseWav(base)

    const list = new Uint8Array(8 + 26)
    const lv = new DataView(list.buffer)
    for (let i = 0; i < 4; i++) list[i] = "LIST".charCodeAt(i)
    lv.setUint32(4, 26, true)

    const withList = new Uint8Array(base.byteLength + list.byteLength)
    withList.set(base.subarray(0, 36), 0)
    withList.set(list, 36)
    withList.set(base.subarray(36), 36 + list.byteLength)
    new DataView(withList.buffer).setUint32(4, withList.byteLength - 8, true)

    assert.equal(parseWav(withList).pcm.byteLength, expected.byteLength)
  })

  test("treats 0xFFFFFFFF as 'rest of file'", () => {
    // Camb declares exactly this, being a streaming response. Trusting the
    // field would read far past the buffer.
    const w = makeWav(0.25)
    new DataView(w.buffer).setUint32(40, 0xffffffff, true)
    assert.equal(parseWav(w).pcm.byteLength, w.byteLength - 44)
  })

  test("clamps a data size that overruns the file", () => {
    const w = makeWav(0.1)
    new DataView(w.buffer).setUint32(40, 999_999, true)
    assert.equal(parseWav(w).pcm.byteLength, w.byteLength - 44)
  })

  test("rejects input that is not a WAV", () => {
    assert.throws(() => parseWav(new Uint8Array(64)), /RIFF/)
    assert.throws(() => parseWav(new Uint8Array(4)), /RIFF/)
  })
})

describe("concatenating", () => {
  test("keeps every sample", () => {
    const clips = [makeWav(1), makeWav(0.5), makeWav(2)]
    const { wav } = concatWav(clips)
    const expected = clips.reduce((n, c) => n + (c.byteLength - 44), 0)
    assert.equal(wav.byteLength - 44, expected)
  })

  test("produces a WAV that parses back correctly", () => {
    // The output is handed to the browser as audio; a header that only looks
    // right is the failure mode to guard against.
    const { wav } = concatWav([makeWav(1), makeWav(1)])
    const round = parseWav(wav)
    assert.deepEqual(round.format, FORMAT)
    assert.equal(round.pcm.byteLength, wav.byteLength - 44)
  })

  test("declares honest sizes in the header", () => {
    const { wav } = concatWav([makeWav(0.5), makeWav(0.5)])
    const view = new DataView(wav.buffer)
    assert.equal(view.getUint32(4, true), wav.byteLength - 8, "RIFF size wrong")
    assert.equal(view.getUint32(40, true), wav.byteLength - 44, "data size wrong")
  })

  test("reports where each clip starts", () => {
    // These offsets are what keeps the transcript in sync once many clips play
    // as a single audio element.
    const { offsets, duration } = concatWav([makeWav(1), makeWav(2), makeWav(0.5)])
    assert.deepEqual(offsets.map((o) => Math.round(o * 1000)), [0, 1000, 3000])
    assert.equal(Math.round(duration * 1000), 3500)
  })

  test("preserves clip contents in order", () => {
    const { wav, offsets } = concatWav([makeWav(0.1, 11), makeWav(0.1, 22)])
    const pcm = parseWav(wav).pcm
    const secondStart = Math.round(offsets[1]! * 48000) * 2
    assert.equal(pcm[0], 11, "first clip not at the start")
    assert.equal(pcm[secondStart], 22, "second clip not at its offset")
  })

  test("refuses to mix sample rates", () => {
    // Splicing 24kHz into 48kHz plays at the wrong pitch rather than failing,
    // which would be a confusing bug to chase from a car.
    const other = { ...FORMAT, sampleRate: 24000 }
    assert.throws(
      () => concatWav([makeWav(1), makeWav(1, 0, other)]),
      /24000Hz/
    )
  })

  test("refuses to mix channel counts", () => {
    const stereo = { ...FORMAT, channels: 2 }
    assert.throws(() => concatWav([makeWav(1), makeWav(1, 0, stereo)]), /expected/)
  })

  test("rejects an empty list", () => {
    assert.throws(() => concatWav([]), /nothing to concatenate/)
  })

  test("a single clip round-trips unchanged", () => {
    const one = makeWav(1.5, 9)
    const { wav, offsets } = concatWav([one])
    assert.deepEqual(offsets, [0])
    assert.equal(parseWav(wav).pcm.byteLength, one.byteLength - 44)
  })
})

describe("silence", () => {
  test("has the requested duration", () => {
    const s = silence(FORMAT, 0.4)
    assert.equal(Math.round(durationOf(FORMAT, s.byteLength - 44) * 1000), 400)
  })

  test("is actually silent and splices in cleanly", () => {
    const gap = silence(FORMAT, 0.2)
    assert.ok(parseWav(gap).pcm.every((b) => b === 0), "not zero-filled")

    const { offsets } = concatWav([makeWav(1), gap, makeWav(1)])
    assert.deepEqual(offsets.map((o) => Math.round(o * 1000)), [0, 1000, 1200])
  })
})

describe("duration", () => {
  test("matches the format's byte rate", () => {
    // 48kHz mono 16-bit = 96000 bytes per second.
    assert.equal(durationOf(FORMAT, 96000), 1)
    assert.equal(durationOf(FORMAT, 0), 0)
  })
})
