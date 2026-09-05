import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { buildEpisode, segmentAt, GAP_SECONDS, type BuildDeps } from "@/lib/podcast-episode"
import { buildRotation, pickSituation } from "@/lib/podcast-plan"
import { PODCAST_TOPICS } from "@/lib/podcast-topics"
import { parseWav, durationOf } from "@/lib/wav"

const rotation = buildRotation(PODCAST_TOPICS)
const situationFor = () => pickSituation()

/** A valid WAV of `seconds` — stands in for a TTS response. */
function wav(seconds: number, sampleRate = 48000): ArrayBuffer {
  const bytes = Math.round(seconds * sampleRate) * 2
  const out = new Uint8Array(44 + bytes)
  const view = new DataView(out.buffer)
  const w = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i)
  }
  w(0, "RIFF"); view.setUint32(4, 36 + bytes, true); w(8, "WAVE")
  w(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  w(36, "data"); view.setUint32(40, bytes, true)
  return out.buffer
}

const deps = (over: Partial<BuildDeps> = {}): BuildDeps => ({
  fetchText: async (p) => `line ${p.index}`,
  fetchAudio: async () => wav(2),
  ...over,
})

describe("building an episode", () => {
  test("returns one audio file covering every segment", async () => {
    // The whole point: one file the browser can play while backgrounded,
    // instead of a queue that needs JS between clips.
    const ep = await buildEpisode({ startIndex: 0, count: 4, rotation, situationFor }, deps())
    assert.ok(ep)
    assert.equal(ep!.segments.length, 4)
    assert.equal(ep!.audio.type, "audio/wav")
    assert.ok(ep!.audio.size > 0)
  })

  test("segment offsets account for the gaps between speakers", async () => {
    const ep = await buildEpisode({ startIndex: 0, count: 3, rotation, situationFor }, deps())
    const starts = ep!.segments.map((s) => Number(s.startSec.toFixed(2)))
    // 2s clip, 0.45s gap, 2s clip, 0.45s gap, 2s clip
    assert.deepEqual(starts, [0, 2 + GAP_SECONDS, 2 * (2 + GAP_SECONDS)])
  })

  test("duration matches the audio actually produced", async () => {
    // A mismatch here desynchronises the transcript from the sound.
    const ep = await buildEpisode({ startIndex: 0, count: 3, rotation, situationFor }, deps())
    const parsed = parseWav(new Uint8Array(await ep!.audio.arrayBuffer()))
    const real = durationOf(parsed.format, parsed.pcm.byteLength)
    assert.ok(Math.abs(real - ep!.duration) < 0.01, `${real} vs ${ep!.duration}`)
  })

  test("tells the caller where to resume", async () => {
    const ep = await buildEpisode({ startIndex: 24, count: 6, rotation, situationFor }, deps())
    assert.equal(ep!.nextIndex, 30)
  })

  test("carries the plan through, so explanations stay marked", async () => {
    const ep = await buildEpisode({ startIndex: 0, count: 12, rotation, situationFor }, deps())
    assert.ok(ep!.segments.some((s) => s.kind === "explain"))
    assert.ok(ep!.segments.every((s) => s.text.length > 0))
  })
})

describe("failures degrade instead of aborting", () => {
  test("a line that fails to generate costs a sentence, not the episode", async () => {
    // On a drive, losing the rest of the episode to one bad line is the worst
    // possible outcome.
    let n = 0
    const ep = await buildEpisode(
      { startIndex: 0, count: 5, rotation, situationFor },
      deps({ fetchText: async (p) => (++n === 2 ? null : `line ${p.index}`) })
    )
    assert.equal(ep!.segments.length, 4)
  })

  test("a line that fails to synthesise is dropped too", async () => {
    let n = 0
    const ep = await buildEpisode(
      { startIndex: 0, count: 5, rotation, situationFor },
      deps({ fetchAudio: async () => (++n === 3 ? null : wav(1)) })
    )
    assert.equal(ep!.segments.length, 4)
  })

  test("returns null only when nothing could be produced", async () => {
    const ep = await buildEpisode(
      { startIndex: 0, count: 4, rotation, situationFor },
      deps({ fetchText: async () => null })
    )
    assert.equal(ep, null)
  })

  test("returns null for audio that cannot be spliced", async () => {
    // ElevenLabs returns MP3, which cannot be concatenated this way — the
    // caller must fall back to per-clip playback rather than play noise.
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4]).buffer
    const ep = await buildEpisode(
      { startIndex: 0, count: 2, rotation, situationFor },
      deps({ fetchAudio: async () => mp3 })
    )
    assert.equal(ep, null)
  })

  test("mismatched sample rates are refused rather than pitch-shifted", async () => {
    let n = 0
    const ep = await buildEpisode(
      { startIndex: 0, count: 3, rotation, situationFor },
      deps({ fetchAudio: async () => wav(1, ++n === 2 ? 24000 : 48000) })
    )
    assert.equal(ep, null)
  })
})

describe("the caller can tell splicing apart from real failure", () => {
  // The player falls back to per-line playback on null, so null must mean
  // "cannot splice" and not be confused with "provider is down" — both return
  // null, and both should degrade the same way rather than stop dead.
  test("null is returned for unsplitable audio, not thrown", async () => {
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer
    await assert.doesNotReject(async () => {
      const ep = await buildEpisode(
        { startIndex: 0, count: 2, rotation, situationFor },
        deps({ fetchAudio: async () => mp3 })
      )
      assert.equal(ep, null)
    })
  })

  test("null is returned when synthesis is unavailable, not thrown", async () => {
    await assert.doesNotReject(async () => {
      const ep = await buildEpisode(
        { startIndex: 0, count: 2, rotation, situationFor },
        deps({ fetchAudio: async () => null })
      )
      assert.equal(ep, null)
    })
  })
})

describe("cancellation", () => {
  test("stops early when the listener pauses", async () => {
    let made = 0
    const ep = await buildEpisode(
      { startIndex: 0, count: 12, rotation, situationFor },
      deps({
        fetchText: async (p) => { made++; return `line ${p.index}` },
        shouldContinue: () => made < 3,
      })
    )
    assert.ok(ep!.segments.length < 12, "kept generating after cancellation")
    assert.ok(made <= 4, `generated ${made} segments after being told to stop`)
  })
})

describe("locating the current segment", () => {
  test("maps a playback position back to a line", async () => {
    // This is what keeps the transcript in sync now that many segments play as
    // a single audio element.
    const ep = await buildEpisode({ startIndex: 0, count: 3, rotation, situationFor }, deps())
    const segs = ep!.segments
    assert.equal(segmentAt(segs, 0)!.index, segs[0]!.index)
    assert.equal(segmentAt(segs, 1.9)!.index, segs[0]!.index)
    assert.equal(segmentAt(segs, 2.5)!.index, segs[1]!.index)
    assert.equal(segmentAt(segs, 99)!.index, segs[2]!.index)
  })

  test("handles a position before the first segment", () => {
    assert.equal(segmentAt([], 0), null)
  })
})
