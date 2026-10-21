/* Service worker for Notebook.io. Keeps the app shell available offline. */
const CACHE_PREFIX = 'notebook-io-'
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

async function fetchAndCache(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' })
    if (response.ok) await cache.put(url, response)
  } catch {
    // A missing optional asset should not block installation.
  }
}

async function precache() {
  const shellCache = await caches.open(SHELL_CACHE)
  const assetCache = await caches.open(ASSET_CACHE)

  await Promise.all(SHELL_URLS.map((url) => fetchAndCache(shellCache, url)))

  try {
    const response = await fetch('/index.html', { cache: 'reload' })
    if (!response.ok) return

    const html = await response.clone().text()
    try {
      await shellCache.put('/index.html', response.clone())
      await shellCache.put('/', response.clone())
    } catch {
      // The runtime navigation handler can still populate the shell cache.
    }

    const assetUrls = new Set()
    const pattern = /(?:src|href)="([^"]+)"/g
    let match = pattern.exec(html)

    while (match) {
      const raw = match[1]
      if (raw && !raw.startsWith('data:') && !raw.startsWith('http')) {
        try {
          const url = new URL(raw, self.location.origin)
          if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
            assetUrls.add(url.pathname)
          }
        } catch {
          // Ignore malformed asset URLs; the runtime cache will handle them.
        }
      }
      match = pattern.exec(html)
    }

    await Promise.all([...assetUrls].map((url) => fetchAndCache(assetCache, url)))
  } catch {
    // Runtime caching still covers assets after the first online load.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== ASSET_CACHE,
          )
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

async function handleNavigation(request) {
  const shellCache = await caches.open(SHELL_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      try {
        const copy = response.clone()
        await shellCache.put('/index.html', copy.clone())
        await shellCache.put('/', copy)
      } catch {
        // Serving the response is more important than updating the cache.
      }
    }
    return response
  } catch {
    return (
      (await shellCache.match(request)) ||
      (await shellCache.match('/index.html')) ||
      (await shellCache.match('/')) ||
      new Response('Notebook.io is offline and this page is not cached yet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  }
}

async function handleAsset(request) {
  const assetCache = await caches.open(ASSET_CACHE)
  const isHashedAsset = new URL(request.url).pathname.startsWith('/assets/')

  if (isHashedAsset) {
    const cached = await assetCache.match(request)
    if (cached) return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      try {
        await assetCache.put(request, response.clone())
      } catch {
        // A full cache should not prevent the asset from loading.
      }
    }
    return response
  } catch {
    return (await assetCache.match(request)) || new Response('', { status: 504 })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  event.respondWith(handleAsset(request))
})
