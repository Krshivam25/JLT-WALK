import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { leaderboardApi } from '../services/api';
import { colors, spacing, radii } from '../utils/theme';
import { showError } from '../utils/toast';

type Period = 'week' | 'month' | 'all';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  points: number;
  trust_score?: number;
  shortcuts_added?: number;
  validations_done?: number;
}

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

function getMedalColor(rank: number): string | null {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return null;
}

function getTrustColor(score: number): string {
  if (score >= 80) return colors.accent;
  if (score >= 40) return colors.warning;
  return colors.danger;
}

function getBadges(entry: LeaderboardEntry): { icon: string; label: string; color: string }[] {
  const badges: { icon: string; label: string; color: string }[] = [];
  if ((entry.shortcuts_added ?? 0) >= 5) {
    badges.push({ icon: 'compass-outline', label: 'Explorer', color: colors.accent });
  }
  if ((entry.validations_done ?? 0) >= 20) {
    badges.push({ icon: 'checkmark-done-outline', label: 'Validator', color: colors.purple });
  }
  if (entry.rank <= 10) {
    badges.push({ icon: 'map-outline', label: 'Top Mapper', color: colors.warning });
  }
  return badges;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await leaderboardApi.list(period, 50);
      const data = Array.isArray(res.data)
        ? res.data
        : res.data.entries || res.data.leaderboard || [];
      setEntries(data);
    } catch (err: any) {
      showError('Failed to load leaderboard', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard(false);
  }, [fetchLeaderboard]);

  const isCurrentUser = (entry: LeaderboardEntry): boolean => {
    if (!user) return false;
    return String(entry.user_id) === String(user.id);
  };

  const renderEntry = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrent = isCurrentUser(item);
    const medal = getMedalColor(item.rank);
    const trustScore = item.trust_score ?? 0;
    const trustColor = getTrustColor(trustScore);
    const badges = getBadges(item);

    return (
      <View style={[styles.entryCard, isCurrent && styles.entryCardCurrent]}>
        {/* Rank */}
        <View style={styles.rankContainer}>
          {medal ? (
            <View style={[styles.medalCircle, { backgroundColor: medal }]}>
              <Text style={styles.medalText}>{item.rank}</Text>
            </View>
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>

        {/* User info */}
        <View style={styles.entryInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.displayName, isCurrent && styles.displayNameCurrent]}
              numberOfLines={1}
            >
              {item.display_name || `User ${item.user_id}`}
            </Text>
            {isCurrent && <Text style={styles.youBadge}>YOU</Text>}
          </View>

          {/* Trust score bar */}
          <View style={styles.trustRow}>
            <View style={styles.trustBarBg}>
              <View
                style={[
                  styles.trustBarFill,
                  {
                    width: `${Math.min(trustScore, 100)}%`,
                    backgroundColor: trustColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.trustLabel, { color: trustColor }]}>
              {trustScore}%
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {item.shortcuts_added != null && (
              <View style={styles.statItem}>
                <Icon name="navigate-outline" size={12} color={colors.textMuted} />
                <Text style={styles.statText}>
                  {item.shortcuts_added} shortcut{item.shortcuts_added !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {item.validations_done != null && (
              <View style={styles.statItem}>
                <Icon
                  name="checkmark-circle-outline"
                  size={12}
                  color={colors.textMuted}
                />
                <Text style={styles.statText}>
                  {item.validations_done} validation{item.validations_done !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Badges */}
          {badges.length > 0 && (
            <View style={styles.badgesRow}>
              {badges.map(badge => (
                <View
                  key={badge.label}
                  style={[styles.badge, { borderColor: badge.color }]}
                >
                  <Icon name={badge.icon} size={11} color={badge.color} />
                  <Text style={[styles.badgeLabel, { color: badge.color }]}>
                    {badge.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Points */}
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsValue}>{item.points.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      {/* Period Tabs */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map(opt => {
          const isActive = period === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.periodTab, isActive && styles.periodTabActive]}
              activeOpacity={0.7}
              onPress={() => setPeriod(opt.key)}
            >
              <Text
                style={[
                  styles.periodTabText,
                  isActive && styles.periodTabTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="trophy-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptySubtitle}>
            Start walking and contributing to appear on the leaderboard!
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => `${item.user_id}-${item.rank}`}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },

  // Period tabs
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  periodTab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodTabActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodTabTextActive: {
    color: colors.accent,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },

  // Entry card
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryCardCurrent: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 245, 160, 0.05)',
  },

  // Rank
  rankContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  medalCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.bg,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },

  // Entry info
  entryInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  displayNameCurrent: {
    color: colors.accent,
  },
  youBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.bg,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },

  // Trust score
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  trustBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trustBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // Badges
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: 3,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Points
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  pointsLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
