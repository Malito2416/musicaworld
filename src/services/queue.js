/**
 * Utilidades de cola de reproducción.
 *
 * Son funciones puras a propósito: la cola es la parte que antes fallaba
 * (avanzar usando la pista anterior), y así queda cubierta por tests.
 */

/**
 * Devuelve la pista siguiente en la cola, con vuelta al principio.
 * @param {object[]} list
 * @param {string} currentId
 * @returns {object|null}
 */
export function nextTrack(list, currentId) {
  if (!Array.isArray(list) || list.length === 0) return null;

  const index = list.findIndex((track) => track.id === currentId);
  if (index === -1) return list[0];

  return list[(index + 1) % list.length];
}

/**
 * Devuelve la pista anterior en la cola, con vuelta al final.
 * @param {object[]} list
 * @param {string} currentId
 * @returns {object|null}
 */
export function previousTrack(list, currentId) {
  if (!Array.isArray(list) || list.length === 0) return null;

  const index = list.findIndex((track) => track.id === currentId);
  if (index === -1) return list[list.length - 1];

  return list[(index - 1 + list.length) % list.length];
}

/** Modos de repetición, en el orden en que los recorre el botón. */
export const REPEAT_MODES = ['off', 'all', 'one'];

export function nextRepeatMode(mode) {
  const index = REPEAT_MODES.indexOf(mode);
  return REPEAT_MODES[(index + 1) % REPEAT_MODES.length];
}

/**
 * Pista que debe sonar cuando la actual termina sola.
 * - `one`: la misma pista.
 * - `all`: la siguiente, con vuelta al principio.
 * - `off`: la siguiente, o `null` al llegar al final (se detiene).
 * @returns {object|null}
 */
export function autoAdvanceTrack(list, currentId, repeatMode) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const index = list.findIndex((track) => track.id === currentId);

  if (repeatMode === 'one' && index !== -1) return list[index];
  if (repeatMode === 'off' && index === list.length - 1) return null;
  return nextTrack(list, currentId);
}

/**
 * Baraja la cola dejando la pista actual en primer lugar (Fisher-Yates).
 * No modifica la lista original.
 * @param {() => number} random generador en [0, 1), inyectable para tests.
 */
export function shuffleQueue(list, currentId, random = Math.random) {
  if (!Array.isArray(list)) return [];
  const current = list.find((track) => track.id === currentId);
  const rest = list.filter((track) => track.id !== currentId);

  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return current ? [current, ...rest] : rest;
}
