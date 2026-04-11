import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { tracesApi } from '../services/api';
import { Trace } from '../types';
import { formatDistance, formatDuration, formatDate } from '../utils/format';
import { colors, spacing, radii } from '../utils/theme';

export default function MyWalksScreen() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await tracesApi.mine(50, 0);
      setTraces(res.data.traces || res.data || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => load(true), [load]);

  // Compute stats
  const totalWalks = traces.length;
  const totalDistanceM = traces.reduce((sum, t) => sum + (t.distance_m || 0), 0);
  const totalTimeS = traces.reduce((sum, t) => {
    const start = new Date(t.started_at).getTime();
    const end = new Date(t.ended_at).getTime();
    return sum + (end - start) / 1000;
  }, 0);

  const getDurationS = (t: Trace) => {
    const start = new Date(t.started_at).getTime();
    const end = new Date(t.ended_at).getTime();
    return (end - start) / 1000;
  };

  const renderItem = ({ item }: { item: Trace }) => {
    const durationS = getDurationS(item);
    const isRun = item.mode === 'run';
    return (
      <View style={styles.walkCard}>
        <View style={styles.walkIconContainer}>
          <Icon
            name={isRun ? 'fitness-outline' : 'footsteps-outline'}
            size={24}
            color={colors.accent}
          />
        </View>
        <View style={styles.walkInfo}>
          <Text style={styles.walkDate}>{formatDate(item.started_at)}</Text>
          <Text style={styles.walkStats}>
            {formatDistance(item.distance_m)} {'  '} {formatDuration(durationS)}
          </Text>
        </View>
        <View style={styles.walkModeBadge}>
          <Text style={styles.walkModeText}>{isRun ? 'Run' : 'Walk'}</Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Icon name="footsteps-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No walks yet</Text>
        <Text style={styles.emptySubtitle}>
          Start your first walk from the Explore tab
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{totalWalks}</Text>
        <Text style={styles.statLabel}>Total Walks</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{formatDistance(totalDistanceM)}</Text>
        <Text style={styles.statLabel}>Total Distance</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{formatDuration(totalTimeS)}</Text>
        <Text style={styles.statLabel}>Total Time</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>My Walks</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={traces}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={traces.length > 0 ? renderHeader : null}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            traces.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
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
  headerBar: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  walkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  walkIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,245,160,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  walkInfo: {
    flex: 1,
  },
  walkDate: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  walkStats: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  walkModeBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  walkModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
