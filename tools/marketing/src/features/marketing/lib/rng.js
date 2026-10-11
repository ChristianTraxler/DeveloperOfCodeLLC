// Small seeded random helpers so the example data is the same on every load.

export function seeded(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = (r, list) => list[Math.floor(r() * list.length)]
export const between = (r, min, max) => min + Math.floor(r() * (max - min + 1))
export const chance = (r, p) => r() < p

export function weighted(r, pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0)
  let roll = r() * total
  for (const [value, w] of pairs) {
    roll -= w
    if (roll <= 0) return value
  }
  return pairs[pairs.length - 1][0]
}

export function shuffle(r, list) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function hashString(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const uid = (prefix = 'id') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
