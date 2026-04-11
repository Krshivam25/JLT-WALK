import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii } from '../utils/theme';

interface Props {
  visible: boolean;
  isRecording: boolean;
  distance: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSave: (name: string, tags: string[]) => void;
  onCancel: () => void;
}

interface TagOption {
  key: string;
  label: string;
  icon: string;
}

const TAG_OPTIONS: TagOption[] = [
  { key: 'stairs', label: 'Stairs', icon: '\u{1FA9C}' },
  { key: 'shaded', label: 'Shaded', icon: '\u2600\uFE0F' },
  { key: 'fastest', label: 'Fastest', icon: '\u26A1' },
  { key: 'indoor', label: 'Indoor', icon: '\u{1F3E2}' },
  { key: 'risky', label: 'Risky', icon: '\u26A0\uFE0F' },
  { key: 'scenic', label: 'Scenic', icon: '\u{1F33F}' },
  { key: 'accessible', label: 'Accessible', icon: '\u267F' },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function ShortcutRecorder({
  visible,
  isRecording,
  distance,
  onStartRecording,
  onStopRecording,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Determine state: idle, recording, or naming
  const state = isRecording ? 'recording' : name !== undefined && !isRecording && visible ? 'naming' : 'idle';
  // After stop, we go to naming state. We use isRecording to distinguish.
  // idle: visible && !isRecording && user hasn't stopped yet
  // For simplicity: if isRecording -> recording, else -> naming (user either needs to start or has stopped)

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
      // Reset state when hiding
      setName('');
      setSelectedTags([]);
    }
  }, [visible, slideAnim]);

  // Pulsing red dot animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
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
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, selectedTags);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel} />
        <Animated.View
          style={[styles.card, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          {isRecording ? (
            /* Recording State */
            <View style={styles.recordingContent}>
              <View style={styles.recordingHeader}>
                <Animated.View style={[styles.redDot, { opacity: pulseAnim }]} />
                <Text style={styles.recordingTitle}>Recording shortcut...</Text>
              </View>

              <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
              <Text style={styles.distanceLabel}>distance covered</Text>

              <TouchableOpacity
                style={styles.stopBtn}
                activeOpacity={0.7}
                onPress={onStopRecording}
              >
                <Icon name="stop-circle" size={22} color={colors.text} />
                <Text style={styles.stopBtnText}>Stop Recording</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Naming State (also serves as idle/start state) */
            <ScrollView
              style={styles.namingScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {distance === 0 ? (
                /* Idle - Start recording */
                <View style={styles.idleContent}>
                  <Icon name="navigate-outline" size={48} color={colors.accent} />
                  <Text style={styles.idleTitle}>Record a Shortcut</Text>
                  <Text style={styles.idleSubtitle}>
                    Walk your shortcut path and we'll record it for the community.
                  </Text>
                  <TouchableOpacity
                    style={styles.startBtn}
                    activeOpacity={0.7}
                    onPress={onStartRecording}
                  >
                    <Icon name="radio-button-on" size={20} color={colors.bg} />
                    <Text style={styles.startBtnText}>Start Recording</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Naming - Save form */
                <View style={styles.namingContent}>
                  <Text style={styles.namingTitle}>Name Your Shortcut</Text>
                  <Text style={styles.namingSubtitle}>
                    {formatDistance(distance)} recorded
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Through the park gate"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    maxLength={80}
                    autoFocus
                  />

                  <Text style={styles.tagsLabel}>Tags</Text>
                  <View style={styles.tagsGrid}>
                    {TAG_OPTIONS.map(tag => {
                      const isSelected = selectedTags.includes(tag.key);
                      return (
                        <TouchableOpacity
                          key={tag.key}
                          style={[
                            styles.tagChip,
                            isSelected && styles.tagChipSelected,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => toggleTag(tag.key)}
                        >
                          <Text style={styles.tagChipIcon}>{tag.icon}</Text>
                          <Text
                            style={[
                              styles.tagChipLabel,
                              isSelected && styles.tagChipLabelSelected,
                            ]}
                          >
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                    activeOpacity={0.7}
                    onPress={handleSave}
                    disabled={!name.trim()}
                  >
                    <Icon name="checkmark-circle" size={20} color={colors.bg} />
                    <Text style={styles.saveBtnText}>Save Shortcut</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={onCancel}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgOverlay,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },

  // Recording state
  recordingContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  recordingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  distanceText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  distanceLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  stopBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  // Idle state
  idleContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  idleSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg,
  },

  // Naming state
  namingScroll: {
    flexGrow: 0,
  },
  namingContent: {
    paddingVertical: spacing.lg,
  },
  namingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  namingSubtitle: {
    fontSize: 14,
    color: colors.accent,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tagChipSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
  },
  tagChipIcon: {
    fontSize: 14,
  },
  tagChipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tagChipLabelSelected: {
    color: colors.accent,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  cancelBtnText: {
    fontSize: 15,
    color: colors.textMuted,
  },
});
