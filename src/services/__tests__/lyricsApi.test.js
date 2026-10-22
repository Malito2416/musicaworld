import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LRCLIB_BASE_URL,
  cleanTitle,
  clearLyricsCache,
  fetchLyrics,
  normalizeLyrics,
  parseLrc,
} from '../lyricsApi';

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

describe('parseLrc', () => {
  it('convierte marcas de tiempo a segundos y ordena las líneas', () => {
    const lrc = '[ar:Queen]\n[00:12.50] Segunda\n[00:01.00] Primera\n\nsin marca';
    expect(parseLrc(lrc)).toEqual([
      { time: 1, text: 'Primera' },
      { time: 12.5, text: 'Segunda' },
    ]);
  });

  it('admite varias marcas en la misma línea y minutos de más de dos dígitos', () => {
    expect(parseLrc('[00:05.00][100:00.00] Coro')).toEqual([
      { time: 5, text: 'Coro' },
      { time: 6000, text: 'Coro' },
    ]);
  });

  it('devuelve lista vacía para entradas que no son texto', () => {
    expect(parseLrc(null)).toEqual([]);
    expect(parseLrc('')).toEqual([]);
  });
});

describe('normalizeLyrics', () => {
  it('prefiere letras sincronizadas y conserva el texto plano', () => {
    const res = normalizeLyrics({ syncedLyrics: '[00:01.00] Hola', plainLyrics: 'Hola' });
    expect(res).toEqual({ lines: [{ time: 1, text: 'Hola' }], synced: true, plain: 'Hola' });
  });

  it('usa el texto plano cuando no hay sincronizadas', () => {
    const res = normalizeLyrics({ syncedLyrics: null, plainLyrics: 'A\nB' });
    expect(res.synced).toBe(false);
    expect(res.lines.map((l) => l.text)).toEqual(['A', 'B']);
  });

  it('trata pistas instrumentales como sin letra', () => {
    expect(normalizeLyrics({ instrumental: true, plainLyrics: 'x' }).lines).toEqual([]);
  });
});

describe('cleanTitle', () => {
  it('quita sufijos típicos de títulos de Audius', () => {
    expect(cleanTitle('Song Name (Official Video) [Remix] ft. Someone')).toBe('Song Name');
  });
});

describe('fetchLyrics', () => {
  beforeEach(() => {
    clearLyricsCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('consulta /get con título limpio y guarda el resultado en caché', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ syncedLyrics: '[00:02.00] Hey', plainLyrics: 'Hey' }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchLyrics({ title: 'Hey (Live)', artist: 'Band' });
    const second = await fetchLyrics({ title: 'Hey (Live)', artist: 'Band' });

    expect(first.synced).toBe(true);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(`${LRCLIB_BASE_URL}/get`);
    expect(url.searchParams.get('track_name')).toBe('Hey');
    expect(url.searchParams.get('artist_name')).toBe('Band');
  });

  it('recurre a /search cuando /get no encuentra la canción', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('/get?')) return jsonResponse(null, { ok: false, status: 404 });
      return jsonResponse([
        { instrumental: false, syncedLyrics: null, plainLyrics: 'Solo texto' },
        { instrumental: false, syncedLyrics: '[00:03.00] Con tiempo', plainLyrics: 'Con tiempo' },
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchLyrics({ title: 'Rara', artist: 'Nadie' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ lines: [{ time: 3, text: 'Con tiempo' }], synced: true, plain: 'Con tiempo' });
  });

  it('no lanza ante fallos de red y permite reintentar después', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(jsonResponse({ plainLyrics: 'Ya funciona' }));
    vi.stubGlobal('fetch', fetchMock);

    const failed = await fetchLyrics({ title: 'X', artist: 'Y' });
    expect(failed.lines).toEqual([]);

    const retried = await fetchLyrics({ title: 'X', artist: 'Y' });
    expect(retried.plain).toBe('Ya funciona');
  });

  it('no hace peticiones sin título', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchLyrics({ title: '  ', artist: 'Y' })).lines).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
