import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii } from '../utils/theme';

interface Props {
  visible: boolean;
  shortcutName: string;
  shortcutTags?: string[];
  onValidate: (result: 'valid' | 'invalid') => void;
  onDismiss: () => void;
}

const TAG_ICONS: Record<string, string> = {
  stairs: '\u{1FA9C}',
  shaded: '\u2600\uFE0F',
  fastest: '\u26A1',
  indoor: '\u{1F3E2}',
  risky: '\u26A0\uFE0F',
  scenic: '\u{1F33F}',
  accessible: '\u267F',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ValidationPrompt({
  visible,
  shortcutName,
  shortcutTags,
  onValidate,
  onDismiss,
}: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
        <Animated.View
          style={[styles.card, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>Is this path valid?</Text>

          {/* Shortcut name */}
          <Text style={styles.shortcutName}>{shortcutName}</Text>

          {/* Tags */}
          {shortcutTags && shortcutTags.length > 0 && (
            <View style={styles.tagsRow}>
              {shortcutTags.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagIcon}>{TAG_ICONS[tag] || ''}</Text>
                  <Text style={styles.tagLabel}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.btnYes}
              activeOpacity={0.7}
              onPress={() => onValidate('valid')}
            >
              <Icon name="thumbs-up" size={20} color={colors.bg} />
              <Text style={styles.btnYesText}>Yes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnNo}
              activeOpacity={0.7}
              onPress={() => onValidate('invalid')}
            >
              <Icon name="thumbs-down" size={20} color={colors.danger} />
              <Text style={styles.btnNoText}>No</Text>
            </TouchableOpacity>
          </View>
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  shortcutName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  tagLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  btnYes: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  btnYesText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg,
  },
  btnNo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  btnNoText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
});
