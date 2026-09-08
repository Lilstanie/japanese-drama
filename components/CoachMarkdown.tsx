"use client"

import { Fragment } from "react"
import JapaneseText from "@/components/JapaneseText"
import { parseMarkdownBlocks, type Inline, type MdBlock } from "@/lib/markdown"

/**
 * Renders the coach's Markdown answer as real elements, while routing every run
 * of plain text through JapaneseText so furigana and katakana glosses still
 * appear. Used for both settled and streaming coach messages; the parser
 * tolerates the half-written Markdown a stream produces.
 */

const RT = "#93c5fd"

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <JapaneseText key={i} text={n.text} rtColor={RT} />
          case "br":
            return <br key={i} />
          case "code":
            return (
              <code
                key={i}
                className="px-1 py-0.5 rounded text-[0.85em]"
                style={{ background: "#0a1018", color: "#93c5fd", fontFamily: "ui-monospace, monospace" }}
              >
                {n.text}
              </code>
            )
          case "bold":
            return (
              <strong key={i} style={{ color: "#eaf2fb", fontWeight: 700 }}>
                <InlineNodes nodes={n.children} />
              </strong>
            )
          case "italic":
            return (
              <em key={i}>
                <InlineNodes nodes={n.children} />
              </em>
            )
        }
      })}
    </>
  )
}

function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case "hr":
      return <hr className="my-3" style={{ border: "none", borderTop: "1px solid #1e3050" }} />

    case "heading": {
      const size = block.level <= 1 ? "1.15rem" : block.level === 2 ? "1.05rem" : "0.95rem"
      return (
        <div
          className="font-bold mt-3 mb-1 first:mt-0"
          style={{ color: "#93c5fd", fontSize: size, lineHeight: 1.5 }}
        >
          <InlineNodes nodes={block.inline} />
        </div>
      )
    }

    case "paragraph":
      return (
        <p className="my-1.5 leading-relaxed">
          <InlineNodes nodes={block.inline} />
        </p>
      )

    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag
          className="my-1.5 pl-5 space-y-1"
          style={{ listStyleType: block.ordered ? "decimal" : "disc" }}
        >
          {block.items.map((item, i) => (
            <li key={i} style={{ color: "#9db8d6" }}>
              <span style={{ color: "#c8dcf0" }}>
                <InlineNodes nodes={item} />
              </span>
            </li>
          ))}
        </Tag>
      )
    }

    case "table":
      return (
        <div className="my-2 overflow-x-auto">
          <table className="text-xs" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th
                    key={i}
                    className="px-2 py-1.5 text-left font-semibold"
                    style={{ border: "1px solid #1e3050", background: "#0f1a29", color: "#93c5fd" }}
                  >
                    <InlineNodes nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className="px-2 py-1.5 align-top"
                      style={{ border: "1px solid #1e3050" }}
                    >
                      <InlineNodes nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export default function CoachMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text)
  return (
    <>
      {blocks.map((block, i) => (
        <Fragment key={i}>
          <Block block={block} />
        </Fragment>
      ))}
    </>
  )
}
