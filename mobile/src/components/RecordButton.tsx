import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../utils/theme';

interface Props {
  recording: boolean;
  onPress: () => void;
}

const OUTER_SIZE = 64;
const INNER_SIZE = 44;

export default function RecordButton({ recording, onPress }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recording, pulseAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[styles.outer, recording && styles.outerRecording]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {recording ? (
          <Icon name="stop" size={22} color="#FFFFFF" />
        ) : (
          <View style={styles.inner} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRecording: {
    backgroundColor: '#EF4444',
  },
  inner: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    backgroundColor: colors.bg,
  },
});
