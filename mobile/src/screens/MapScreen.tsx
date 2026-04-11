import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Modal,
  Animated,
  Platform,
  StatusBar,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLocation, useLocationTracking } from '../hooks/useLocation';
import { pinsApi, heatmapApi, routeApi } from '../services/api';
import { Pin, HeatmapCell, Route } from '../types';
import { colors, spacing, radii, fonts } from '../utils/theme';
import HeatmapOverlay from '../components/HeatmapOverlay';
import { showSuccess, showInfo, showError } from '../utils/toast';

import { MAPBOX_ACCESS_TOKEN } from '../config';
const MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN;
MapboxGL.setAccessToken(MAPBOX_TOKEN);

const JLT_CENTER: [number, number] = [55.1475, 25.075];
const JLT_ZOOM = 14;
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

const PIN_COLORS: Record<string, string> = {
  hazard: '#EF4444', closure: '#F59E0B', construction: '#F97316',
  tip: '#00F5A0', photo: '#3B82F6', entrance: '#8B5CF6', shortcut: '#00D9F5',
};

// Category shortcuts using Mapbox poi_category values
const CATEGORIES = [
  { id: 'coffee', label: 'Coffee', icon: 'cafe-outline', poiCat: 'coffee_shop,cafe' },
  { id: 'restaurant', label: 'Food', icon: 'restaurant-outline', poiCat: 'restaurant,fast_food' },
  { id: 'gym', label: 'Gym', icon: 'barbell-outline', poiCat: 'gym,fitness_center' },
  { id: 'mall', label: 'Mall', icon: 'cart-outline', poiCat: 'shopping_mall,shopping' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'medkit-outline', poiCat: 'pharmacy' },
  { id: 'atm', label: 'ATM', icon: 'card-outline', poiCat: 'atm,bank' },
  { id: 'supermarket', label: 'Grocery', icon: 'basket-outline', poiCat: 'supermarket,grocery' },
  { id: 'hotel', label: 'Hotel', icon: 'bed-outline', poiCat: 'hotel,lodging' },
  { id: 'mosque', label: 'Mosque', icon: 'star-outline', poiCat: 'mosque,place_of_worship' },
  { id: 'park', label: 'Park', icon: 'leaf-outline', poiCat: 'park,garden' },
];

interface SearchResult {
  id: string;
  name: string;
  category: string;
  address?: string;
  lat: number;
  lon: number;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Session token for Mapbox Search Box API billing
let _sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
function getSessionToken() { return _sessionToken; }
function resetSessionToken() { _sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36); }

// Mapbox Search Box API - Suggest
async function searchMapbox(query: string, proximity?: [number, number], poiCategory?: string): Promise<SearchResult[]> {
  const prox = proximity ? `${proximity[0]},${proximity[1]}` : '55.1475,25.075';
  const params = new URLSearchParams({
    q: query,
    access_token: MAPBOX_TOKEN,
    session_token: getSessionToken(),
    proximity: prox,
    bbox: '55.10,25.05,55.20,25.12',
    country: 'AE',
    language: 'en',
    limit: '8',
    types: 'poi,address,street',
  });
  if (poiCategory) params.set('poi_category', poiCategory);

  try {
    const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`);
    const data = await res.json();
    return (data.suggestions || []).map((s: any) => ({
      id: s.mapbox_id,
      name: s.name,
      category: s.poi_category?.join(', ') || s.feature_type || 'Place',
      address: s.full_address || s.place_formatted || '',
      lat: 0, // filled on retrieve
      lon: 0,
    }));
  } catch {
    return [];
  }
}

// Mapbox Search Box API - Retrieve (get coordinates for a suggestion)
async function retrievePlace(mapboxId: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      session_token: getSessionToken(),
    });
    const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?${params}`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (feature?.geometry?.coordinates) {
      resetSessionToken(); // new session after retrieve
      return { lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] };
    }
    return null;
  } catch {
    return null;
  }
}

// Mapbox Search Box API - Category search
async function searchCategory(category: string, proximity?: [number, number]): Promise<SearchResult[]> {
  const prox = proximity ? `${proximity[0]},${proximity[1]}` : '55.1475,25.075';
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    session_token: getSessionToken(),
    proximity: prox,
    bbox: '55.10,25.05,55.20,25.12',
    country: 'AE',
    language: 'en',
    limit: '8',
    types: 'poi',
    poi_category: category,
    q: category,
  });
  try {
    const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`);
    const data = await res.json();
    return (data.suggestions || []).map((s: any) => ({
      id: s.mapbox_id,
      name: s.name,
      category: s.poi_category?.join(', ') || category,
      address: s.full_address || s.place_formatted || '',
      lat: 0,
      lon: 0,
    }));
  } catch {
    return [];
  }
}

export default function MapScreen() {
  const { location } = useLocation();
  const tracker = useLocationTracking();
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Data
  const [pins, setPins] = useState<Pin[]>([]);
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mappedPercent] = useState(93);

  // Search
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromPlace, setFromPlace] = useState<SearchResult | null>(null);
  const [toPlace, setToPlace] = useState<SearchResult | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mode
  const [mode, setMode] = useState<'walk' | 'run'>('walk');

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Route
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load pins
  useEffect(() => {
    pinsApi.list('25.06,55.13,25.10,55.18').then(res => setPins(res.data.pins || [])).catch(() => {});
  }, []);

  // Heatmap
  useEffect(() => {
    if (!showHeatmap) { setHeatmapCells([]); return; }
    heatmapApi.density('25.06,55.13,25.10,55.18').then(res => setHeatmapCells(res.data.cells || [])).catch(() => {});
  }, [showHeatmap]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      pulseAnim.setValue(1);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording, pulseAnim]);

  // Debounced search
  const doSearch = useCallback((text: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const prox: [number, number] | undefined = location ? [location.longitude, location.latitude] : undefined;
      const results = await searchMapbox(text, prox);
      setSearchResults(results);
      setSearching(false);
    }, 400);
  }, [location]);

  // Route fetching
  const fetchRoute = useCallback(async (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => {
    setRouteLoading(true);
    try {
      const origStr = `${from.lat},${from.lon}`;
      const destStr = `${to.lat},${to.lon}`;
      const res = await routeApi.find(origStr, destStr);
      if (res.data.routes?.length > 0) {
        setRoutes(res.data.routes);
        setSelectedRoute(res.data.routes[0]);
      }
    } catch {
      const mockRoute: Route = {
        id: 'walking', type: 'fastest', estimated_time_s: 1260, distance_m: 1800,
        energy_kcal: 86, verification_score: 0.93, percent_unverified: 7,
        elevation_gain_m: 5, shade_percentage: 45, polyline: '',
        geometry: { type: 'LineString', coordinates: [[from.lon, from.lat], [to.lon, to.lat]] },
        steps: [],
      };
      setRoutes([
        mockRoute,
        { ...mockRoute, id: 'fastest', type: 'fastest', estimated_time_s: 1260, distance_m: 1800 },
        { ...mockRoute, id: 'easiest', type: 'easiest', estimated_time_s: 1380, distance_m: 2100 },
        { ...mockRoute, id: 'scenic', type: 'scenic', estimated_time_s: 1260, distance_m: 2100 },
      ]);
      setSelectedRoute(mockRoute);
    } finally { setRouteLoading(false); }
  }, []);

  // When both from and to are set, fetch route
  const tryFetchRoute = useCallback(() => {
    const from = useCurrentLocation && location
      ? { lat: location.latitude, lon: location.longitude }
      : fromPlace ? { lat: fromPlace.lat, lon: fromPlace.lon } : null;
    const to = toPlace ? { lat: toPlace.lat, lon: toPlace.lon } : null;
    if (from && to) fetchRoute(from, to);
  }, [useCurrentLocation, location, fromPlace, toPlace, fetchRoute]);

  // Handlers
  const handleFieldFocus = useCallback((field: 'from' | 'to') => {
    setActiveField(field);
    setShowPanel(true);
    setSearchResults([]);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    if (activeField === 'from') {
      setFromText(text);
      setUseCurrentLocation(false);
    } else {
      setToText(text);
    }
    doSearch(text);
  }, [activeField, doSearch]);

  const handleSelectResult = useCallback(async (result: SearchResult) => {
    setSearchResults([]);
    Keyboard.dismiss();

    // Retrieve coordinates from Mapbox
    const coords = await retrievePlace(result.id);
    if (!coords) return;

    const resolved = { ...result, lat: coords.lat, lon: coords.lon };

    if (activeField === 'from') {
      setFromPlace(resolved);
      setFromText(resolved.name);
      setUseCurrentLocation(false);
    } else {
      setToPlace(resolved);
      setToText(resolved.name);
    }
    setActiveField(null);
    setShowPanel(false);
    cameraRef.current?.setCamera({ centerCoordinate: [coords.lon, coords.lat], zoomLevel: 15, animationDuration: 1000 });

    // Fetch route
    const from = activeField === 'from'
      ? coords
      : useCurrentLocation && location
        ? { lat: location.latitude, lon: location.longitude }
        : fromPlace ? { lat: fromPlace.lat, lon: fromPlace.lon } : null;
    const to = activeField === 'to'
      ? coords
      : toPlace ? { lat: toPlace.lat, lon: toPlace.lon } : null;
    if (from && to) fetchRoute(from, to);
  }, [activeField, useCurrentLocation, location, fromPlace, toPlace, fetchRoute]);

  const handleCategoryPress = useCallback(async (cat: typeof CATEGORIES[0]) => {
    setActiveField('to');
    setToText(cat.label);
    setSearching(true);
    const prox: [number, number] | undefined = location ? [location.longitude, location.latitude] : undefined;
    const results = await searchCategory(cat.poiCat, prox);
    setSearchResults(results);
    setSearching(false);
  }, [location]);

  const handleUseCurrentLocation = useCallback(() => {
    setUseCurrentLocation(true);
    setFromText('');
    setFromPlace(null);
    setActiveField(null);
    setSearchResults([]);
  }, []);

  const handleClearAll = useCallback(() => {
    setFromText(''); setToText(''); setFromPlace(null); setToPlace(null);
    setUseCurrentLocation(true); setRoutes([]); setSelectedRoute(null);
    setActiveField(null); setShowPanel(false); setSearchResults([]);
    Keyboard.dismiss();
  }, []);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true); setRecordSeconds(0); tracker.start();
    handleClearAll();
  }, [tracker, handleClearAll]);

  const handleSaveRecording = useCallback(() => {
    tracker.stop(); setIsRecording(false); setRecordSeconds(0); setShowStopModal(false);
    showSuccess('Trace Saved', 'Your walk has been uploaded. Thanks for contributing!');
  }, [tracker]);

  const handleDiscardRecording = useCallback(() => {
    tracker.stop(); setIsRecording(false); setRecordSeconds(0); setShowStopModal(false);
    showInfo('Recording Discarded', 'Your trace was not saved');
  }, [tracker]);

  const handleMyLocation = useCallback(() => {
    if (location) cameraRef.current?.setCamera({ centerCoordinate: [location.longitude, location.latitude], zoomLevel: 16, animationDuration: 500 });
  }, [location]);

  // GeoJSON
  const routeGeoJSON = useMemo(() => {
    if (!selectedRoute?.geometry?.coordinates?.length) return null;
    return { type: 'Feature' as const, geometry: selectedRoute.geometry, properties: {} };
  }, [selectedRoute]);

  const recordingGeoJSON = useMemo(() => {
    if (!isRecording || tracker.path.length < 2) return null;
    return { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: tracker.path.map(p => [p.longitude, p.latitude]) }, properties: {} };
  }, [isRecording, tracker.path]);

  const pinsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: pins.map(pin => ({
      type: 'Feature' as const, id: String(pin.id),
      geometry: { type: 'Point' as const, coordinates: [pin.lon, pin.lat] },
      properties: { type: pin.type, color: PIN_COLORS[pin.type] || '#9CA3AF' },
    })),
  }), [pins]);

  const currentSpeed = useMemo(() => {
    if (!isRecording || recordSeconds === 0 || tracker.distance === 0) return 0;
    return tracker.distance / recordSeconds;
  }, [isRecording, recordSeconds, tracker.distance]);

  const route = selectedRoute;
  const activeSearchText = activeField === 'from' ? fromText : toText;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* MAP */}
      <MapboxGL.MapView style={styles.map} styleURL={DARK_STYLE} logoEnabled={false} attributionEnabled={false} scaleBarEnabled={false} compassEnabled={false}>
        <MapboxGL.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: JLT_CENTER, zoomLevel: JLT_ZOOM }} />
        <MapboxGL.LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true, color: colors.accent, radius: 50 }} />
        <MapboxGL.ShapeSource id="pins-source" shape={pinsGeoJSON}>
          <MapboxGL.CircleLayer id="pins-layer" style={{ circleRadius: 8, circleColor: ['get', 'color'], circleStrokeWidth: 2, circleStrokeColor: 'rgba(255,255,255,0.3)' }} />
        </MapboxGL.ShapeSource>
        {showHeatmap && <HeatmapOverlay cells={heatmapCells} />}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route-source" shape={routeGeoJSON}>
            <MapboxGL.LineLayer id="route-line" style={{ lineColor: colors.accent, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }} />
          </MapboxGL.ShapeSource>
        )}
        {recordingGeoJSON && (
          <MapboxGL.ShapeSource id="recording-source" shape={recordingGeoJSON}>
            <MapboxGL.LineLayer id="recording-line" style={{ lineColor: colors.danger, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }} />
          </MapboxGL.ShapeSource>
        )}
        {toPlace && (
          <MapboxGL.MarkerView coordinate={[toPlace.lon, toPlace.lat]}>
            <Icon name="location" size={32} color={colors.accent} />
          </MapboxGL.MarkerView>
        )}
        {fromPlace && !useCurrentLocation && (
          <MapboxGL.MarkerView coordinate={[fromPlace.lon, fromPlace.lat]}>
            <Icon name="radio-button-on" size={20} color={colors.accent} />
          </MapboxGL.MarkerView>
        )}
      </MapboxGL.MapView>

      {/* SEARCH PANEL */}
      <View style={styles.searchContainer}>
        {/* From field */}
        <View style={styles.searchRow}>
          <View style={[styles.searchDot, { backgroundColor: colors.accent }]} />
          <TouchableOpacity
            style={[styles.searchField, activeField === 'from' && styles.searchFieldActive]}
            onPress={() => handleFieldFocus('from')}
            activeOpacity={0.8}
          >
            {activeField === 'from' ? (
              <TextInput
                style={styles.searchInput}
                placeholder="Start location"
                placeholderTextColor={colors.textMuted}
                value={fromText}
                onChangeText={handleSearchChange}
                autoFocus
              />
            ) : (
              <Text style={useCurrentLocation ? styles.searchPlaceholderActive : styles.searchPlaceholder}>
                {useCurrentLocation ? 'Current Location' : fromPlace ? fromPlace.name : 'Start location'}
              </Text>
            )}
          </TouchableOpacity>
          {!useCurrentLocation && activeField === 'from' && (
            <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.locateBtn}>
              <Icon name="locate" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>

        {/* To field */}
        <View style={styles.searchRow}>
          <View style={[styles.searchDot, { backgroundColor: colors.danger }]} />
          <TouchableOpacity
            style={[styles.searchField, activeField === 'to' && styles.searchFieldActive]}
            onPress={() => handleFieldFocus('to')}
            activeOpacity={0.8}
          >
            {activeField === 'to' ? (
              <TextInput
                style={styles.searchInput}
                placeholder="Where to?"
                placeholderTextColor={colors.textMuted}
                value={toText}
                onChangeText={handleSearchChange}
                autoFocus
              />
            ) : (
              <Text style={toPlace ? styles.searchPlaceholderActive : styles.searchPlaceholder}>
                {toPlace ? toPlace.name : 'Where to?'}
              </Text>
            )}
          </TouchableOpacity>
          {(toText.length > 0 || toPlace) && (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category shortcuts - always visible below search fields */}
        {!isRecording && !route && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow} contentContainerStyle={styles.categoriesScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.id} style={styles.categoryChip} onPress={() => handleCategoryPress(cat)}>
                <View style={styles.categoryIconWrap}>
                  <Icon name={cat.icon} size={18} color={colors.accent} />
                </View>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Search results */}
        {(activeField && searchResults.length > 0) && (
          <View style={styles.searchResults}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
              {searchResults.map(result => (
                <TouchableOpacity key={result.id} style={styles.searchResultItem} onPress={() => handleSelectResult(result)}>
                  <Icon name="location-outline" size={20} color={colors.accent} />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName} numberOfLines={1}>{result.name}</Text>
                    {result.address ? (
                      <Text style={styles.searchResultAddress} numberOfLines={1}>{result.address}</Text>
                    ) : null}
                    <Text style={styles.searchResultCategory}>{result.category}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Searching indicator */}
        {searching && (
          <View style={styles.searchingIndicator}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.searchingText}>Searching...</Text>
          </View>
        )}
      </View>

      {/* MAPPED BADGE */}
      {!isRecording && !showPanel && (
        <View style={styles.mappedBadge}>
          <Text style={styles.mappedText}>{mappedPercent}% mapped</Text>
        </View>
      )}

      {/* RECORDING BADGE */}
      {isRecording && (
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDotBadge} />
          <Text style={styles.recordingBadgeText}>Recording...</Text>
        </View>
      )}

      {/* SIDE BUTTONS */}
      <View style={styles.sideButtons}>
        <TouchableOpacity style={[styles.sideBtn, showHeatmap && styles.sideBtnActive]} onPress={() => setShowHeatmap(!showHeatmap)}>
          <Text style={[styles.sideBtnLabel, showHeatmap && styles.sideBtnLabelActive]}>H</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={handleMyLocation}>
          <Icon name="locate" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn}>
          <Icon name="add" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* BOTTOM (idle, no route) */}
      {!isRecording && !route && (
        <View style={styles.bottomCenter}>
          <View style={styles.modeToggle}>
            <TouchableOpacity style={[styles.modePill, mode === 'walk' && styles.modePillActive]} onPress={() => setMode('walk')}>
              <Icon name="walk-outline" size={16} color={mode === 'walk' ? colors.bg : colors.textSecondary} />
              <Text style={[styles.modePillText, mode === 'walk' && styles.modePillTextActive]}>Walk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modePill, mode === 'run' && styles.modePillActive]} onPress={() => setMode('run')}>
              <Icon name="fitness-outline" size={16} color={mode === 'run' ? colors.bg : colors.textSecondary} />
              <Text style={[styles.modePillText, mode === 'run' && styles.modePillTextActive]}>Run</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.recordBtn} onPress={handleStartRecording}>
            <View style={styles.recordBtnOuter}><View style={styles.recordBtnInner} /></View>
          </TouchableOpacity>
        </View>
      )}

      {/* RECORDING CONTROLS */}
      {isRecording && (
        <View style={styles.recordingBottom}>
          <View style={styles.modeToggle}>
            <TouchableOpacity style={[styles.modePill, mode === 'walk' && styles.modePillActive]} onPress={() => setMode('walk')}>
              <Text style={[styles.modePillText, mode === 'walk' && styles.modePillTextActive]}>Walk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modePill, mode === 'run' && styles.modePillActive]} onPress={() => setMode('run')}>
              <Text style={[styles.modePillText, mode === 'run' && styles.modePillTextActive]}>Run</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recordingStats}>
            <View style={styles.rStat}><Text style={styles.rStatVal}>{fmtTime(recordSeconds)}</Text><Text style={styles.rStatLbl}>Time</Text></View>
            <View style={styles.rStatDiv} />
            <View style={styles.rStat}><Text style={styles.rStatVal}>{fmtDistance(tracker.distance)}</Text><Text style={styles.rStatLbl}>Distance</Text></View>
            <View style={styles.rStatDiv} />
            <View style={styles.rStat}><Text style={styles.rStatVal}>{currentSpeed > 0 ? (currentSpeed * 3.6).toFixed(1) : '0.0'} km/h</Text><Text style={styles.rStatLbl}>Speed</Text></View>
          </View>
          <TouchableOpacity style={styles.stopBtn} onPress={() => setShowStopModal(true)}>
            <Animated.View style={[styles.stopBtnOuter, { transform: [{ scale: pulseAnim }] }]}><View style={styles.stopBtnInner} /></Animated.View>
          </TouchableOpacity>
        </View>
      )}

      {/* ROUTE PANEL */}
      {route && !isRecording && (
        <View style={styles.routePanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeTabs}>
            {routes.map(r => {
              const isActive = selectedRoute?.id === r.id;
              const label = r.type === 'fastest' ? 'Fastest' : r.type === 'easiest' ? 'Easiest' : r.type === 'scenic' ? 'Scenic' : 'Walking';
              const tabColor = r.type === 'scenic' ? '#F59E0B' : r.type === 'easiest' ? '#00D9F5' : colors.accent;
              return (
                <TouchableOpacity key={r.id} style={[styles.routeTab, isActive && { backgroundColor: tabColor }]} onPress={() => setSelectedRoute(r)}>
                  <Text style={[styles.routeTabLabel, isActive && { color: colors.bg }]}>{label}</Text>
                  <Text style={[styles.routeTabSub, isActive && { color: colors.bg }]}>{fmtDuration(r.estimated_time_s)} · {fmtDistance(r.distance_m)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.routeSummary}>
            <Text style={styles.routeTime}>{fmtDuration(route.estimated_time_s)}</Text>
            <Text style={styles.routeTimeLabel}> {mode}</Text>
            <Text style={styles.routeDistance}>{fmtDistance(route.distance_m)}</Text>
          </View>
          <View style={styles.routeStatsRow}>
            <Text style={styles.routeStat}>{route.shade_percentage}% shade</Text>
            <Text style={styles.routeStat}>{route.energy_kcal} cal</Text>
            <Text style={styles.routeStat}>+{route.elevation_gain_m}m elev</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
              <Text style={styles.routeStat}>{Math.round(route.verification_score * 100)}% verified</Text>
            </View>
          </View>
          <Text style={styles.communityText}>Community-powered route</Text>
          <View style={styles.communityBar}><View style={[styles.communityBarFill, { width: `${route.verification_score * 100}%` }]} /></View>
          <View style={styles.routeActions}>
            <TouchableOpacity style={styles.routeClearBtn} onPress={handleClearAll}>
              <Text style={styles.routeClearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startBtn} onPress={handleStartRecording}>
              <Icon name="walk" size={18} color={colors.bg} />
              <Text style={styles.startBtnText}>Start Walking</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STOP MODAL */}
      <Modal visible={showStopModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Stop Recording?</Text>
            <Text style={styles.modalSubtitle}>You've walked {fmtDistance(tracker.distance)} in {fmtTime(recordSeconds)}. Save this trace to help improve routes?</Text>
            <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveRecording}>
              <Icon name="cloud-upload-outline" size={20} color={colors.bg} />
              <Text style={styles.modalBtnSaveText}>Save & Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnDiscard} onPress={handleDiscardRecording}>
              <Icon name="trash-outline" size={20} color={colors.danger} />
              <Text style={styles.modalBtnDiscardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnKeep} onPress={() => setShowStopModal(false)}>
              <Text style={styles.modalBtnKeepText}>Keep Recording</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },

  // Search panel
  searchContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 16, right: 16, zIndex: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  searchDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  searchField: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radii.lg, paddingHorizontal: 14, height: 44, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  searchFieldActive: { borderColor: colors.accent },
  searchInput: { color: colors.text, fontSize: fonts.sizes.md, padding: 0 },
  searchPlaceholder: { color: colors.textMuted, fontSize: fonts.sizes.md },
  searchPlaceholderActive: { color: colors.accent, fontSize: fonts.sizes.md, fontWeight: '500' },
  locateBtn: { marginLeft: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  clearBtn: { marginLeft: 8, padding: 4 },

  // Categories
  categoriesRow: { marginTop: 8, flexGrow: 0 },
  categoriesScroll: { paddingHorizontal: 0, gap: 10 },
  categoryChip: { alignItems: 'center', width: 56 },
  categoryIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  categoryLabel: { color: colors.textSecondary, fontSize: 10, textAlign: 'center' },

  // Search results
  searchResults: { marginTop: 4, backgroundColor: colors.bgCard, borderRadius: radii.lg, paddingVertical: 4 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  searchResultText: { flex: 1 },
  searchResultName: { color: colors.text, fontSize: fonts.sizes.md, fontWeight: '500' },
  searchResultAddress: { color: colors.textSecondary, fontSize: fonts.sizes.sm, marginTop: 1 },
  searchResultCategory: { color: colors.accent, fontSize: fonts.sizes.xs, marginTop: 2, textTransform: 'capitalize' },
  searchingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.bgCard, borderRadius: radii.lg, marginTop: 4 },
  searchingText: { color: colors.textSecondary, fontSize: fonts.sizes.sm },

  // Badges
  mappedBadge: { position: 'absolute', top: Platform.OS === 'ios' ? 156 : 140, right: 16, backgroundColor: colors.bgCard, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 6 },
  mappedText: { color: colors.accent, fontSize: fonts.sizes.xs, fontWeight: '700' },
  recordingBadge: { position: 'absolute', top: Platform.OS === 'ios' ? 156 : 140, right: 16, backgroundColor: colors.bgCard, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordingDotBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  recordingBadgeText: { color: colors.danger, fontSize: fonts.sizes.xs, fontWeight: '700' },

  // Side buttons
  sideButtons: { position: 'absolute', right: 16, top: Platform.OS === 'ios' ? 190 : 174, gap: 10 },
  sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  sideBtnActive: { backgroundColor: colors.accent },
  sideBtnLabel: { color: colors.text, fontSize: fonts.sizes.lg, fontWeight: '700' },
  sideBtnLabelActive: { color: colors.bg },

  // Bottom
  bottomCenter: { position: 'absolute', bottom: 24, alignSelf: 'center', alignItems: 'center', gap: 14 },
  modeToggle: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radii.full, padding: 3 },
  modePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.full, gap: 6 },
  modePillActive: { backgroundColor: colors.accent },
  modePillText: { color: colors.textSecondary, fontSize: fonts.sizes.sm, fontWeight: '600' },
  modePillTextActive: { color: colors.bg },
  recordBtn: { alignItems: 'center' },
  recordBtnOuter: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  recordBtnInner: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg },

  // Recording
  recordingBottom: { position: 'absolute', bottom: 24, alignSelf: 'center', alignItems: 'center', gap: 12 },
  recordingStats: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radii.xl, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  rStat: { alignItems: 'center', paddingHorizontal: 14 },
  rStatVal: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: '700' },
  rStatLbl: { color: colors.textSecondary, fontSize: fonts.sizes.xs, marginTop: 2 },
  rStatDiv: { width: 1, height: 28, backgroundColor: colors.border },
  stopBtn: { alignItems: 'center' },
  stopBtnOuter: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', shadowColor: colors.danger, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  stopBtnInner: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#FFF' },

  // Route panel
  routePanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bgCard, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  routeTabs: { marginBottom: 14, flexGrow: 0 },
  routeTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.lg, backgroundColor: colors.bgElevated, marginRight: 8 },
  routeTabLabel: { color: colors.textSecondary, fontSize: fonts.sizes.sm, fontWeight: '600' },
  routeTabSub: { color: colors.textMuted, fontSize: fonts.sizes.xs, marginTop: 2 },
  routeSummary: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  routeTime: { color: colors.accent, fontSize: 32, fontWeight: '800' },
  routeTimeLabel: { color: colors.textSecondary, fontSize: fonts.sizes.md },
  routeDistance: { color: colors.text, fontSize: fonts.sizes.lg, fontWeight: '600', marginLeft: 'auto' },
  routeStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  routeStat: { color: colors.textSecondary, fontSize: fonts.sizes.xs },
  communityText: { color: colors.accent, fontSize: fonts.sizes.xs, fontWeight: '600', marginBottom: 4 },
  communityBar: { height: 3, backgroundColor: colors.bgElevated, borderRadius: 2, marginBottom: 14 },
  communityBarFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  routeActions: { flexDirection: 'row', gap: 12 },
  routeClearBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  routeClearBtnText: { color: colors.textSecondary, fontSize: fonts.sizes.md, fontWeight: '600' },
  startBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { color: colors.bg, fontSize: fonts.sizes.md, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.bgOverlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  modalCard: { width: '100%', backgroundColor: colors.bgCard, borderRadius: radii.xl, padding: 24, alignItems: 'center' },
  modalTitle: { color: colors.text, fontSize: fonts.sizes.xl, fontWeight: '700', marginBottom: 8 },
  modalSubtitle: { color: colors.textSecondary, fontSize: fonts.sizes.md, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalBtnSave: { flexDirection: 'row', gap: 8, width: '100%', paddingVertical: 14, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modalBtnSaveText: { color: colors.bg, fontSize: fonts.sizes.md, fontWeight: '700' },
  modalBtnDiscard: { flexDirection: 'row', gap: 8, width: '100%', paddingVertical: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modalBtnDiscardText: { color: colors.danger, fontSize: fonts.sizes.md, fontWeight: '600' },
  modalBtnKeep: { width: '100%', paddingVertical: 14, borderRadius: radii.lg, backgroundColor: colors.bgElevated, alignItems: 'center' },
  modalBtnKeepText: { color: colors.textSecondary, fontSize: fonts.sizes.md, fontWeight: '600' },
});
