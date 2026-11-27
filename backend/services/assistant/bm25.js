/**
 * Small in-process BM25 index. The knowledge base is a few hundred chunks, so
 * this is fast and needs no embedding model or vector database (fits the
 * 512 MB free hosting tier).
 */

const STOPWORDS = new Set(
  `a an and are as at be by can could do does for from had has have how i if in into is it its
  me my of on or our so than that the their them then there these they this to us was we were
  what when where which who why will with would you your about any some get tell show give want
  like near nearby around best good visit visiting go going see place places please also there's
  help know need just really thing things lot much many more very`
    .split(/\s+/)
    .filter(Boolean)
)

export function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Tokenize: unicode letters/digits, stopwords removed, light plural stemming. */
export function tokenize(text) {
  const out = []
  for (const raw of normalize(text).match(/[\p{L}\p{N}]+/gu) || []) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue
    out.push(raw.length > 4 && raw.endsWith('s') && !raw.endsWith('ss') ? raw.slice(0, -1) : raw)
  }
  return out
}

function editDistanceWithin(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > max) return false
    prev = cur
  }
  return prev[b.length] <= max
}

export class Bm25Index {
  constructor({ k1 = 1.4, b = 0.7 } = {}) {
    this.k1 = k1
    this.b = b
    this.docs = []
    this.df = new Map()
    this.avgLen = 0
  }

  /** doc: { id, text, boostText? } — boostText (names/aliases) counts 3x. */
  add(doc) {
    const tokens = [...tokenize(doc.text)]
    const boost = tokenize(doc.boostText || '')
    for (let i = 0; i < 3; i += 1) tokens.push(...boost)
    const tf = new Map()
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1)
    this.docs.push({ doc, tf, len: tokens.length })
  }

  finalize() {
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / Math.max(1, this.docs.length)
    this.vocab = [...this.df.keys()]
    return this
  }

  /** Map unknown query terms to close vocabulary terms (typos/transliterations). */
  expand(terms) {
    const out = []
    for (const t of terms) {
      if (this.df.has(t)) {
        out.push({ term: t, weight: 1 })
        continue
      }
      if (t.length < 5) continue
      const max = t.length >= 8 ? 2 : 1
      for (const v of this.vocab) {
        if (v[0] === t[0] && editDistanceWithin(t, v, max)) out.push({ term: v, weight: 0.8 })
      }
    }
    return out
  }

  search(query, { limit = 6, filter } = {}) {
    const terms = this.expand([...new Set(tokenize(query))])
    if (!terms.length) return []
    const N = this.docs.length
    const scored = []
    for (const d of this.docs) {
      if (filter && !filter(d.doc)) continue
      let score = 0
      for (const { term, weight } of terms) {
        const f = d.tf.get(term)
        if (!f) continue
        const df = this.df.get(term)
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
        score += weight * idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen)))
      }
      if (score > 0) scored.push({ doc: d.doc, score })
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit)
  }
}
