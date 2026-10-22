import { afterEach, describe, expect, it, vi } from 'vitest';

const HOST_A = 'https://host-a.example';
const HOST_B = 'https://host-b.example';
const HOST_C = 'https://host-c.example';

// Las peticiones de sondeo piden `limit=1`; las de datos piden otro límite.
const isProbe = (url) => /[?&]limit=1(&|$)/.test(url);

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

/**
 * Crea un fetch simulado que respeta el AbortSignal y permite responder con
 * distinto retardo por host, para comprobar que el sondeo es en paralelo.
 */
function createFetchMock({ delays = {}, data, failures = [] }) {
  const calls = [];

  const fetchMock = vi.fn((url, init) => {
    calls.push(url);

    const signal = init?.signal;
    if (signal?.aborted) return Promise.reject(abortError());

    const host = Object.keys(delays).find((candidate) => url.startsWith(candidate));
    const delay = host ? delays[host] : 0;
    const shouldFail = failures.some((candidate) => url.startsWith(candidate));

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (shouldFail) {
          reject(new Error('network down'));
          return;
        }
        resolve(jsonResponse(data));
      }, delay);

      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(abortError());
      });
    });
  });

  return { fetchMock, calls };
}

async function loadApi() {
  vi.resetModules();
  const api = await import('../musicApi');
  // Se sustituyen los hosts reales por hosts de prueba controlables.
  api.AUDIUS_HOSTS.splice(0, api.AUDIUS_HOSTS.length, HOST_A, HOST_B, HOST_C);
  return api;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('musicApi', () => {
  it('sondea los hosts en paralelo y se queda con el primero que responde', async () => {
    const { fetchTrendingTracks } = await loadApi();
    const { fetchMock, calls } = createFetchMock({
      delays: { [HOST_A]: 120, [HOST_B]: 10, [HOST_C]: 200 },
      data: { data: [{ id: '1', title: 'Canción', user: { name: 'Artista' } }] },
    });
    vi.stubGlobal('fetch', fetchMock);

    const { tracks, source } = await fetchTrendingTracks(10);

    expect(source).toBe('audius');
    // El host más rápido es el que se usa, aunque se haya pedido antes otro.
    expect(tracks[0].streamUrl).toContain(HOST_B);
    // Los tres hosts se sondean a la vez: no se espera al primero en serie.
    expect(calls.filter(isProbe).length).toBe(3);
  });

  it('cachea el host válido y no vuelve a sondearlo', async () => {
    const { fetchTrendingTracks } = await loadApi();
    const { fetchMock, calls } = createFetchMock({
      delays: { [HOST_A]: 10, [HOST_B]: 5, [HOST_C]: 5 },
      data: { data: [{ id: '1', title: 'Canción' }] },
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchTrendingTracks(10);
    const probesAfterFirst = calls.filter(isProbe).length;
    await fetchTrendingTracks(10);
    const probesAfterSecond = calls.filter(isProbe).length;

    expect(probesAfterFirst).toBe(3);
    expect(probesAfterSecond).toBe(probesAfterFirst);
  });

  it('normaliza las pistas con la URL de streaming del host usado', async () => {
    const { fetchTrendingTracks } = await loadApi();
    const { fetchMock } = createFetchMock({
      delays: { [HOST_A]: 5, [HOST_B]: 80, [HOST_C]: 80 },
      data: {
        data: [
          {
            id: 'abc',
            title: '  Título  ',
            user: { name: 'Artista' },
            artwork: { '480x480': 'https://img.example/480.jpg' },
            duration: 120,
            genre: 'Techno',
          },
        ],
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const { tracks } = await fetchTrendingTracks(10);

    expect(tracks[0]).toMatchObject({
      id: 'abc',
      title: 'Título',
      artist: 'Artista',
      artwork: 'https://img.example/480.jpg',
      duration: 120,
      genre: 'Techno',
    });
    expect(tracks[0].streamUrl).toBe(`${HOST_A}/v1/tracks/abc/stream?app_name=MusicWorldApp`);
  });

  it('devuelve las pistas de respaldo cuando ningún host responde', async () => {
    const { fetchTrendingTracks } = await loadApi();
    const { fetchMock } = createFetchMock({ failures: ['https://'] });
    vi.stubGlobal('fetch', fetchMock);

    const { tracks, source } = await fetchTrendingTracks(10);

    expect(source).toBe('offline');
    expect(tracks.length).toBeGreaterThan(0);
    // Las pistas de respaldo deben apuntar a archivos reales, no a URLs muertas.
    for (const track of tracks) {
      expect(track.streamUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
    }
  });

  it('propaga la cancelación de la petición', async () => {
    const { searchTracks } = await loadApi();
    const { fetchMock } = createFetchMock({ data: { data: [] } });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    controller.abort();

    await expect(searchTracks('daft punk', 10, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('lanza un error entendible cuando la búsqueda falla', async () => {
    const { searchTracks } = await loadApi();
    const { fetchMock } = createFetchMock({ failures: ['https://'] });
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchTracks('daft punk', 10)).rejects.toThrow(/No se pudo completar la búsqueda/);
  });
});
