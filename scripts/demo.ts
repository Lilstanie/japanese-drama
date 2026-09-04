/**
 * Prints the behaviour this branch changes, so it can be compared against main
 * by checking out each branch and running `npm run demo`.
 */
import { parseJapaneseText } from "@/lib/japanese-text"
import { convertToRomaji } from "@/lib/romaji"
import { toSpeechText } from "@/lib/tts"

const line = "重心（じゅうしん）を前に"   // full-width parens
console.log("【全角括号】模型经常这样写（播客提示词本身就是日语）")
console.log(`  原文      : ${line}`)
console.log(`  注音段数  : ${parseJapaneseText(line).filter((s) => s.type === "ruby").length}`)
console.log(`  罗马音    : ${convertToRomaji(line)}`)
console.log(`  朗读文本  : ${toSpeechText(line)}`)

console.log("\n【真正的括注】不该被当成注音吞掉")
console.log(`  ${toSpeechText("コーヒー(coffee)をください")}`)

console.log("\n【半角括号】两个分支都应该正常")
console.log(`  ${convertToRomaji("重心(じゅうしん)を前に")}`)
