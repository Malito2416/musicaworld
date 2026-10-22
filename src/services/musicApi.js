/**
 * MusicWorld - Free Music API Service (Audius Network)
 * Streaming de música sin API keys de pago sobre la red descentralizada Audius.
 *
 * Los hosts de descubrimiento de Audius son públicos y pueden caerse o ir lentos,
 * así que el descubrimiento se sondea en paralelo con timeout y el host válido
 * se cachea para no repetir el sondeo en cada búsqueda.
 */

const AUDIUS_APP_NAME = 'MusicWorldApp';

/**
 * Hosts de descubrimiento públicos de Audius.
 * Se exportan para poder sustituirlos en los tests.
 */
export const AUDIUS_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
  'https://audius-dp.amsterdam.creatorseed.com',
];

const HOST_PROBE_TIMEOUT_MS = 6000;
const REQUEST_TIMEOUT_MS = 12000;

const FALLBACK_ARTWORK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';

let cachedHost = null;
let pendingHost = null;

export function isAbortError(error) {
  return error?.name === 'AbortError';
}

function createRequest(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abort);
    }
  }

  const timer = setTimeout(abort, timeoutMs);

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abort);
    },
  };
}

async function fetchJson(url, { signal, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const request = createRequest(signal, timeoutMs);
  try {
    const res = await fetch(url, { signal: request.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    request.dispose();
  }
}

function probeHost(host) {
  const request = createRequest(undefined, HOST_PROBE_TIMEOUT_MS);
  return fetch(`${host}/v1/tracks/trending?app_name=${AUDIUS_APP_NAME}&limit=1`, {
    signal: request.signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return host;
    })
    .finally(() => request.dispose());
}

/**
 * Devuelve un host de descubrimiento operativo. Sondea todos los hosts a la vez
 * y se queda con el primero que responde, en vez de esperar en serie a los caídos.
 */
async function discoverHost() {
  if (cachedHost) return cachedHost;

  if (!pendingHost) {
    pendingHost = new Promise((resolve) => {
      let settled = false;
      const settle = (host) => {
        if (settled) return;
        settled = true;
        resolve(host);
      };

      Promise.all(
        AUDIUS_HOSTS.map((host) =>
          probeHost(host)
            .then(() => settle(host))
            .catch(() => {})
        )
      ).then(() => settle(AUDIUS_HOSTS[0]));
    });
  }

  try {
    cachedHost = await pendingHost;
    return cachedHost;
  } finally {
    pendingHost = null;
  }
}

async function requestTracks(path, { signal } = {}) {
  let host = await discoverHost();

  try {
    return { host, json: await fetchJson(`${host}${path}`, { signal }) };
  } catch (error) {
    if (isAbortError(error)) throw error;
    // El host cacheado puede haberse caído: se rediscovering y se reintenta una vez.
    if (cachedHost === host) cachedHost = null;
    host = await discoverHost();
    return { host, json: await fetchJson(`${host}${path}`, { signal }) };
  }
}

function normalizeTrack(track, host) {
  const artwork = track.artwork?.['480x480'] || track.artwork?.['150x150'] || FALLBACK_ARTWORK;

  return {
    id: String(track.id),
    title: track.title?.trim() || 'Sin título',
    artist: track.user?.name?.trim() || 'Artista desconocido',
    artwork,
    duration: track.duration ?? 0,
    streamUrl: `${host}/v1/tracks/${track.id}/stream?app_name=${AUDIUS_APP_NAME}`,
    genre: track.genre || 'Música',
  };
}

/**
 * Tendencias globales.
 * @returns {Promise<{tracks: object[], source: 'audius'|'offline'}>} `source` indica si
 * se sirva la red de Audius o la lista local de respaldo.
 */
export async function fetchTrendingTracks(limit = 20, { signal } = {}) {
  try {
    const { host, json } = await requestTracks(
      `/v1/tracks/trending?app_name=${AUDIUS_APP_NAME}&limit=${limit}`,
      { signal }
    );
    const data = Array.isArray(json?.data) ? json.data : [];
    if (data.length === 0) return { tracks: getFallbackTracks(), source: 'offline' };
    return { tracks: data.map((track) => normalizeTrack(track, host)), source: 'audius' };
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn('No se pudieron cargar las tendencias:', error.message);
    return { tracks: getFallbackTracks(), source: 'offline' };
  }
}

/**
 * Búsqueda de pistas por texto libre.
 * @returns {Promise<{tracks: object[], source: 'audius'}>}
 */
export async function searchTracks(query, limit = 20, { signal } = {}) {
  const trimmed = query?.trim();
  if (!trimmed) return fetchTrendingTracks(limit, { signal });

  try {
    const { host, json } = await requestTracks(
      `/v1/tracks/search?query=${encodeURIComponent(trimmed)}&app_name=${AUDIUS_APP_NAME}&limit=${limit}`,
      { signal }
    );
    const data = Array.isArray(json?.data) ? json.data : [];
    return { tracks: data.map((track) => normalizeTrack(track, host)), source: 'audius' };
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn('Falló la búsqueda:', error.message);
    const failure = new Error('No se pudo completar la búsqueda. Revisa tu conexión e inténtalo de nuevo.');
    failure.cause = error;
    throw failure;
  }
}

/**
 * Pistas de respaldo para cuando Audius no responde. Archivos de dominio público
 * o CC0 alojados en Wikimedia Commons, con URLs verificadas y estables.
 */
function getFallbackTracks() {
  return [
    {
      id: 'fb-1',
      title: 'Hypnotic Ambient Electronic Music',
      artist: 'MusicLM · Dominio público',
      artwork: FALLBACK_ARTWORK,
      duration: 0,
      streamUrl:
        'https://upload.wikimedia.org/wikipedia/commons/5/50/Hypnotic_ambient_electronic_music_by_MusicLM.mp3',
      genre: 'Ambient',
    },
    {
      id: 'fb-2',
      title: 'Music Seifi',
      artist: 'Seifi · CC0',
      artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80',
      duration: 0,
      streamUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Music_Seifi.ogg',
      genre: 'Electrónica',
    },
    {
      id: 'fb-3',
      title: 'Rainy Mood and Jazz Music',
      artist: 'Tripacer · Dominio público',
      artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
      duration: 0,
      streamUrl:
        'https://upload.wikimedia.org/wikipedia/commons/5/5e/Rainy_Mood_and_Jazz_Music_by_Tripacer.oga',
      genre: 'Jazz',
    },
    {
      id: 'fb-4',
      title: 'Frolic · Music for Twilight',
      artist: 'National Park Service · Dominio público',
      artwork: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&q=80',
      duration: 0,
      streamUrl:
        'https://upload.wikimedia.org/wikipedia/commons/b/ba/%22Frolic%22_from_%22Music_for_Twilight%22_on_the_Netherlands_Carillon.ogg',
      genre: 'Carillón',
    },
  ];
}
