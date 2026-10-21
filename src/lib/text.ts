import { normalizeExternalUrl } from './links'

const ALLOWED_TAGS = new Set([
  'P',
  'DIV',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'H1',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'SPAN',
  'A',
])

/** Elements that are discarded together with their content. */
const UNSAFE_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'LINK',
  'META',
  'TITLE',
  'BASE',
  'IFRAME',
  'FRAME',
  'OBJECT',
  'EMBED',
  'APPLET',
  'FORM',
  'INPUT',
  'BUTTON',
  'SELECT',
  'OPTION',
  'TEXTAREA',
  'SVG',
  'MATH',
  'TEMPLATE',
  'NOSCRIPT',
  'VIDEO',
  'AUDIO',
  'SOURCE',
  'TRACK',
  'CANVAS',
  'IMG',
  'PICTURE',
  'MAP',
  'AREA',
])

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
])

function appendSanitizedChildren(source: Node, target: Node, doc: Document): void {
  source.childNodes.forEach((child) => {
    const clean = sanitizeNode(child, doc)
    if (clean) target.appendChild(clean)
  })
}

function wrapWithSemanticTags(node: Node, tag: 'strong' | 'em' | 'u', doc: Document): Node {
  const wrapper = doc.createElement(tag)
  wrapper.appendChild(node)
  return wrapper
}

function sanitizeSpan(element: Element, doc: Document): Node {
  const fragment = doc.createDocumentFragment()
  appendSanitizedChildren(element, fragment, doc)

  if (!fragment.childNodes.length) return fragment

  const style = (element.getAttribute('style') ?? '').toLowerCase()
  const fontWeight = /font-weight\s*:\s*([^;]+)/.exec(style)?.[1]?.trim() ?? ''
  const numericWeight = Number.parseInt(fontWeight, 10)
  const isBold =
    fontWeight === 'bold' ||
    fontWeight === 'bolder' ||
    (Number.isFinite(numericWeight) && numericWeight >= 600)
  const isItalic = /font-style\s*:\s*(italic|oblique)/.test(style)
  const isUnderlined = /text-decoration[^;]*:[^;]*underline/.test(style)

  let result: Node = fragment
  if (isUnderlined) result = wrapWithSemanticTags(result, 'u', doc)
  if (isItalic) result = wrapWithSemanticTags(result, 'em', doc)
  if (isBold) result = wrapWithSemanticTags(result, 'strong', doc)
  return result
}

function sanitizeAnchor(element: Element, doc: Document): Node {
  const href = normalizeExternalUrl(element.getAttribute('href') ?? '')

  if (!href) {
    const fragment = doc.createDocumentFragment()
    appendSanitizedChildren(element, fragment, doc)
    return fragment
  }

  const anchor = doc.createElement('a')
  anchor.setAttribute('href', href)
  anchor.setAttribute('target', '_blank')
  anchor.setAttribute('rel', 'noopener noreferrer')
  appendSanitizedChildren(element, anchor, doc)
  return anchor
}

function sanitizeNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.nodeValue ?? '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const element = node as Element
  const tag = element.tagName.toUpperCase()

  if (UNSAFE_TAGS.has(tag)) return null

  if (tag === 'SPAN') return sanitizeSpan(element, doc)

  if (tag === 'A') return sanitizeAnchor(element, doc)

  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = doc.createDocumentFragment()
    appendSanitizedChildren(element, fragment, doc)
    return fragment
  }

  const cleanElement = doc.createElement(tag.toLowerCase())
  appendSanitizedChildren(element, cleanElement, doc)
  return cleanElement
}

/**
 * Sanitizes stored editor HTML before it is ever injected into the page.
 * Only the small set of tags produced by the editor is retained. Attributes
 * are stripped except for a validated http(s) link target, which is rewritten
 * with safe target/rel values. Styled spans from other browsers are converted
 * back into semantic inline tags so formatting survives a round trip.
 */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return ''

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const container = doc.createElement('div')
    appendSanitizedChildren(doc.body, container, doc)
    return container.innerHTML
  } catch {
    return ''
  }
}

interface PlainTextOptions {
  /** Adds bullets and numbers when copying/downloading lists. */
  listMarkers?: boolean
}

function extractText(node: Node, listMarkers: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? '').replace(/\u00a0/g, ' ')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const element = node as Element
  const tag = element.tagName.toUpperCase()

  if (tag === 'BR') return '\n'

  if (tag === 'UL' || tag === 'OL') {
    const items = Array.from(element.children).filter(
      (child) => child.tagName.toUpperCase() === 'LI',
    )

    return (
      items
        .map((item, index) => {
          const content = Array.from(item.childNodes)
            .map((child) => extractText(child, listMarkers))
            .join('')
            .trim()
            .replace(/\s*\n+\s*/g, ' ')
          if (!listMarkers) return content
          const marker = tag === 'OL' ? `${index + 1}.` : '•'
          return content ? `${marker} ${content}` : marker
        })
        .join('\n') + '\n'
    )
  }

  const content = Array.from(element.childNodes)
    .map((child) => extractText(child, listMarkers))
    .join('')
  return BLOCK_TAGS.has(tag) ? `${content}\n` : content
}

/**
 * Converts editor HTML to readable plain text. List markers are omitted by
 * default so counts and previews reflect the words themselves; copy/download
 * enable them explicitly.
 */
export function htmlToPlainText(html: string, { listMarkers = false }: PlainTextOptions = {}): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return ''

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return extractText(doc.body, listMarkers)
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } catch {
    return ''
  }
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null

export interface TextStats {
  words: number
  characters: number
}

export function getTextStats(text: string): TextStats {
  const value = text.trim()
  if (!value) return { words: 0, characters: 0 }

  let words = 0
  if (segmenter) {
    for (const segment of segmenter.segment(value)) {
      if (segment.isWordLike) words += 1
    }
  } else {
    words = value.split(/\s+/u).filter(Boolean).length
  }

  return { words, characters: Array.from(value).length }
}
