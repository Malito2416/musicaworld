import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import {
  autoAdvanceTrack,
  nextRepeatMode,
  nextTrack,
  previousTrack,
  shuffleQueue,
} from '../services/queue';

/**
 * Estado del reproductor.
 *
 * El estado "vivo" (pista actual, cola, reproduciendo) va en un contexto aparte
 * del de posición, para que la lista de pistas no se vuelva a renderizar en cada
 * tick de progreso del reproductor.
 */
const PlayerStateContext = createContext(null);
const PlayerPositionContext = createContext(null);
const PlayerQueueContext = createContext(null);

/**
 * `loop` es una propiedad del reproductor nativo: se fija fuera del componente
 * para que el React Compiler no lo trate como una mutación del valor del hook.
 */
function setPlayerLoop(player, enabled) {
  player.loop = enabled;
}

export function PlayerProvider({ children }) {
  // useAudioPlayer libera el reproductor al desmontar: no hay fugas de audio.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [playError, setPlayError] = useState(null);
  const [queue, setQueue] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');

  // Refs espejo: las acciones se leen siempre del valor más reciente,
  // sin quedar atrapadas en el render en el que se crearon.
  const queueRef = useRef([]);
  // Orden original de la lista, para restaurarlo al desactivar el aleatorio.
  const originalQueueRef = useRef([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef('off');
  const trackRef = useRef(null);
  const playingRef = useRef(false);
  const finishedRef = useRef(false);

  const isPlaying = status.playing === true;
  const error = status.error ? `Error de reproducción: ${status.error}` : playError;

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((err) => {
      console.warn('No se pudo configurar el modo de audio:', err);
    });
  }, []);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  const play = useCallback(
    (track, sourceList) => {
      const list = sourceList?.length ? sourceList : [track];

      // Elegir una pista de la cola actual (pestaña "Cola" o siguiente/anterior)
      // conserva su orden; una lista nueva se baraja si el aleatorio está activo.
      if (list !== queueRef.current) {
        originalQueueRef.current = list;
        const playback = shuffleRef.current ? shuffleQueue(list, track.id) : list;
        queueRef.current = playback;
        setQueue(playback);
      }
      trackRef.current = track;
      playingRef.current = true;
      finishedRef.current = false;
      setCurrentTrack(track);
      setPlayError(null);

      try {
        player.replace({ uri: track.streamUrl });
        setPlayerLoop(player, repeatRef.current === 'one');
        player.play();
      } catch (err) {
        console.warn('No se pudo iniciar la reproducción:', err);
        setPlayError(`No se pudo reproducir "${track.title}".`);
        return;
      }

      // Controles de bloqueo: en Android son obligatorios para que el audio
      // siga sonando en segundo plano.
      try {
        player.setActiveForLockScreen(true, {
          title: track.title,
          artist: track.artist,
          artworkUrl: track.artwork,
        });
      } catch (err) {
        console.warn('Sin controles de pantalla de bloqueo:', err);
      }
    },
    [player]
  );

  const togglePlayPause = useCallback(() => {
    if (!trackRef.current) return;
    if (playingRef.current) {
      playingRef.current = false;
      player.pause();
    } else {
      playingRef.current = true;
      player.play();
    }
  }, [player]);

  const playNext = useCallback(() => {
    const list = queueRef.current;
    const current = trackRef.current;
    if (!current) return;

    const next = nextTrack(list, current.id);
    if (next) play(next, list);
  }, [play]);

  const playPrevious = useCallback(() => {
    const list = queueRef.current;
    const current = trackRef.current;
    if (!current) return;

    const previous = previousTrack(list, current.id);
    if (previous) play(previous, list);
  }, [play]);

  const seekTo = useCallback(
    (seconds) => {
      if (!trackRef.current) return;
      player.seekTo(Math.max(0, seconds));
    },
    [player]
  );

  const toggleShuffle = useCallback(() => {
    const enabled = !shuffleRef.current;
    shuffleRef.current = enabled;
    setShuffle(enabled);

    const current = trackRef.current;
    if (!current) return;
    const original = originalQueueRef.current;
    const playback = enabled ? shuffleQueue(original, current.id) : original;
    queueRef.current = playback;
    setQueue(playback);
  }, []);

  const cycleRepeat = useCallback(() => {
    const mode = nextRepeatMode(repeatRef.current);
    repeatRef.current = mode;
    setRepeatMode(mode);
    // `loop` lo maneja el reproductor nativo, así que también funciona en
    // segundo plano sin depender de que JS reaccione al final de la pista.
    try {
      setPlayerLoop(player, mode === 'one');
    } catch (err) {
      console.warn('No se pudo cambiar el modo de repetición:', err);
    }
  }, [player]);

  // Auto-avance: solo cuando `didJustFinish` pasa de false a true, para no
  // avanzar varias veces por el mismo final de pista.
  useEffect(() => {
    if (!status.didJustFinish) {
      finishedRef.current = false;
      return;
    }
    if (finishedRef.current) return;
    finishedRef.current = true;

    const current = trackRef.current;
    if (!current) return;
    const next = autoAdvanceTrack(queueRef.current, current.id, repeatRef.current);
    if (next) {
      play(next, queueRef.current);
    } else {
      // Fin de la cola sin repetición: se queda en pausa al inicio de la pista.
      playingRef.current = false;
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, play, player]);

  const state = useMemo(
    () => ({
      currentTrack,
      isPlaying,
      error,
      shuffle,
      repeatMode,
      play,
      togglePlayPause,
      playNext,
      playPrevious,
      seekTo,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      currentTrack,
      isPlaying,
      error,
      shuffle,
      repeatMode,
      play,
      togglePlayPause,
      playNext,
      playPrevious,
      seekTo,
      toggleShuffle,
      cycleRepeat,
    ]
  );

  const position = useMemo(
    () => ({
      position: status.currentTime ?? 0,
      duration: status.duration ?? 0,
      isBuffering: status.isBuffering === true,
    }),
    [status.currentTime, status.duration, status.isBuffering]
  );

  const queueState = useMemo(
    () => ({
      queue,
      currentTrack,
    }),
    [queue, currentTrack]
  );

  return (
    <PlayerStateContext.Provider value={state}>
      <PlayerPositionContext.Provider value={position}>
        <PlayerQueueContext.Provider value={queueState}>{children}</PlayerQueueContext.Provider>
      </PlayerPositionContext.Provider>
    </PlayerStateContext.Provider>
  );
}

export function usePlayerState() {
  const value = useContext(PlayerStateContext);
  if (!value) throw new Error('usePlayerState debe usarse dentro de <PlayerProvider>');
  return value;
}

export function usePlayerPosition() {
  const value = useContext(PlayerPositionContext);
  if (!value) throw new Error('usePlayerPosition debe usarse dentro de <PlayerProvider>');
  return value;
}

export function usePlayerQueue() {
  const value = useContext(PlayerQueueContext);
  if (!value) throw new Error('usePlayerQueue debe usarse dentro de <PlayerProvider>');
  return value;
}
