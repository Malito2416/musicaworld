import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { fetchTrendingTracks, isAbortError, searchTracks } from './src/services/musicApi';
import { PlayerProvider, usePlayerState } from './src/context/PlayerContext';
import MiniPlayer from './src/components/MiniPlayer';
import FullPlayerModal from './src/components/FullPlayerModal';

const TRACKS_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 350;

export default function App() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <HomeScreen />
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, error: playerError, play } = usePlayerState();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [degraded, setDegraded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const searchTimerRef = useRef(null);
  const requestRef = useRef(null);

  const runRequest = useCallback(async (operation) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);

    try {
      await operation(controller.signal);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const loadTrending = useCallback(
    (signal) =>
      runRequest(async (requestSignal) => {
        const result = await fetchTrendingTracks(TRACKS_LIMIT, { signal: requestSignal });
        setTracks(result.tracks);
        setDegraded(result.source === 'offline');
        setError(null);
      }),
    [runRequest]
  );

  useEffect(() => {
    loadTrending();
    return () => {
      requestRef.current?.abort();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [loadTrending]);

  const handleSearch = useCallback(
    (text) => {
      setSearchQuery(text);

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      const query = text.trim();
      if (!query) {
        loadTrending();
        return;
      }

      // Se espera a que el usuario termine de escribir y se cancela la
      // petición anterior para que no lleguen resultados fuera de orden.
      searchTimerRef.current = setTimeout(() => {
        runRequest(async (signal) => {
          const result = await searchTracks(query, TRACKS_LIMIT, { signal });
          setTracks(result.tracks);
          setError(null);
        });
      }, SEARCH_DEBOUNCE_MS);
    },
    [loadTrending, runRequest]
  );

  const handleSelectTrack = useCallback(
    (track) => {
      play(track, tracks);
    },
    [play, tracks]
  );

  const renderTrackItem = useCallback(
    ({ item }) => {
      const isCurrent = currentTrack?.id === item.id;

      return (
        <TouchableOpacity
          style={styles.trackCard}
          onPress={() => handleSelectTrack(item)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.artwork }} style={styles.trackCover} />
          <View style={styles.trackDetails}>
            <Text style={[styles.trackTitle, isCurrent && styles.trackTitleActive]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          {isCurrent && isPlaying ? (
            <Ionicons name="stats-chart" size={18} color="#1DB954" style={styles.playingIcon} />
          ) : (
            <TouchableOpacity style={styles.moreBtn}>
              <Ionicons name="ellipsis-vertical" size={18} color="#B3B3B3" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [currentTrack?.id, handleSelectTrack, isPlaying]
  );

  const emptyMessage = searchQuery ? 'No se encontraron canciones.' : 'No hay canciones para mostrar.';
  const listBottomPadding = 130 + insets.bottom;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* App Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('./assets/icon.png')} style={styles.logo} />
          <Text style={styles.brandTitle}>
            Music<Text style={styles.brandAccent}>World</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.profileBtn}>
          <Ionicons name="person-circle-outline" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#B3B3B3" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="¿Qué quieres escuchar hoy?"
          placeholderTextColor="#777777"
          value={searchQuery}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#B3B3B3" />
          </TouchableOpacity>
        )}
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? 'Resultados de búsqueda' : 'Tendencias Globales'}
        </Text>
        <Text style={styles.subtitle}>Streaming sin límites</Text>
      </View>

      {/* Avisos */}
      {degraded && !error && (
        <View style={styles.banner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#F5A623" />
          <Text style={styles.bannerText}>Sin conexión con Audius: mostrando pistas locales.</Text>
        </View>
      )}
      {(error || playerError) && (
        <View style={[styles.banner, styles.bannerError]}>
          <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
          <Text style={styles.bannerText}>{error || playerError}</Text>
        </View>
      )}

      {/* Song List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Sintonizando la música...</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          contentContainerStyle={{ paddingBottom: listBottomPadding, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={48} color="#555" />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              {error ? (
                <TouchableOpacity style={styles.retryBtn} onPress={() => loadTrending()}>
                  <Ionicons name="refresh" size={16} color="#121212" />
                  <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* Bottom Floating MiniPlayer */}
      <MiniPlayer bottomOffset={insets.bottom} onExpand={() => setModalVisible(true)} />

      {/* Bottom Navigation Mockup */}
      <View style={[styles.navBar, { height: 54 + insets.bottom, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={22} color="#1DB954" />
          <Text style={[styles.navText, styles.navTextActive]}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => handleSearch('top hits')}>
          <Ionicons name="search" size={22} color="#B3B3B3" />
          <Text style={styles.navText}>Explorar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="library" size={22} color="#B3B3B3" />
          <Text style={styles.navText}>Tu biblioteca</Text>
        </TouchableOpacity>
      </View>

      {/* Full Player Modal */}
      <FullPlayerModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: '#1DB954',
  },
  profileBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    height: 44,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 10,
  },
  clearBtn: {
    marginRight: 10,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#B3B3B3',
    marginTop: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  bannerError: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  bannerText: {
    flex: 1,
    color: '#E8E8E8',
    fontSize: 12,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackCover: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  trackDetails: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trackTitleActive: {
    color: '#1DB954',
  },
  trackArtist: {
    fontSize: 13,
    color: '#B3B3B3',
    marginTop: 4,
  },
  playingIcon: {
    marginRight: 8,
  },
  moreBtn: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1DB954',
  },
  retryText: {
    color: '#121212',
    fontSize: 13,
    fontWeight: '600',
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#282828',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
  },
  navText: {
    color: '#B3B3B3',
    fontSize: 10,
    marginTop: 2,
  },
  navTextActive: {
    color: '#1DB954',
  },
});
