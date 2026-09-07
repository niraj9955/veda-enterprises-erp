/**
 * Voice transcript correction against the shop's REAL vocabulary.
 *
 * Problem: even with the ERP prompt, Whisper mishears brand/product/customer
 * names ("Panchvati Steel" → "panchvati stell", "टाटा स्टिल" → "टाटा स्टील").
 * The agent then searches for a customer/product that doesn't exist.
 *
 * Fix: after ASR, every word in the transcript is fuzzy-matched against the
 * DB vocabulary (products + customers). A near-miss (≥78% similar) is swapped
 * for the real name. Multi-word names are matched as adjacent word pairs
 * (bigrams) first, because "berla cement" → "Birla Cement" is a 2-word fix.
 *
 * Safety rules (deterministic, no LLM involved — adds ~0ms):
 *   - only tokens with a letter (never pure numbers) are correctable
 *   - tokens shorter than 3 chars are never touched (Hindi posts/helpers)
 *   - exact vocab matches are left as-is
 *   - everything is NFC-normalized before comparison (Devanagari forms)
 *   - worst case it swaps a mishearing for ANOTHER real vocab name — bounded
 */

export interface TranscriptCorrection {
  from: string
  to: string
  /** similarity 0..1 of the match that triggered the replacement */
  sim: number
}

export interface VocabCorrectionResult {
  text: string
  corrections: TranscriptCorrection[]
}

const MIN_WORD_LEN = 3
/** default similarity threshold for single-word replacement */
const DEFAULT_MIN_SIM = 0.78
/** stricter threshold for 2-word (bigram) replacement */
const BIGRAM_MIN_SIM = 0.82

/** Lowercase, NFC-normalize, drop punctuation, collapse spaces. */
function norm(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Bounded Levenshtein distance (classic DP, O(len_a * len_b)). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    const t = prev
    prev = curr
    curr = t
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 0
  // cheap length prune: distance can never be smaller than the length gap
  if (Math.abs(a.length - b.length) / maxLen > 1 - DEFAULT_MIN_SIM) return 0
  return 1 - levenshtein(a, b) / maxLen
}

/** A token is correctable when it has a letter and isn't a bare number. */
function isCorrectable(n: string): boolean {
  if (n.length < MIN_WORD_LEN) return false
  if (/^\d+$/.test(n)) return false
  return /\p{L}/u.test(n)
}

export function correctTranscriptWithVocab(
  text: string,
  vocab: string[],
  opts?: { minSim?: number }
): VocabCorrectionResult {
  const corrections: TranscriptCorrection[] = []
  if (!text || !Array.isArray(vocab) || vocab.length === 0) return { text, corrections }
  const minSim = opts?.minSim ?? DEFAULT_MIN_SIM

  // normalized vocab index: normKey -> original (first occurrence wins)
  const vocabNorm = new Map<string, string>()
  for (const v of vocab) {
    const original = String(v || '').normalize('NFC').trim()
    if (!original) continue
    const n = norm(original)
    if (n.length < MIN_WORD_LEN) continue
    if (!vocabNorm.has(n)) vocabNorm.set(n, original)
  }
  if (vocabNorm.size === 0) return { text, corrections }

  // split preserving whitespace so we can swap words in place
  const parts = text.normalize('NFC').split(/(\s+)/)
  const wordIdx: number[] = []
  const normParts: (string | null)[] = parts.map((p, i) => {
    if (/^\s+$/.test(p) || p === '') return null
    const n = norm(p)
    if (!n) return null
    wordIdx.push(i)
    return n
  })

  // ── pass 1: bigrams (multi-word vocab names, e.g. "Birla Cement") ──
  const replaced = new Set<number>()
  for (let k = 0; k + 1 < wordIdx.length; k++) {
    const i1 = wordIdx[k]
    const i2 = wordIdx[k + 1]
    // adjacent words in the ORIGINAL text only (no punctuation between)
    if (i2 !== i1 + 2) continue
    const n1 = normParts[i1]
    const n2 = normParts[i2]
    if (!n1 || !n2) continue
    if (replaced.has(i1) || replaced.has(i2)) continue
    const joined = `${n1} ${n2}`
    if (joined.length < MIN_WORD_LEN * 2 - 1) continue
    for (const [vn, original] of vocabNorm) {
      if (!vn.includes(' ')) continue // multi-word candidates only
      const exact = vn === joined
      const sim = exact ? 1 : similarity(joined, vn)
      const threshold = exact ? 0 : BIGRAM_MIN_SIM
      if (sim < threshold) continue
      const words = original.split(/\s+/)
      if (words.length !== 2) continue // only clean 2-word swaps
      corrections.push({ from: `${parts[i1]} ${parts[i2]}`, to: original, sim })
      parts[i1] = words[0]
      parts[i2] = words[1]
      replaced.add(i1)
      replaced.add(i2)
      break
    }
  }

  // ── pass 2: single words ──
  for (const i of wordIdx) {
    if (replaced.has(i)) continue
    const tok = normParts[i]
    if (!tok || !isCorrectable(tok)) continue
    if (vocabNorm.has(tok)) continue // already an exact vocab word
    let bestSim = 0
    let bestOriginal = ''
    for (const [vn, original] of vocabNorm) {
      if (vn.includes(' ')) continue // single-word candidates only
      const sim = similarity(tok, vn)
      if (sim > bestSim) {
        bestSim = sim
        bestOriginal = original
      }
    }
    if (bestSim >= minSim && bestOriginal) {
      corrections.push({ from: parts[i], to: bestOriginal, sim: bestSim })
      parts[i] = bestOriginal
      replaced.add(i)
    }
  }

  if (corrections.length === 0) return { text, corrections }
  return { text: parts.join(''), corrections }
}
