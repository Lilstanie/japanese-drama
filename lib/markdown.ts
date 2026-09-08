/**
 * A tiny, tolerant Markdown parser for the coach panel.
 *
 * The coach is a free-form LLM that answers in GitHub-flavoured Markdown —
 * headings, bold, bullet/number lists, pipe tables, horizontal rules — with
 * furigana markup (漢字(かな)) mixed into the Japanese. The panel used to dump
 * that as raw text, so every `###`, `**` and `|` showed literally and the ruby
 * stacked oddly.
 *
 * This produces a small block AST that the renderer turns into real elements,
 * leaving plain text (including furigana/katakana markup) untouched so
 * JapaneseText can still annotate it. Two properties matter more than
 * completeness:
 *
 *   - It never throws. Coach text arrives token by token while streaming, so
 *     the parser sees half-written tables and unclosed `**`; those degrade to
 *     literal text rather than an error.
 *   - It only handles the subset the coach actually emits. A full CommonMark
 *     implementation would be a dependency and far more surface area than the
 *     panel needs (the rest of this codebase hand-writes its parsers for the
 *     same reason).
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "br" }

export type MdBlock =
  | { type: "heading"; level: number; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "hr" }

const HEADING = /^(#{1,6})\s+(.*)$/
const HR = /^\s*([-*_])(?:\s*\1){2,}\s*$/
const UL_ITEM = /^\s*[-*•]\s+(.*)$/
const OL_ITEM = /^\s*\d+[.)]\s+(.*)$/

/** Split a table row into trimmed cells, dropping the optional edge pipes. */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|")) s = s.slice(0, -1)
  return s.split("|").map(c => c.trim())
}

/** A `|---|:--:|` row — the line that turns the row above it into a header. */
function isTableSeparator(line: string): boolean {
  if (!line.includes("-") || !line.includes("|")) return false
  const cells = splitRow(line)
  return cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c))
}

const isBlank = (line: string) => line.trim() === ""

const startsBlock = (line: string) =>
  HEADING.test(line) ||
  HR.test(line) ||
  UL_ITEM.test(line) ||
  OL_ITEM.test(line) ||
  line.includes("|")

/**
 * Split inline text into styled spans. Unmatched delimiters stay literal, which
 * is what keeps a streaming half-line (`**代表` before its closer arrives) from
 * swallowing the rest of the block.
 */
export function parseInline(input: string): Inline[] {
  const out: Inline[] = []
  let buf = ""
  let i = 0

  const flush = () => {
    if (buf) out.push({ type: "text", text: buf })
    buf = ""
  }

  while (i < input.length) {
    if (input[i] === "`") {
      const end = input.indexOf("`", i + 1)
      if (end > i) {
        flush()
        out.push({ type: "code", text: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (input.startsWith("**", i)) {
      const end = input.indexOf("**", i + 2)
      if (end > i) {
        flush()
        out.push({ type: "bold", children: parseInline(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    // A lone `*` starts italics, but only when it isn't the `**` handled above
    // and there is a real closer — otherwise it is just an asterisk.
    if (input[i] === "*") {
      const end = input.indexOf("*", i + 1)
      if (end > i && input[i + 1] !== "*") {
        flush()
        out.push({ type: "italic", children: parseInline(input.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    buf += input[i]
    i++
  }

  flush()
  return out
}

/** Parse the inline content of one block, turning newlines into soft breaks. */
function parseBlockInline(lines: string[]): Inline[] {
  const out: Inline[] = []
  lines.forEach((line, idx) => {
    if (idx > 0) out.push({ type: "br" })
    out.push(...parseInline(line))
  })
  return out
}

export function parseMarkdownBlocks(input: string): MdBlock[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n")
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) { i++; continue }

    if (HR.test(line)) {
      blocks.push({ type: "hr" })
      i++
      continue
    }

    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        inline: parseInline(heading[2]),
      })
      i++
      continue
    }

    // Pipe table: a row followed by a `|---|` separator. Without the separator
    // the "row" is just a paragraph that happens to contain a pipe.
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line).map(parseInline)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && lines[i].includes("|") && !isBlank(lines[i])) {
        rows.push(splitRow(lines[i]).map(parseInline))
        i++
      }
      blocks.push({ type: "table", header, rows })
      continue
    }

    const ulStart = line.match(UL_ITEM)
    const olStart = line.match(OL_ITEM)
    if (ulStart || olStart) {
      const ordered = !!olStart
      const marker = ordered ? OL_ITEM : UL_ITEM
      const items: Inline[][] = []
      while (i < lines.length) {
        const m = lines[i].match(marker)
        if (!m) break
        const item = parseInline(m[1])
        i++
        // Indented lines under an item belong to it — the coach puts a Chinese
        // gloss line under each suggestion. Fold them in as soft breaks so the
        // list stays contiguous (and numbering keeps counting up).
        while (
          i < lines.length &&
          !isBlank(lines[i]) &&
          /^\s+\S/.test(lines[i]) &&
          !lines[i].match(UL_ITEM) &&
          !lines[i].match(OL_ITEM)
        ) {
          item.push({ type: "br" }, ...parseInline(lines[i].trim()))
          i++
        }
        items.push(item)
      }
      blocks.push({ type: "list", ordered, items })
      continue
    }

    // Paragraph: consecutive lines until a blank line or the start of another
    // block. Soft newlines inside are preserved as <br>.
    const para: string[] = [line]
    i++
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: "paragraph", inline: parseBlockInline(para) })
  }

  return blocks
}
