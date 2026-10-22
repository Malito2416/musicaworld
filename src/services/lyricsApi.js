/**
 * Cliente de letras usando LRCLIB (https://lrclib.net), gratuito y sin clave.
 *
 * `fetchLyrics` nunca lanza: si no hay letras o la red falla devuelve un
 * resultado vacío, para que el reproductor muestre "Sin letras" en lugar de
 * romperse. Los resultados se guardan en memoria por título y artista.
 */

export const LRCLIB_BASE_URL = 'https://lrclib.net/api';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_CACHE_ENTRIES = 50;

const EMPTY_LYRICS = Object.freeze({ lines: [], synced: false, plain: '' });

const cache = new Map();

/** Solo para tests. */
export function clearLyricsCache() {
  cache.clear();
}

const TIMESTAMP_RE = /\[(\d+):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

/**
 * Convierte texto LRC (`[mm:ss.xx] línea`) en líneas ordenadas por tiempo.
 * Admite varias marcas por línea e ignora etiquetas de metadatos (`[ar:...]`).
 */
export function parseLrc(lrc) {
  if (typeof lrc !== 'string' || lrc.length === 0) return [];
  const lines = [];
  for (const rawLine of lrc.split(/\r?\n/)) {
    const times = [];
    let lastIndex = 0;
    TIMESTAMP_RE.lastIndex = 0;
    let match;
    while ((match = TIMESTAMP_RE.exec(rawLine)) !== null && match.index === lastIndex) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2].replace(':', '.'));
      times.push(minutes * 60 + seconds);
      lastIndex = TIMESTAMP_RE.lastIndex;
    }
    if (times.length === 0) continue;
    const text = rawLine.slice(lastIndex).trim();
    for (const time of times) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

function plainToLines(plain) {
  return plain.split(/\r?\n/).map((text) => ({ time: 0, text: text.trim() }));
}

/** Normaliza una entrada de LRCLIB al formato del reproductor. */
export function normalizeLyrics(entry) {
  if (!entry || entry.instrumental) return EMPTY_LYRICS;
  const plain = typeof entry.plainLyrics === 'string' ? entry.plainLyrics.trim() : '';
  const syncedLines = parseLrc(entry.syncedLyrics);
  if (syncedLines.length > 0) {
    return { lines: syncedLines, synced: true, plain };
  }
  if (plain) {
    return { lines: plainToLines(plain), synced: false, plain };
  }
  return EMPTY_LYRICS;
}

/** Quita añadidos típicos de Audius: "(Official Video)", "[Remix]", "ft. X". */
export function cleanTitle(title) {
  return String(title ?? '')
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/\s+(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();
}

function hasLyrics(entry) {
  return Boolean(entry && !entry.instrumental && (entry.syncedLyrics || entry.plainLyrics));
}

async function requestJson(url, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function lookup(title, artist, signal) {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  const exact = await requestJson(`${LRCLIB_BASE_URL}/get?${params}`, signal);
  if (hasLyrics(exact)) return exact;

  const results = await requestJson(`${LRCLIB_BASE_URL}/search?${params}`, signal);
  if (!Array.isArray(results)) return null;
  return results.find((r) => !r.instrumental && r.syncedLyrics) ?? results.find(hasLyrics) ?? null;
}

/**
 * Busca la letra de una canción.
 * @returns {Promise<{lines: {time: number, text: string}[], synced: boolean, plain: string}>}
 */
export async function fetchLyrics({ title, artist } = {}, { signal } = {}) {
  const cleanedTitle = cleanTitle(title);
  const cleanedArtist = String(artist ?? '').trim();
  if (!cleanedTitle) return EMPTY_LYRICS;

  const key = `${cleanedTitle.toLowerCase()}\u0000${cleanedArtist.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const entry = await lookup(cleanedTitle, cleanedArtist, signal);
    const result = normalizeLyrics(entry);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  } catch (error) {
    // Los fallos de red no se guardan en caché para poder reintentar luego.
    if (error?.name !== 'AbortError') {
      console.warn(`No se pudieron cargar las letras: ${error?.message ?? error}`);
    }
    return EMPTY_LYRICS;
  }
}
