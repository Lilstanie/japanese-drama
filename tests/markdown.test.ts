import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseMarkdownBlocks, parseInline } from "@/lib/markdown"

describe("block structure", () => {
  test("headings carry their level", () => {
    const [b] = parseMarkdownBlocks("### 1️⃣ 中文翻译")
    assert.equal(b.type, "heading")
    assert.equal(b.type === "heading" && b.level, 3)
  })

  test("a --- line is a horizontal rule, not a heading underline", () => {
    const blocks = parseMarkdownBlocks("上面\n\n---\n\n下面")
    assert.deepEqual(blocks.map(b => b.type), ["paragraph", "hr", "paragraph"])
  })

  test("bullet lists collect their items", () => {
    const [b] = parseMarkdownBlocks("- 学校\n- 駅前\n- 電話")
    assert.equal(b.type, "list")
    assert.equal(b.type === "list" && b.ordered, false)
    assert.equal(b.type === "list" && b.items.length, 3)
  })

  test("numbered lists are ordered", () => {
    const [b] = parseMarkdownBlocks("1. もっと\n2. 駅前")
    assert.equal(b.type === "list" && b.ordered, true)
  })

  test("an indented gloss line stays inside its item, keeping one list", () => {
    // The coach puts a Chinese gloss under each numbered suggestion; the two
    // items must not split into two lists that both start at 1.
    const blocks = parseMarkdownBlocks(
      "1. **教えてください**\n   *（请教我。）*\n2. **分かりません**\n   *（我不懂。）*"
    )
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].type, "list")
    assert.equal(blocks[0].type === "list" && blocks[0].items.length, 2)
    // The gloss is folded into the item it follows.
    assert.ok(blocks[0].type === "list" && blocks[0].items[0].some(n => n.type === "br"))
  })

  test("a pipe table needs its separator row to be a table", () => {
    const table = parseMarkdownBlocks("| 语法 | 解释 |\n|------|------|\n| な | 形容词 |")
    assert.equal(table[0].type, "table")
    assert.equal(table[0].type === "table" && table[0].header.length, 2)
    assert.equal(table[0].type === "table" && table[0].rows.length, 1)

    // Without the separator it is just a paragraph that contains a pipe.
    const notTable = parseMarkdownBlocks("翻译 | 原文")
    assert.equal(notTable[0].type, "paragraph")
  })
})

describe("inline styling", () => {
  test("bold and italic become their own nodes", () => {
    const nodes = parseInline("这是 **代表的** 和 *斜体*")
    assert.ok(nodes.some(n => n.type === "bold"))
    assert.ok(nodes.some(n => n.type === "italic"))
  })

  test("an unclosed ** stays literal so a streaming line never eats the rest", () => {
    const nodes = parseInline("**代表")
    assert.equal(nodes.length, 1)
    assert.equal(nodes[0].type, "text")
    assert.equal(nodes[0].type === "text" && nodes[0].text, "**代表")
  })

  test("furigana markup is left untouched for JapaneseText to annotate", () => {
    const nodes = parseInline("代表的(だいひょう)な漢字(かんじ)です")
    assert.equal(nodes.length, 1)
    assert.equal(nodes[0].type, "text")
    assert.match(nodes[0].type === "text" ? nodes[0].text : "", /\(だいひょう\)/)
  })
})

describe("does not throw on messy or partial input", () => {
  for (const sample of ["", "| 半张", "###", "**", "- ", "|--|"]) {
    test(JSON.stringify(sample), () => {
      assert.doesNotThrow(() => parseMarkdownBlocks(sample))
    })
  }
})
