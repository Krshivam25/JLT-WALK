import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii } from '../utils/theme';

interface Props {
  points: number;
  reason?: string;
  visible: boolean;
  onHide: () => void;
}

export default function PointsPopup({ points, reason, visible, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      opacity.setValue(0);
      translateY.setValue(0);

      Animated.sequence([
        // Fade in + slide up
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        // Hold
        Animated.delay(1000),
        // Fade out + continue sliding up
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -60,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        onHide();
      });
    }
  }, [visible, opacity, translateY, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.pill}>
        <Icon name="star" size={18} color={colors.accent} />
        <Text style={styles.pointsText}>+{points} pts</Text>
      </View>
      {reason ? <Text style={styles.reasonText}>{reason}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  reasonText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
