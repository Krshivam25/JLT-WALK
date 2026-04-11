import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Pin } from '../types';
import { colors, spacing, radii } from '../utils/theme';

const PIN_COLORS: Record<string, string> = {
  hazard: '#EF4444',
  closure: '#F59E0B',
  construction: '#F97316',
  tip: '#00F5A0',
  photo: '#3B82F6',
  entrance: '#8B5CF6',
  shortcut: '#00D9F5',
};

interface Props {
  pin: Pin;
  onPress?: () => void;
}

export default function PinMarker({ pin, onPress }: Props) {
  const pinColor = PIN_COLORS[pin.type] || '#9CA3AF';

  return (
    <MapboxGL.MarkerView
      coordinate={[pin.lon, pin.lat]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.dot, { backgroundColor: pinColor }]} />
    </MapboxGL.MarkerView>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
