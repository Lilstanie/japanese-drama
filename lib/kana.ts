export type KanaEntry = {
  kana: string
  romaji: string | string[]  // multiple accepted answers for ambiguous kana
  origin: string
}

export type KanaRow = {
  label: string
  cells: (KanaEntry | null)[]
}

export const HIRAGANA_ROWS: KanaRow[] = [
  {
    label: "母音",
    cells: [
      { kana: "あ", romaji: "a", origin: "安" },
      { kana: "い", romaji: "i", origin: "以" },
      { kana: "う", romaji: "u", origin: "宇" },
      { kana: "え", romaji: "e", origin: "衣" },
      { kana: "お", romaji: "o", origin: "於" },
    ],
  },
  {
    label: "か行",
    cells: [
      { kana: "か", romaji: "ka", origin: "加" },
      { kana: "き", romaji: "ki", origin: "幾" },
      { kana: "く", romaji: "ku", origin: "久" },
      { kana: "け", romaji: "ke", origin: "計" },
      { kana: "こ", romaji: "ko", origin: "己" },
    ],
  },
  {
    label: "さ行",
    cells: [
      { kana: "さ", romaji: "sa", origin: "左" },
      { kana: "し", romaji: "shi", origin: "之" },
      { kana: "す", romaji: "su", origin: "寸" },
      { kana: "せ", romaji: "se", origin: "世" },
      { kana: "そ", romaji: "so", origin: "曽" },
    ],
  },
  {
    label: "た行",
    cells: [
      { kana: "た", romaji: "ta", origin: "太" },
      { kana: "ち", romaji: "chi", origin: "知" },
      { kana: "つ", romaji: "tsu", origin: "川" },
      { kana: "て", romaji: "te", origin: "天" },
      { kana: "と", romaji: "to", origin: "止" },
    ],
  },
  {
    label: "な行",
    cells: [
      { kana: "な", romaji: "na", origin: "奈" },
      { kana: "に", romaji: "ni", origin: "仁" },
      { kana: "ぬ", romaji: "nu", origin: "奴" },
      { kana: "ね", romaji: "ne", origin: "祢" },
      { kana: "の", romaji: "no", origin: "乃" },
    ],
  },
  {
    label: "は行",
    cells: [
      { kana: "は", romaji: "ha", origin: "波" },
      { kana: "ひ", romaji: "hi", origin: "比" },
      { kana: "ふ", romaji: "fu", origin: "不" },
      { kana: "へ", romaji: "he", origin: "部" },
      { kana: "ほ", romaji: "ho", origin: "保" },
    ],
  },
  {
    label: "ま行",
    cells: [
      { kana: "ま", romaji: "ma", origin: "末" },
      { kana: "み", romaji: "mi", origin: "美" },
      { kana: "む", romaji: "mu", origin: "武" },
      { kana: "め", romaji: "me", origin: "女" },
      { kana: "も", romaji: "mo", origin: "毛" },
    ],
  },
  {
    label: "や行",
    cells: [
      { kana: "や", romaji: "ya", origin: "也" },
      null,
      { kana: "ゆ", romaji: "yu", origin: "由" },
      null,
      { kana: "よ", romaji: "yo", origin: "与" },
    ],
  },
  {
    label: "ら行",
    cells: [
      { kana: "ら", romaji: "ra", origin: "良" },
      { kana: "り", romaji: "ri", origin: "利" },
      { kana: "る", romaji: "ru", origin: "留" },
      { kana: "れ", romaji: "re", origin: "礼" },
      { kana: "ろ", romaji: "ro", origin: "呂" },
    ],
  },
  {
    label: "わ行",
    cells: [
      { kana: "わ", romaji: "wa", origin: "和" },
      null,
      { kana: "を", romaji: "wo", origin: "遠" },
      null,
      { kana: "ん", romaji: "n", origin: "无" },
    ],
  },
  {
    label: "が行 · 濁音",
    cells: [
      { kana: "が", romaji: "ga", origin: "加" },
      { kana: "ぎ", romaji: "gi", origin: "幾" },
      { kana: "ぐ", romaji: "gu", origin: "久" },
      { kana: "げ", romaji: "ge", origin: "計" },
      { kana: "ご", romaji: "go", origin: "己" },
    ],
  },
  {
    label: "ざ行",
    cells: [
      { kana: "ざ", romaji: "za", origin: "左" },
      { kana: "じ", romaji: ["ji", "zi"], origin: "之" },
      { kana: "ず", romaji: "zu", origin: "寸" },
      { kana: "ぜ", romaji: "ze", origin: "世" },
      { kana: "ぞ", romaji: "zo", origin: "曽" },
    ],
  },
  {
    label: "だ行",
    cells: [
      { kana: "だ", romaji: "da", origin: "太" },
      { kana: "ぢ", romaji: ["di", "ji"], origin: "知" },
      { kana: "づ", romaji: ["du", "zu"], origin: "川" },
      { kana: "で", romaji: "de", origin: "天" },
      { kana: "ど", romaji: "do", origin: "止" },
    ],
  },
  {
    label: "ば行",
    cells: [
      { kana: "ば", romaji: "ba", origin: "波" },
      { kana: "び", romaji: "bi", origin: "比" },
      { kana: "ぶ", romaji: "bu", origin: "不" },
      { kana: "べ", romaji: "be", origin: "部" },
      { kana: "ぼ", romaji: "bo", origin: "保" },
    ],
  },
  {
    label: "ぱ行 · 半濁音",
    cells: [
      { kana: "ぱ", romaji: "pa", origin: "波" },
      { kana: "ぴ", romaji: "pi", origin: "比" },
      { kana: "ぷ", romaji: "pu", origin: "不" },
      { kana: "ぺ", romaji: "pe", origin: "部" },
      { kana: "ぽ", romaji: "po", origin: "保" },
    ],
  },
]

export const KATAKANA_ROWS: KanaRow[] = [
  {
    label: "母音",
    cells: [
      { kana: "ア", romaji: "a", origin: "阿" },
      { kana: "イ", romaji: "i", origin: "伊" },
      { kana: "ウ", romaji: "u", origin: "宇" },
      { kana: "エ", romaji: "e", origin: "江" },
      { kana: "オ", romaji: "o", origin: "於" },
    ],
  },
  {
    label: "カ行",
    cells: [
      { kana: "カ", romaji: "ka", origin: "加" },
      { kana: "キ", romaji: "ki", origin: "幾" },
      { kana: "ク", romaji: "ku", origin: "久" },
      { kana: "ケ", romaji: "ke", origin: "介" },
      { kana: "コ", romaji: "ko", origin: "己" },
    ],
  },
  {
    label: "サ行",
    cells: [
      { kana: "サ", romaji: "sa", origin: "散" },
      { kana: "シ", romaji: "shi", origin: "之" },
      { kana: "ス", romaji: "su", origin: "須" },
      { kana: "セ", romaji: "se", origin: "世" },
      { kana: "ソ", romaji: "so", origin: "曽" },
    ],
  },
  {
    label: "タ行",
    cells: [
      { kana: "タ", romaji: "ta", origin: "多" },
      { kana: "チ", romaji: "chi", origin: "千" },
      { kana: "ツ", romaji: "tsu", origin: "川" },
      { kana: "テ", romaji: "te", origin: "天" },
      { kana: "ト", romaji: "to", origin: "止" },
    ],
  },
  {
    label: "ナ行",
    cells: [
      { kana: "ナ", romaji: "na", origin: "奈" },
      { kana: "ニ", romaji: "ni", origin: "仁" },
      { kana: "ヌ", romaji: "nu", origin: "奴" },
      { kana: "ネ", romaji: "ne", origin: "祢" },
      { kana: "ノ", romaji: "no", origin: "乃" },
    ],
  },
  {
    label: "ハ行",
    cells: [
      { kana: "ハ", romaji: "ha", origin: "八" },
      { kana: "ヒ", romaji: "hi", origin: "比" },
      { kana: "フ", romaji: "fu", origin: "不" },
      { kana: "ヘ", romaji: "he", origin: "部" },
      { kana: "ホ", romaji: "ho", origin: "保" },
    ],
  },
  {
    label: "マ行",
    cells: [
      { kana: "マ", romaji: "ma", origin: "末" },
      { kana: "ミ", romaji: "mi", origin: "三" },
      { kana: "ム", romaji: "mu", origin: "牟" },
      { kana: "メ", romaji: "me", origin: "女" },
      { kana: "モ", romaji: "mo", origin: "毛" },
    ],
  },
  {
    label: "ヤ行",
    cells: [
      { kana: "ヤ", romaji: "ya", origin: "也" },
      null,
      { kana: "ユ", romaji: "yu", origin: "由" },
      null,
      { kana: "ヨ", romaji: "yo", origin: "与" },
    ],
  },
  {
    label: "ラ行",
    cells: [
      { kana: "ラ", romaji: "ra", origin: "良" },
      { kana: "リ", romaji: "ri", origin: "利" },
      { kana: "ル", romaji: "ru", origin: "流" },
      { kana: "レ", romaji: "re", origin: "礼" },
      { kana: "ロ", romaji: "ro", origin: "呂" },
    ],
  },
  {
    label: "ワ行",
    cells: [
      { kana: "ワ", romaji: "wa", origin: "和" },
      null,
      { kana: "ヲ", romaji: "wo", origin: "乎" },
      null,
      { kana: "ン", romaji: "n", origin: "尔" },
    ],
  },
  {
    label: "ガ行 · 濁音",
    cells: [
      { kana: "ガ", romaji: "ga", origin: "加" },
      { kana: "ギ", romaji: "gi", origin: "幾" },
      { kana: "グ", romaji: "gu", origin: "久" },
      { kana: "ゲ", romaji: "ge", origin: "介" },
      { kana: "ゴ", romaji: "go", origin: "己" },
    ],
  },
  {
    label: "ザ行",
    cells: [
      { kana: "ザ", romaji: "za", origin: "散" },
      { kana: "ジ", romaji: ["ji", "zi"], origin: "之" },
      { kana: "ズ", romaji: "zu", origin: "須" },
      { kana: "ゼ", romaji: "ze", origin: "世" },
      { kana: "ゾ", romaji: "zo", origin: "曽" },
    ],
  },
  {
    label: "ダ行",
    cells: [
      { kana: "ダ", romaji: "da", origin: "多" },
      { kana: "ヂ", romaji: ["di", "ji"], origin: "千" },
      { kana: "ヅ", romaji: ["du", "zu"], origin: "川" },
      { kana: "デ", romaji: "de", origin: "天" },
      { kana: "ド", romaji: "do", origin: "止" },
    ],
  },
  {
    label: "バ行",
    cells: [
      { kana: "バ", romaji: "ba", origin: "八" },
      { kana: "ビ", romaji: "bi", origin: "比" },
      { kana: "ブ", romaji: "bu", origin: "不" },
      { kana: "ベ", romaji: "be", origin: "部" },
      { kana: "ボ", romaji: "bo", origin: "保" },
    ],
  },
  {
    label: "パ行 · 半濁音",
    cells: [
      { kana: "パ", romaji: "pa", origin: "八" },
      { kana: "ピ", romaji: "pi", origin: "比" },
      { kana: "プ", romaji: "pu", origin: "不" },
      { kana: "ペ", romaji: "pe", origin: "部" },
      { kana: "ポ", romaji: "po", origin: "保" },
    ],
  },
]

export function flatKana(rows: KanaRow[]): KanaEntry[] {
  return rows.flatMap((r) => r.cells.filter((c): c is KanaEntry => c !== null))
}
