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
  const [sharingLevel, setSharingLevel] = useState<SharingLevel>('private');
  const [trustScore, setTrustScore] = useState(0);

  useEffect(() => {
    userApi.profile().then(r => {
      const p = r.data;
      if (p?.preferences) {
        setAvoidStairs(!!p.preferences.avoid_stairs);
        setPreferShade(!!p.preferences.prefer_shade);
      }
      if (typeof p?.trust_score === 'number') setTrustScore(p.trust_score);
    }).catch(() => {});
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
});
