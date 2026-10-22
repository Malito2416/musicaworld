import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerPosition, usePlayerQueue, usePlayerState } from '../context/PlayerContext';
import { fetchLyrics } from '../services/lyricsApi';
import { isFavorite, toggleFavorite } from '../services/storage';

const TABS = [
  { key: 'song', label: 'Canción' },
  { key: 'lyrics', label: 'Letras' },
  { key: 'queue', label: 'Cola' },
];

export default function FullPlayerModal({ visible, onClose }) {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrevious,
    play,
    seekTo,
    shuffle,
    repeatMode,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerState();
  const { position, duration, isBuffering } = usePlayerPosition();
  const { queue } = usePlayerQueue();
  const { width, height } = useWindowDimensions();
  const [progressWidth, setProgressWidth] = useState(0);
  const [activeTab, setActiveTab] = useState('song');
  const [lyrics, setLyrics] = useState({ lines: [], synced: false, plain: '' });
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [fav, setFav] = useState(false);
  const scrollRef = useRef(null);
  const lineRefs = useRef([]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (event) => {
    if (!duration || !progressWidth) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / progressWidth));
    seekTo(ratio * duration);
  };

  useEffect(() => {
    const track = currentTrack;
    if (!track) return;
    let cancelled = false;
    const loadFav = async () => {
      const res = await isFavorite(track.id);
      if (!cancelled) setFav(res);
    };
    loadFav();
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => {
    const track = currentTrack;
    if (!track) return;
    if (activeTab !== 'lyrics') return;
    let cancelled = false;
    const load = async () => {
      setLyrics({ lines: [], synced: false, plain: '' });
      setLyricsLoading(true);
      try {
        const res = await fetchLyrics({ title: track.title, artist: track.artist });
        if (!cancelled) setLyrics(res);
      } finally {
        if (!cancelled) setLyricsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, activeTab]);

  useEffect(() => {
    if (activeTab !== 'lyrics' || !lyrics.synced || lyrics.lines.length === 0) return;
    const current = position;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= current + 0.3) idx = i;
      else break;
    }
    if (idx >= 0 && lineRefs.current[idx] && scrollRef.current) {
      lineRefs.current[idx].measureLayout(
        scrollRef.current,
        (_x, y) => {
          scrollRef.current.scrollTo({ y: y - height * 0.35, animated: true });
        },
        () => {}
      );
    }
  }, [position, activeTab, lyrics, height]);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const artworkSize = Math.min(width - 48, height * 0.38);

  const handleToggleFav = async () => {
    const res = await toggleFavorite(currentTrack);
    setFav(res);
  };

  const getCurrentLineIndex = () => {
    if (!lyrics.synced || lyrics.lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= position + 0.3) idx = i;
      else break;
    }
    return idx;
  };

  const currentLineIdx = getCurrentLineIndex();

  const renderSongTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.artworkContainer, { marginTop: height * 0.02 }]}>
        <Image source={{ uri: currentTrack.artwork }} style={[styles.artwork, { width: artworkSize, height: artworkSize }]} />
      </View>
      <View style={styles.trackDetails}>
        <View style={styles.trackText}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity onPress={handleToggleFav} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={28} color={fav ? '#1DB954' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>
      <View style={styles.progressContainer}>
        <TouchableOpacity activeOpacity={0.8} onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width)} onPress={handleSeek}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </TouchableOpacity>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration || currentTrack.duration)}</Text>
        </View>
      </View>
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={toggleShuffle}
          accessibilityRole="button"
          accessibilityLabel="Aleatorio"
          accessibilityState={{ selected: shuffle }}
        >
          <Ionicons name="shuffle" size={24} color={shuffle ? '#1DB954' : '#9B9B9B'} />
          {shuffle && <View style={styles.activeDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={playPrevious}><Ionicons name="play-skip-back" size={34} color="#FFFFFF" /></TouchableOpacity>
        <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause} activeOpacity={0.9}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={38} color="#000000" style={!isPlaying && { marginLeft: 4 }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={playNext}><Ionicons name="play-skip-forward" size={34} color="#FFFFFF" /></TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={cycleRepeat}
          accessibilityRole="button"
          accessibilityLabel={
            repeatMode === 'one' ? 'Repetir canción' : repeatMode === 'all' ? 'Repetir cola' : 'Repetir desactivado'
          }
        >
          <Ionicons name="repeat" size={24} color={repeatMode === 'off' ? '#9B9B9B' : '#1DB954'} />
          {repeatMode === 'one' && <Text style={styles.repeatOneBadge}>1</Text>}
          {repeatMode !== 'off' && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </View>
      {isBuffering && <Text style={styles.bufferingText}>Cargando…</Text>}
    </View>
  );

  const renderLyricsTab = () => (
    <View style={styles.tabContentLyrics}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.lyricsScroll} showsVerticalScrollIndicator={false}>
        {lyricsLoading && <Text style={styles.lyricsState}>Cargando letras...</Text>}
        {!lyricsLoading && lyrics.lines.length === 0 && (
          <View style={styles.lyricsEmpty}>
            <Ionicons name="text-outline" size={48} color="#6B6B6B" />
            <Text style={styles.lyricsState}>Sin letras disponibles para esta canción</Text>
          </View>
        )}
        {lyrics.lines.map((line, idx) => {
          const isActive = lyrics.synced && idx === currentLineIdx;
          const isPassed = lyrics.synced && idx < currentLineIdx;
          return (
            <View
              key={idx}
              ref={(ref) => (lineRefs.current[idx] = ref)}
              style={[styles.lyricLineWrap, isActive && styles.lyricLineWrapActive]}
            >
              <Text style={[styles.lyricLine, isActive && styles.lyricLineActive, isPassed && styles.lyricLinePassed]}>{line.text}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderQueueTab = () => (
    <View style={styles.tabContentLyrics}>
      <Text style={styles.queueTitle}>Cola</Text>
      <FlatList
        data={queue}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        renderItem={({ item }) => {
          const isCurrent = item.id === currentTrack.id;
          return (
            <TouchableOpacity style={styles.queueItem} onPress={() => play(item, queue)} activeOpacity={0.7}>
              <Image source={{ uri: item.artwork }} style={styles.queueCover} />
              <View style={styles.queueInfo}>
                <Text style={[styles.queueTrackTitle, isCurrent && styles.queueTrackTitleActive]} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.queueTrackArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
              {isCurrent && isPlaying && <Ionicons name="stats-chart" size={16} color="#1DB954" />}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.playingFrom}>REPRODUCIENDO</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {activeTab === 'song' && renderSongTab()}
        {activeTab === 'lyrics' && renderLyricsTab()}
        {activeTab === 'queue' && renderQueueTab()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 48, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  iconBtn: { padding: 6 },
  headerTitleWrap: { alignItems: 'center' },
  playingFrom: { color: '#B3B3B3', fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  sourceText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 2 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, marginBottom: 8, paddingHorizontal: 20 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 6 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#FFFFFF' },
  tabText: { color: '#9B9B9B', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  tabContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  tabContentLyrics: { flex: 1, paddingTop: 10 },
  artworkContainer: { alignItems: 'center' },
  artwork: { borderRadius: 12, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 16 },
  trackDetails: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  trackText: { flex: 1, marginRight: 16 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  artist: { color: '#B3B3B3', fontSize: 16, marginTop: 4 },
  progressContainer: { marginTop: 24 },
  progressBarBackground: { height: 4, backgroundColor: '#404040', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFFFFF' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeText: { color: '#B3B3B3', fontSize: 12 },
  controlsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  controlBtn: { padding: 8 },
  secondaryBtn: { padding: 10, alignItems: 'center' },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1DB954',
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 12,
    paddingHorizontal: 2,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1DB954',
    color: '#000000',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  playPauseBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bufferingText: { color: '#B3B3B3', fontSize: 12, textAlign: 'center', marginBottom: 6 },
  lyricsScroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 120 },
  lyricsEmpty: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 12 },
  lyricsState: { color: '#9B9B9B', fontSize: 15, textAlign: 'center' },
  lyricLineWrap: { marginVertical: 8 },
  lyricLineWrapActive: { marginVertical: 12 },
  lyricLine: { color: 'rgba(255,255,255,0.35)', fontSize: 24, fontWeight: '700', lineHeight: 34 },
  lyricLineActive: { color: '#FFFFFF', fontSize: 28, lineHeight: 38 },
  lyricLinePassed: { color: 'rgba(255,255,255,0.6)' },
  queueTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', paddingHorizontal: 24, marginBottom: 12, marginTop: 6 },
  queueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, paddingHorizontal: 24 },
  queueCover: { width: 48, height: 48, borderRadius: 8 },
  queueInfo: { flex: 1 },
  queueTrackTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  queueTrackTitleActive: { color: '#1DB954' },
  queueTrackArtist: { color: '#9B9B9B', fontSize: 13, marginTop: 2 },
});
