import { useState, useEffect, useRef, useCallback } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import { LatLng } from '../types';

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    { title: 'JLT Walk', message: 'We need location for navigation.', buttonPositive: 'Allow' }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!(await requestPermission())) { setError('Permission denied'); return; }
      Geolocation.getCurrentPosition(
        pos => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        err => setError(err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    })();
  }, []);

  return { location, error };
}

export function useLocationTracking() {
  const [tracking, setTracking] = useState(false);
  const [path, setPath] = useState<LatLng[]>([]);
  const [distance, setDistance] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const watchId = useRef<number | null>(null);

  const start = useCallback(async () => {
    if (!(await requestPermission())) return;
    setPath([]); setDistance(0); setStartTime(new Date()); setTracking(true);
    watchId.current = Geolocation.watchPosition(
      pos => {
        const pt: LatLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPath(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            setDistance(d => d + haversine(last.latitude, last.longitude, pt.latitude, pt.longitude));
          }
          return [...prev, pt];
        });
      },
      err => console.warn(err.message),
      { enableHighAccuracy: true, distanceFilter: 5, interval: 3000, fastestInterval: 2000 }
    );
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null) { Geolocation.clearWatch(watchId.current); watchId.current = null; }
    setTracking(false);
  }, []);

  return { tracking, path, distance, startTime, start, stop };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
