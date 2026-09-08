/* Service worker — Bolt GPS Copilot: Live Mode.
 * Offline-first for the live field UI (same-directory assets only). Regular
 * browser fetches pass through and populate the cache. Works only over
 * http(s)/localhost — silently inert on file:// (documented limitation).
 */
'use strict';

var CACHE = 'highlander-live-v1';
var ASSETS = [
  './',
  './index.html',
  './live.html',
  './live-ui.js',
  './live-core.js',
  './engine.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.url.indexOf('http') !== 0) return;
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./live.html');
      });
    })
  );
});