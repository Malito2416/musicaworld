import { describe, expect, it } from 'vitest';

import { autoAdvanceTrack, nextRepeatMode, nextTrack, previousTrack, shuffleQueue } from '../queue';

const list = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

describe('cola de reproducción', () => {
  it('avanza a la siguiente pista', () => {
    expect(nextTrack(list, 'a').id).toBe('b');
    expect(nextTrack(list, 'b').id).toBe('c');
  });

  it('da la vuelta al final de la lista', () => {
    expect(nextTrack(list, 'c').id).toBe('a');
  });

  it('retrocede a la pista anterior', () => {
    expect(previousTrack(list, 'c').id).toBe('b');
    expect(previousTrack(list, 'b').id).toBe('a');
  });

  it('da la vuelta al principio de la lista', () => {
    expect(previousTrack(list, 'a').id).toBe('c');
  });

  it('no rompe con listas vacías', () => {
    expect(nextTrack([], 'a')).toBeNull();
    expect(previousTrack([], 'a')).toBeNull();
  });

  it('arranca en la primera pista si la actual no está en la cola', () => {
    expect(nextTrack(list, 'zzz').id).toBe('a');
    expect(previousTrack(list, 'zzz').id).toBe('c');
  });
});

describe('repetición', () => {
  it('recorre off → all → one → off', () => {
    expect(nextRepeatMode('off')).toBe('all');
    expect(nextRepeatMode('all')).toBe('one');
    expect(nextRepeatMode('one')).toBe('off');
  });

  it('sin repetición se detiene al final de la cola', () => {
    expect(autoAdvanceTrack(list, 'a', 'off').id).toBe('b');
    expect(autoAdvanceTrack(list, 'c', 'off')).toBeNull();
  });

  it('repetir cola vuelve al principio', () => {
    expect(autoAdvanceTrack(list, 'c', 'all').id).toBe('a');
  });

  it('repetir canción devuelve la misma pista', () => {
    expect(autoAdvanceTrack(list, 'b', 'one').id).toBe('b');
  });

  it('no rompe con listas vacías', () => {
    expect(autoAdvanceTrack([], 'a', 'all')).toBeNull();
  });
});

describe('aleatorio', () => {
  const big = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));

  it('deja la pista actual primero y conserva todas las pistas', () => {
    const shuffled = shuffleQueue(big, '5', () => 0);
    expect(shuffled[0].id).toBe('5');
    expect(shuffled.map((t) => t.id).sort()).toEqual(big.map((t) => t.id).sort());
  });

  it('cambia el orden y no modifica la lista original', () => {
    const before = big.map((t) => t.id);
    const shuffled = shuffleQueue(big, '0', () => 0);
    expect(shuffled.map((t) => t.id)).not.toEqual(before);
    expect(big.map((t) => t.id)).toEqual(before);
  });

  it('funciona si la pista actual no está en la lista', () => {
    expect(shuffleQueue(list, 'zzz', () => 0.5)).toHaveLength(3);
    expect(shuffleQueue(null, 'a')).toEqual([]);
  });
});
