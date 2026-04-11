import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Route } from '../types';
import { formatDuration, formatDistance } from '../utils/format';
import { colors, spacing, radii } from '../utils/theme';
import RouteCard from './RouteCard';

interface Props {
  routes: Route[];
  selectedIndex: number;
  onSelectRoute: (index: number) => void;
  onClear: () => void;
  onStartWalking: () => void;
}

export default function RoutePanel({
  routes,
  selectedIndex,
  onSelectRoute,
  onClear,
  onStartWalking,
}: Props) {
  const selected = routes[selectedIndex];
  if (!selected) return null;

  const timeParts = formatDuration(selected.estimated_time_s);
  const dist = formatDistance(selected.distance_m);
  const shade = selected.shade_percentage;
  const cal = selected.energy_kcal;
  const elev = selected.elevation_gain_m;
  const verified = Math.round(selected.verification_score * 100);
  const communityPct = Math.round((1 - selected.percent_unverified) * 100);

  return (
    <View style={styles.container}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Route type tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {routes.map((route, i) => (
          <RouteCard
            key={route.id}
            route={route}
            selected={i === selectedIndex}
            onPress={() => onSelectRoute(i)}
          />
        ))}
      </ScrollView>

      {/* Main stats */}
      <View style={styles.mainRow}>
        <View style={styles.mainLeft}>
          <Text style={styles.timeText}>{timeParts}</Text>
          <Text style={styles.walkLabel}>walk</Text>
        </View>
        <Text style={styles.distText}>{dist}</Text>
      </View>

      {/* Detail stats */}
      <View style={styles.detailRow}>
        <Text style={styles.detailItem}>{shade}% shade</Text>
        <Text style={styles.detailDot}>·</Text>
        <Text style={styles.detailItem}>{cal} cal</Text>
        <Text style={styles.detailDot}>·</Text>
        <Text style={styles.detailItem}>+{elev}m elev</Text>
        <Text style={styles.detailDot}>·</Text>
        <View style={styles.verifiedRow}>
          <View style={styles.greenDot} />
          <Text style={styles.detailItem}>{verified}% verified</Text>
        </View>
      </View>

      {/* Community bar */}
      <View style={styles.communitySection}>
        <Text style={styles.communityLabel}>Community-powered route</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${communityPct}%` }]} />
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.7}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.startBtn} onPress={onStartWalking} activeOpacity={0.7}>
          <Icon name="walk" size={18} color={colors.bg} style={{ marginRight: 6 }} />
          <Text style={styles.startBtnText}>Start Walking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  tabRow: {
    paddingVertical: spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  mainLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
  },
  walkLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  distText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  detailItem: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailDot: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  communitySection: {
    marginTop: spacing.lg,
  },
  communityLabel: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  clearBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  clearBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  startBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
});
