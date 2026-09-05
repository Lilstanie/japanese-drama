import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  buildRotation,
  planSegment,
  pickSituation,
  shuffle,
  SEGMENTS_PER_TOPIC,
  EXPLAIN_EVERY,
} from "@/lib/podcast-plan"
import { PODCAST_TOPICS } from "@/lib/podcast-topics"

const rotation = buildRotation(PODCAST_TOPICS)
const plan = (i: number) => planSegment(i, rotation)

describe("topic rotation", () => {
  test("includes every topic exactly once", () => {
    assert.equal(rotation.length, PODCAST_TOPICS.length)
    assert.equal(new Set(rotation.map((t) => t.id)).size, PODCAST_TOPICS.length)
  })

  test("avoids playing two topics of the same category back to back", () => {
    // Three 日常 topics in a row makes a drive feel like one endless
    // conversation, which is what rotation exists to prevent.
    const clashes = rotation
      .slice(1)
      .filter((t, i) => t.category === rotation[i]!.category)
    assert.equal(clashes.length, 0, `${clashes.length} same-category pairs`)
  })

  test("starts where the listener chose", () => {
    const r = buildRotation(PODCAST_TOPICS, "onsen")
    assert.equal(r[0]!.id, "onsen")
    assert.equal(r.length, PODCAST_TOPICS.length)
  })

  test("an unknown starting id still yields a full rotation", () => {
    const r = buildRotation(PODCAST_TOPICS, "does-not-exist")
    assert.equal(r.length, PODCAST_TOPICS.length)
  })

  test("advances after a fixed number of segments and wraps around", () => {
    assert.equal(plan(0).topic.id, rotation[0]!.id)
    assert.equal(plan(SEGMENTS_PER_TOPIC - 1).topic.id, rotation[0]!.id)
    assert.equal(plan(SEGMENTS_PER_TOPIC).topic.id, rotation[1]!.id)

    // A long drive must keep playing rather than run out of topics.
    const wrapped = SEGMENTS_PER_TOPIC * rotation.length
    assert.equal(plan(wrapped).topic.id, rotation[0]!.id)
  })

  test("flags the first segment of each topic so the car display can update", () => {
    assert.ok(plan(0).startsTopic)
    assert.ok(!plan(1).startsTopic)
    assert.ok(plan(SEGMENTS_PER_TOPIC).startsTopic)
  })
})

describe("speakers", () => {
  test("alternate, with Kenji in Japanese and Wei in Chinese", () => {
    for (let i = 0; i < 20; i++) {
      const s = plan(i)
      assert.equal(s.speaker, i % 2 === 0 ? "A" : "B")
      assert.equal(s.lang, s.speaker === "A" ? "ja" : "zh")
    }
  })
})

describe("Chinese explanations", () => {
  test("actually occur", () => {
    // Regression: the first version gated on `index % EXPLAIN_EVERY === 0`,
    // which only ever lands on Kenji's even indices, so no explanation could
    // ever play while still looking correct in review.
    const kinds = Array.from({ length: 24 }, (_, i) => plan(i).kind)
    assert.ok(kinds.includes("explain"), "no explanation in 24 segments")
  })

  test("only ever come from Wei", () => {
    // Kenji speaks no Chinese; an explanation from him would be voiced by a
    // Japanese voice reading Chinese text.
    for (let i = 0; i < 60; i++) {
      const s = plan(i)
      if (s.kind === "explain") {
        assert.equal(s.speaker, "B", `segment ${i}`)
        assert.equal(s.lang, "zh")
      }
    }
  })

  test("are spaced out rather than clustered", () => {
    const explains = Array.from({ length: 60 }, (_, i) => i).filter(
      (i) => plan(i).kind === "explain"
    )
    assert.ok(explains.length >= 8, `only ${explains.length} in 60 segments`)
    for (let i = 1; i < explains.length; i++) {
      assert.equal(
        explains[i]! - explains[i - 1]!,
        EXPLAIN_EVERY,
        "explanations should be evenly spaced"
      )
    }
  })

  test("never open a topic", () => {
    // Leading with an explanation before anything has been said explains nothing.
    for (let i = 0; i < 60; i++) {
      const s = plan(i)
      if (s.startsTopic) assert.equal(s.kind, "dialogue", `segment ${i}`)
    }
  })
})

describe("conversation moves", () => {
  test("every turn is given a job", () => {
    // Without one the only instruction is "be natural and short", and the
    // conversation collapses into 〜してみてね / 感想を聞かせて forever.
    for (let i = 0; i < 40; i++) {
      assert.ok(plan(i).move, `segment ${i} has no move`)
    }
  })

  test("a topic opens by opening and ends by closing", () => {
    assert.equal(plan(0).move, "open")
    assert.equal(plan(SEGMENTS_PER_TOPIC - 1).move, "close")
    assert.equal(plan(SEGMENTS_PER_TOPIC).move, "open")
  })

  test("includes moves that break agreement, not just extend it", () => {
    // Endless agreement is exactly how the loop starts; a topic needs at least
    // one turn whose job is to push back or change direction.
    const moves = Array.from({ length: SEGMENTS_PER_TOPIC }, (_, i) => plan(i).move)
    assert.ok(moves.includes("disagree"), "no disagreement in a whole topic")
    assert.ok(moves.includes("shift"), "no change of angle in a whole topic")
  })

  test("does not repeat the same move twice in a row", () => {
    for (let i = 1; i < 40; i++) {
      assert.notEqual(plan(i).move, plan(i - 1).move, `segments ${i - 1}/${i}`)
    }
  })

  test("asks often enough to keep the other speaker involved", () => {
    const asks = Array.from({ length: SEGMENTS_PER_TOPIC }, (_, i) => plan(i).move)
      .filter((m) => m === "ask").length
    assert.ok(asks >= 2, `only ${asks} questions per topic`)
  })
})

describe("variation between sessions", () => {
  // Sampling temperature varies word choice; it cannot vary the frame. These
  // cover the inputs that do.

  test("a situation always has all three parts", () => {
    for (let i = 0; i < 50; i++) {
      const s = pickSituation()
      assert.ok(s.season && s.setting && s.mood, "incomplete situation")
    }
  })

  test("situations actually differ across runs", () => {
    const seen = new Set(
      Array.from({ length: 60 }, () => JSON.stringify(pickSituation()))
    )
    assert.ok(seen.size > 20, `only ${seen.size} distinct situations in 60 draws`)
  })

  test("a seeded random makes situations reproducible", () => {
    // Deterministic when it needs to be — otherwise this suite could not
    // assert anything about it.
    const seeded = () => { let n = 42; return () => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648 }
    assert.deepEqual(pickSituation(seeded()), pickSituation(seeded()))
  })

  test("shuffle keeps every item exactly once", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(xs)
    assert.equal(out.length, xs.length)
    assert.deepEqual([...out].sort((a, b) => a - b), xs)
  })

  test("shuffle does not mutate its input", () => {
    const xs = [1, 2, 3, 4, 5]
    const copy = [...xs]
    shuffle(xs)
    assert.deepEqual(xs, copy)
  })

  test("a shuffled rotation still satisfies the category rule", () => {
    // Shuffling must not undo the thing rotation exists to do.
    for (let i = 0; i < 20; i++) {
      const r = buildRotation(shuffle(PODCAST_TOPICS))
      const clashes = r.slice(1).filter((t, j) => t.category === r[j]!.category)
      assert.equal(clashes.length, 0, `run ${i}: ${clashes.length} same-category pairs`)
    }
  })
})

describe("topics", () => {
  test("every topic has a concrete scene to work from", () => {
    // A vague seed produces vague small talk, which is what makes a generated
    // podcast tiring to listen to.
    for (const t of PODCAST_TOPICS) {
      assert.ok(t.seed.length > 40, `${t.id} seed is too thin`)
      assert.ok(t.labelZh && t.emoji && t.category, `${t.id} missing metadata`)
    }
  })

  test("ids are unique", () => {
    assert.equal(new Set(PODCAST_TOPICS.map((t) => t.id)).size, PODCAST_TOPICS.length)
  })

  test("there is enough material for a long drive", () => {
    const minutes = (PODCAST_TOPICS.length * SEGMENTS_PER_TOPIC * 6) / 60
    assert.ok(minutes >= 25, `only ~${Math.round(minutes)} minutes before repeating`)
  })
})
