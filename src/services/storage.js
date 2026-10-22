import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Favoritos persistidos en AsyncStorage como una lista JSON de pistas.
 *
 * Ninguna función lanza: si el almacenamiento falla, el reproductor sigue
 * funcionando y el corazón simplemente conserva su estado anterior.
 */

export const FAVORITES_KEY = 'musicworld:favorites';

// Serializa las escrituras para que dos toques rápidos no se pisen.
let writeChain = Promise.resolve();

async function readFavorites() {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.id != null) : [];
  } catch {
    console.warn('Favoritos guardados ilegibles; se empieza con una lista vacía.');
    return [];
  }
}

/** Lista de pistas favoritas, la más reciente primero. */
export async function getFavorites() {
  try {
    return await readFavorites();
  } catch (error) {
    console.warn(`No se pudieron leer los favoritos: ${error?.message ?? error}`);
    return [];
  }
}

export async function isFavorite(trackId) {
  if (trackId == null) return false;
  await writeChain;
  const favorites = await getFavorites();
  return favorites.some((t) => t.id === trackId);
}

/**
 * Añade o quita la pista de favoritos.
 * @returns {Promise<boolean>} si la pista queda como favorita.
 */
export function toggleFavorite(track) {
  if (!track || track.id == null) return Promise.resolve(false);

  const run = async () => {
    let favorites;
    try {
      favorites = await readFavorites();
    } catch (error) {
      console.warn(`No se pudieron leer los favoritos: ${error?.message ?? error}`);
      return false;
    }
    const wasFavorite = favorites.some((t) => t.id === track.id);
    const next = wasFavorite
      ? favorites.filter((t) => t.id !== track.id)
      : [{ ...track }, ...favorites]; // ya viene normalizada por musicApi
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return !wasFavorite;
    } catch (error) {
      console.warn(`No se pudieron guardar los favoritos: ${error?.message ?? error}`);
      return wasFavorite;
    }
  };

  const result = writeChain.then(run);
  writeChain = result.catch(() => {});
  return result;
}
