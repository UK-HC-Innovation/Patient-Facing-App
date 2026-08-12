// Ladder's worker is deliberately a repeat-visit shell, not a general-purpose
// runtime cache. Caregiver data, API traffic, exports, and external resource
// pages are never intercepted or written to CacheStorage.
const LADDER_CACHE_PREFIX = "ladder-shell-";
const LADDER_CACHE = `${LADDER_CACHE_PREFIX}v1`;
const LADDER_SHELL = "/ladder";
const LADDER_STATIC_PATHS = new Set(["/ladder.webmanifest", "/ladder-icon.svg"]);

self.addEventListener("install", () => {
  // Do not skip waiting on updates. The old worker and its hashed Next.js
  // chunks stay together until existing tabs close, avoiding mixed builds.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(LADDER_CACHE_PREFIX) && name !== LADDER_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableResponse(response) {
  return response.ok && (response.type === "basic" || response.type === "default");
}

async function cacheFirst(request) {
  let cache = null;
  try {
    cache = await caches.open(LADDER_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    // CacheStorage can be blocked or unavailable. The network remains usable.
  }

  const response = await fetch(request);
  if (cache && isCacheableResponse(response)) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // A quota or permission failure must not turn a good response into an
      // application error.
    }
  }
  return response;
}

async function ladderNavigation(request) {
  let cache = null;
  try {
    cache = await caches.open(LADDER_CACHE);
  } catch {
    // Continue network-first even when CacheStorage itself is unavailable.
  }

  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    if (cache) {
      try {
        const cached = await cache.match(LADDER_SHELL);
        if (cached) return cached;
      } catch {
        // Preserve the original network error when the fallback is unreadable.
      }
    }
    throw error;
  }

  if (cache && isCacheableResponse(response)) {
    try {
      // Cache one query-free shell. Surface query parameters remain in the
      // address bar and are resolved client-side, but never become cache keys.
      await cache.put(LADDER_SHELL, response.clone());
    } catch {
      // The fresh network response always wins, even when a stale shell exists
      // and updating it fails.
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // This explicit exclusion documents the privacy boundary even though none of
  // the allowlisted paths below can match an API route.
  if (url.pathname.startsWith("/api/")) return;

  if (
    request.mode === "navigate" &&
    (url.pathname === LADDER_SHELL || url.pathname === `${LADDER_SHELL}/`)
  ) {
    event.respondWith(ladderNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || LADDER_STATIC_PATHS.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).pathname === destination);
      return existing ? existing.focus() : self.clients.openWindow(destination);
    })
  );
});
