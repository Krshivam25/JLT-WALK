import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Route } from '../types';
import { formatDuration, formatDistance } from '../utils/format';
import { colors, spacing, radii } from '../utils/theme';

interface Props {
  route: Route;
  selected: boolean;
  onPress: () => void;
}

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  walking: { color: colors.routeWalking, label: 'Walking' },
  fastest: { color: colors.routeFastest, label: 'Fastest' },
  easiest: { color: colors.routeEasiest, label: 'Easiest' },
  scenic: { color: colors.routeScenic, label: 'Scenic' },
};

export default function RouteCard({ route, selected, onPress }: Props) {
  const cfg = TYPE_CONFIG[route.type] || TYPE_CONFIG.fastest;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && { borderColor: colors.accent, backgroundColor: '#1E1E38' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.pill, { backgroundColor: cfg.color }]}>
        <Text style={styles.pillText}>{cfg.label}</Text>
      </View>
      <Text style={styles.stats}>
        {formatDuration(route.estimated_time_s)} · {formatDistance(route.distance_m)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 120,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginBottom: spacing.xs,
  },
  pillText: {
    color: colors.bg,
    fontSize: 11,
    fontWeight: '700',
  },
  stats: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
