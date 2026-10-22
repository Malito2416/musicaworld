import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePlayerPosition, usePlayerState } from '../context/PlayerContext';

export default function MiniPlayer({ bottomOffset = 0, onExpand }) {
  const { currentTrack, isPlaying, togglePlayPause, playNext } = usePlayerState();
  const { position, duration } = usePlayerPosition();

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.container, { bottom: 58 + bottomOffset }]}
      onPress={onExpand}
    >
      <View style={styles.inner}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Image source={{ uri: currentTrack.artwork }} style={styles.cover} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.btn} onPress={togglePlayPause} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#FFFFFF" style={!isPlaying && { marginLeft: 2 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={playNext} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: '#282828',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#B3B3B3',
    fontSize: 12,
    marginTop: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    padding: 8,
  },
});
