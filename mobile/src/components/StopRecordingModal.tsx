import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { colors, spacing, radii } from '../utils/theme';

interface Props {
  visible: boolean;
  distanceM: number;
  durationS: number;
  onSave: () => void;
  onDiscard: () => void;
  onKeepRecording: () => void;
}

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function StopRecordingModal({
  visible,
  distanceM,
  durationS,
  onSave,
  onDiscard,
  onKeepRecording,
}: Props) {
  const distLabel = distanceM < 1000
    ? `${Math.round(distanceM)}m`
    : `${(distanceM / 1000).toFixed(1)}km`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Stop Recording?</Text>
          <Text style={styles.subtitle}>
            You've walked {distLabel} in {formatRecordingTime(durationS)}. Save
            this trace to help improve routes?
          </Text>

          <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.7}>
            <Text style={styles.saveBtnText}>Save & Upload</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardBtn} onPress={onDiscard} activeOpacity={0.7}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.keepBtn} onPress={onKeepRecording} activeOpacity={0.7}>
            <Text style={styles.keepBtnText}>Keep Recording</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  saveBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  discardBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  discardBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  keepBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  keepBtnText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});
