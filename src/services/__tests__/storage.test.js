import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();
const asyncStorage = {
  getItem: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  setItem: vi.fn(async (key, value) => {
    store.set(key, value);
  }),
};

vi.mock('@react-native-async-storage/async-storage', () => ({ default: asyncStorage }));

const { FAVORITES_KEY, getFavorites, isFavorite, toggleFavorite } = await import('../storage');

const track = (id) => ({ id, title: `T${id}`, artist: 'A', artwork: 'x', duration: 1, streamUrl: 's' });

describe('storage (favoritos)', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('añade y quita favoritos persistiendo la pista completa', async () => {
    expect(await isFavorite('1')).toBe(false);

    expect(await toggleFavorite(track('1'))).toBe(true);
    expect(await isFavorite('1')).toBe(true);
    expect(JSON.parse(store.get(FAVORITES_KEY))).toEqual([track('1')]);

    expect(await toggleFavorite(track('1'))).toBe(false);
    expect(await isFavorite('1')).toBe(false);
  });

  it('pone el favorito más reciente primero', async () => {
    await toggleFavorite(track('1'));
    await toggleFavorite(track('2'));
    expect((await getFavorites()).map((t) => t.id)).toEqual(['2', '1']);
  });

  it('serializa toques rápidos para que no se pierdan escrituras', async () => {
    const results = await Promise.all([toggleFavorite(track('1')), toggleFavorite(track('2')), toggleFavorite(track('1'))]);
    expect(results).toEqual([true, true, false]);
    expect((await getFavorites()).map((t) => t.id)).toEqual(['2']);
  });

  it('tolera datos guardados ilegibles', async () => {
    store.set(FAVORITES_KEY, '{no es json');
    expect(await getFavorites()).toEqual([]);
    expect(await toggleFavorite(track('1'))).toBe(true);
  });

  it('conserva el estado anterior si falla la escritura', async () => {
    asyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
    expect(await toggleFavorite(track('1'))).toBe(false);
    expect(await isFavorite('1')).toBe(false);
  });

  it('ignora pistas sin id', async () => {
    expect(await toggleFavorite(null)).toBe(false);
    expect(await isFavorite(undefined)).toBe(false);
    expect(asyncStorage.setItem).not.toHaveBeenCalled();
  });
});
