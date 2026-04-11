import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { colors, spacing, radii } from '../utils/theme';
import { showSuccess, showError } from '../utils/toast';

type SharingLevel = 'private' | 'anonymous' | 'full';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [avoidStairs, setAvoidStairs] = useState(false);
  const [preferShade, setPreferShade] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [walkTracking, setWalkTracking] = useState(false);
  const [sharingLevel, setSharingLevel] = useState<SharingLevel>('private');
  const [trustScore, setTrustScore] = useState(0);
  const [shortcutsAdded, setShortcutsAdded] = useState(0);
  const [validationsDone, setValidationsDone] = useState(0);

  useEffect(() => {
    userApi.profile().then(r => {
      const p = r.data;
      if (p?.preferences) {
        setAvoidStairs(!!p.preferences.avoid_stairs);
        setPreferShade(!!p.preferences.prefer_shade);
      }
      if (typeof p?.trust_score === 'number') setTrustScore(p.trust_score);
      if (typeof p?.shortcuts_added === 'number') setShortcutsAdded(p.shortcuts_added);
      if (typeof p?.validations_done === 'number') setValidationsDone(p.validations_done);
    }).catch(() => {});

    AsyncStorage.getItem('walk_tracking_enabled').then(val => {
      setWalkTracking(val === 'true');
    });
  }, []);

  const updatePref = async (key: string, value: boolean) => {
    try { await userApi.preferences({ [key]: value }); } catch {}
  };

  const handleExport = async () => {
    try {
      await userApi.export();
      showSuccess('Data Exported', 'Your data export has been prepared');
    } catch {
      showError('Export Failed', 'Could not export your data. Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await userApi.deleteData();
              showSuccess('Account Deleted', 'All your data has been removed');
              logout();
            } catch {
              showError('Delete Failed', 'Could not delete your data. Please try again.');
            }
          },
        },
      ],
    );
  };

  const initial = user?.email?.[0]?.toUpperCase() || user?.display_name?.[0]?.toUpperCase() || '?';
  const roleBadge = (user?.role || 'user').toUpperCase();

  const sharingOptions: { key: SharingLevel; label: string }[] = [
    { key: 'private', label: 'Private' },
    { key: 'anonymous', label: 'Anonymous' },
    { key: 'full', label: 'Full' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + User Info */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{roleBadge}</Text>
        </View>
        <Text style={styles.trustScore}>Trust Score: {trustScore}%</Text>
      </View>

      {/* Community Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>COMMUNITY STATS</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Icon name="cut-outline" size={22} color={colors.accent} />
            <Text style={styles.statValue}>{shortcutsAdded}</Text>
            <Text style={styles.statLabel}>Shortcuts Added</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="checkmark-circle-outline" size={22} color={colors.accent} />
            <Text style={styles.statValue}>{validationsDone}</Text>
            <Text style={styles.statLabel}>Validations Done</Text>
          </View>
        </View>

        <View style={styles.trustBarCard}>
          <View style={styles.trustBarHeader}>
            <Icon name="shield-checkmark-outline" size={18} color={colors.accent} />
            <Text style={styles.trustBarLabel}>Trust Score</Text>
            <Text style={styles.trustBarValue}>{trustScore}%</Text>
          </View>
          <View style={styles.trustBarTrack}>
            <View
              style={[
                styles.trustBarFill,
                {
                  width: `${trustScore}%`,
                  backgroundColor:
                    trustScore >= 70 ? colors.accent : trustScore >= 40 ? colors.warning : colors.danger,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>BADGES</Text>
        <View style={styles.badgesRow}>
          <View style={[styles.badgeCard, shortcutsAdded >= 5 && styles.badgeCardUnlocked]}>
            <Icon
              name="compass"
              size={28}
              color={shortcutsAdded >= 5 ? '#7C3AED' : colors.textMuted}
            />
            <Text style={[styles.badgeLabel, shortcutsAdded >= 5 && styles.badgeLabelUnlocked]}>
              Explorer
            </Text>
            {shortcutsAdded < 5 && <Icon name="lock-closed" size={12} color={colors.textMuted} style={styles.badgeLock} />}
          </View>
          <View style={[styles.badgeCard, validationsDone >= 20 && styles.badgeCardUnlocked]}>
            <Icon
              name="checkmark-circle"
              size={28}
              color={validationsDone >= 20 ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.badgeLabel, validationsDone >= 20 && styles.badgeLabelUnlocked]}>
              Validator
            </Text>
            {validationsDone < 20 && <Icon name="lock-closed" size={12} color={colors.textMuted} style={styles.badgeLock} />}
          </View>
          <View style={[styles.badgeCard, shortcutsAdded >= 50 && styles.badgeCardUnlocked]}>
            <Icon
              name="trophy"
              size={28}
              color={shortcutsAdded >= 50 ? '#FFD700' : colors.textMuted}
            />
            <Text style={[styles.badgeLabel, shortcutsAdded >= 50 && styles.badgeLabelUnlocked]}>
              Top Mapper
            </Text>
            {shortcutsAdded < 50 && <Icon name="lock-closed" size={12} color={colors.textMuted} style={styles.badgeLock} />}
          </View>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PREFERENCES</Text>

        <View style={styles.prefCard}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Avoid Stairs</Text>
            <Text style={styles.prefSubtitle}>Route around stairs when possible</Text>
          </View>
          <Switch
            value={avoidStairs}
            onValueChange={v => {
              setAvoidStairs(v);
              updatePref('avoid_stairs', v);
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.prefCard}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Prefer Shade</Text>
            <Text style={styles.prefSubtitle}>Prioritize shaded paths</Text>
          </View>
          <Switch
            value={preferShade}
            onValueChange={v => {
              setPreferShade(v);
              updatePref('prefer_shade', v);
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.prefCard}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Background Tracking</Text>
            <Text style={styles.prefSubtitle}>Record walks even when app is in background</Text>
          </View>
          <Switch
            value={backgroundTracking}
            onValueChange={setBackgroundTracking}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.prefCard}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Walk Tracking</Text>
            <Text style={styles.prefSubtitle}>Your walks help improve routes for everyone</Text>
          </View>
          <Switch
            value={walkTracking}
            onValueChange={v => {
              setWalkTracking(v);
              AsyncStorage.setItem('walk_tracking_enabled', v ? 'true' : 'false');
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PRIVACY</Text>
        <Text style={styles.privacyDesc}>
          Your traces are private. Enable sharing to help improve community routes.
        </Text>
        <View style={styles.sharingRow}>
          {sharingOptions.map(opt => {
            const selected = sharingLevel === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sharingBtn,
                  selected && styles.sharingBtnSelected,
                ]}
                onPress={() => setSharingLevel(opt.key)}
              >
                <Text
                  style={[
                    styles.sharingBtnText,
                    selected && styles.sharingBtnTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Your Data */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>YOUR DATA</Text>

        <TouchableOpacity style={styles.dataBtn} onPress={handleExport}>
          <Text style={styles.dataBtnText}>Export My Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dataBtn} onPress={handleDelete}>
          <Text style={styles.dataBtnTextDanger}>Delete All My Data</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={logout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>JLT Walk v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
  },
  email: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rolePill: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.bg,
    letterSpacing: 1,
  },
  trustScore: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  prefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  prefInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  prefSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  privacyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  sharingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sharingBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sharingBtnSelected: {
    borderColor: colors.accent,
  },
  sharingBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  sharingBtnTextSelected: {
    color: colors.accent,
  },
  dataBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dataBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  dataBtnTextDanger: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.danger,
  },
  signOutBtn: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  signOutText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  version: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  // Community Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  trustBarCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  trustBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  trustBarLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  trustBarValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  trustBarTrack: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trustBarFill: {
    height: 6,
    borderRadius: 3,
  },
  // Badges
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    opacity: 0.5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeCardUnlocked: {
    opacity: 1,
    borderColor: colors.accent,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  badgeLabelUnlocked: {
    color: colors.text,
  },
  badgeLock: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
});
