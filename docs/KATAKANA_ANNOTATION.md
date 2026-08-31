# Katakana Loanword Annotation

Most katakana in modern Japanese is 外来語 — words borrowed from English and other
European languages. A learner who can read the kana still has to sound out
`コンビニ` before recognising "convenience store". This feature puts the source
word directly above the katakana, the same way furigana puts a reading above a
kanji.

```
      convenience (store)        iced coffee
近(ちか)くの  コンビニ  で   アイスコーヒー  を買(か)いました。
```

Two annotation layers now coexist on the same line, distinguished by colour:

| Layer | Colour | Sits above |
|-------|--------|------------|
| Furigana reading | amber `#f59e0b` | kanji |
| Loanword source word | teal `#5eead4` | katakana |

Toggle the English layer with the **ABC** button in the scene and podcast
headers. The choice persists in `localStorage`.

## Why not `<ruby>`

Ruby text does not reserve layout width. `convenience store` is roughly three
times as wide as `コンビニ`, so as ruby it overhangs its base and collides with
whatever text sits next to it — and `ruby-overhang` is not reliably supported.

Instead each annotated term renders as an inline-block that reserves the width
of whichever of its two lines is wider, and centres both:

```html
<span class="kt">
  <span class="kt-en">convenience (store)</span>
  <span class="kt-ja"><span class="kt-mark">コンビニ</span></span>
</span>
```

The alignment property that makes this work: an inline-block's baseline is the
baseline of its **last** line box — `.kt-ja`. So the katakana sits exactly on the
surrounding text's baseline, with the gloss floating above it just like a ruby
reading, while the reserved width makes overlap impossible. When a gloss is
wider than its term, the line box grows rather than letting anything clip.

`.kt-mark` draws a dotted underline under the katakana itself, so it stays clear
which characters a wide gloss belongs to.

## Resolving a source word

Three layers, cheapest first:

1. **Static dictionary** — `lib/katakana-dict.ts`, ~280 entries weighted toward
   this app's scenarios (convenience store, izakaya, station, ski resort).
   Synchronous, offline, zero latency. Entries carry `src` when the origin is not
   English, so ゲレンデ reads `Gelände (slope)` rather than a wrong English guess.
2. **`NON_LOANWORDS` blocklist** — onomatopoeia (`ドキドキ`), native words written
   in katakana for emphasis (`ヤバイ`), script names. These are never annotated,
   and never sent to the model.
3. **On-demand model lookup** — `POST /api/katakana/gloss` for anything the
   dictionary misses. Batched (max 12 terms, 400 ms window), cached in
   `localStorage` on the client and in-process on the server.

### Segmentation

A katakana run is segmented by searching for a cover of the **whole** run, not by
scanning greedily left to right.

Greedy scanning shreds unknown compounds on any interior word it recognises:
`ジェットコースター` becomes `ジェット` + `コース`("course") + `ター`, which is wrong
and sends meaningless fragments to the API. Requiring a full cover means a run
either segments cleanly into known loanwords or is passed to the model whole:

| Input | Result |
|-------|--------|
| `アイスコーヒー` | `アイスコーヒー` → "iced coffee" (fewest terms wins over アイス + コーヒー) |
| `ジェットコースター` | no cover → one model lookup → "jet coaster" |
| `コーヒーゼリー` | no cover → one model lookup → "coffee jelly" |
| `ドキドキ` | blocklisted → never annotated |

## API

### `POST /api/katakana/gloss`

```json
{ "terms": ["ジェットコースター", "コンビニ", "ドキドキ"] }
```

```json
{
  "glosses": {
    "ジェットコースター": "jet coaster",
    "コンビニ": "convenience (store)",
    "ドキドキ": null
  },
  "source": "model"
}
```

`null` means "looked up, not a loanword" — a real answer, cached so the term is
never requested again.

`source` matters for caching:

| `source` | Meaning | Client behaviour |
|----------|---------|------------------|
| `dictionary` | Answered without the model | Cache everything, including absent terms as `null` |
| `model` | Model was consulted | Same |
| `partial` | Model call **failed** | Cache only what came back; retry the rest later |

Without `partial`, a transient provider outage would permanently cache "not a
loanword" for every term in the failed batch.

Non-katakana input, terms shorter than 2 characters, and anything past the
12-term cap are dropped by validation before reaching the model.

## Streaming

`<JapaneseText isStreaming />` suppresses model lookups while text is still
arriving — a half-typed `コーヒ` is not a word and must not be sent to the API.
Dictionary glosses still render live, so a partial `アイス` may briefly read
"ice" before settling on "iced coffee" once `アイスコーヒー` completes.

## File map

| Path | Role |
|------|------|
| `lib/katakana-dict.ts` | Loanword dictionary + non-loanword blocklist |
| `lib/katakana.ts` | Run detection, full-cover segmentation |
| `lib/japanese-text.ts` | Combines the furigana and katakana layers in one pass |
| `components/JapaneseText.tsx` | Renderer for both layers |
| `components/AnnotationProvider.tsx` | Toggle state, gloss cache, request batching |
| `components/KatakanaToggle.tsx` | ABC show/hide button |
| `app/api/katakana/gloss/route.ts` | Dictionary + model lookup endpoint |
| `app/globals.css` | `.kt` / `.kt-en` / `.kt-ja` / `.kt-mark` |

## Extending the dictionary

Add to `KATAKANA_DICT` in `lib/katakana-dict.ts`. Keep glosses to three words or
fewer — the gloss sets the width of the annotation box, and a long one leaves a
visible gap around a short term. For non-English origins set `src` and write the
value as `Original (english meaning)`.

Compounds do not need their parts spelled out separately if the parts are already
present; the segmenter prefers the fewest-terms cover, so a compound entry wins
automatically when you add one.
