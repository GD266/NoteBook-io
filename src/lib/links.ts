const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi
const TRAILING_PUNCTUATION = /[.,;:!?]+$/
const CLOSING_PUNCTUATION: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
}

export interface ExternalLinkMatch {
  start: number
  end: number
  href: string
  text: string
}

function countOccurrences(value: string, character: string): number {
  let total = 0
  for (const item of value) {
    if (item === character) total += 1
  }
  return total
}

/** Drops sentence punctuation without breaking URLs that contain brackets. */
function trimTrailingPunctuation(value: string): string {
  let result = value.replace(TRAILING_PUNCTUATION, '')

  while (result.length > 0) {
    const last = result[result.length - 1]
    const opener = CLOSING_PUNCTUATION[last]
    if (!opener) break
    if (countOccurrences(result, last) <= countOccurrences(result, opener)) break
    result = result.slice(0, -1)
  }

  return result
}

/**
 * Returns a safe absolute http(s) URL, or null for anything else. This is the
 * single gate used by both pasted links and the stored-HTML sanitizer.
 */
export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed
  if (!/^https?:\/\//i.test(candidate)) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

/**
 * Finds http(s) and www. links in pasted plain text. Trailing punctuation is
 * left out of the link so sentences such as "see https://example.com." work.
 */
export function findExternalLinks(text: string): ExternalLinkMatch[] {
  const matches: ExternalLinkMatch[] = []
  URL_PATTERN.lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const display = trimTrailingPunctuation(raw)
    const href = normalizeExternalUrl(display)
    if (!display || !href) continue

    const start = match.index ?? 0
    matches.push({
      start,
      end: start + display.length,
      href,
      text: display,
    })
  }

  return matches
}
