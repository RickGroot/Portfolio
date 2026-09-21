/*
 * Kill switch for the SvelteKit service worker that shipped with the v1 site.
 *
 * WHY THIS FILE EXISTS
 * The old SW precached every static asset (`cache.addAll(build.concat(files))`)
 * and served it cache-first with no revalidation -- roughly 6 MB of retired
 * imagery and a stale manifest. If this path simply 404'd, most browsers would
 * eventually drop the registration. But the old firebase.json rewrote `**` to
 * /index.html, so the update check received 200 text/html, which fails as a
 * SECURITY ERROR rather than a 404 -- and a failed update leaves the old
 * registration in place forever.
 *
 * So all three of these are required and none is redundant:
 *   1. this file, at this exact path
 *   2. the `rewrites` block removed from firebase.json
 *   3. an explicit `Content-Type: application/javascript` header
 *
 * DO NOT DELETE THIS FILE BEFORE ~2027-09.
 * Removing it re-opens the bug for anyone who has not visited since the
 * migration. See docs/roadmap.md.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			try {
				const keys = await caches.keys();
				await Promise.all(keys.map((key) => caches.delete(key)));
			} catch (error) {
				// A cache purge failure must never block unregistration --
				// being stuck registered is the worse outcome.
				console.warn('[sw] cache purge failed, unregistering anyway', error);
			}

			await self.registration.unregister();

			// Reload open tabs so they leave the old cached document behind.
			const clients = await self.clients.matchAll({ type: 'window' });
			for (const client of clients) client.navigate(client.url);
		})(),
	);
});
