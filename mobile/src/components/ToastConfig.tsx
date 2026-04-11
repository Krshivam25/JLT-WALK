import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, radii, fonts } from '../utils/theme';
import { BaseToastProps } from 'react-native-toast-message';

const CONFIGS: Record<string, { icon: string; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: colors.accent, bg: '#0D2818' },
  error: { icon: 'alert-circle', color: colors.danger, bg: '#2D0A0A' },
  info: { icon: 'information-circle', color: '#3B82F6', bg: '#0A1A2D' },
};

function CustomToast({ type, text1, text2 }: BaseToastProps & { type: string }) {
  const cfg = CONFIGS[type] || CONFIGS.info;
  return (
    <View style={[styles.container, { backgroundColor: cfg.bg, borderLeftColor: cfg.color }]}>
      <Icon name={cfg.icon} size={22} color={cfg.color} />
      <View style={styles.textWrap}>
        {text1 ? <Text style={[styles.title, { color: cfg.color }]}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message} numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: (props: BaseToastProps) => <CustomToast {...props} type="success" />,
  error: (props: BaseToastProps) => <CustomToast {...props} type="error" />,
  info: (props: BaseToastProps) => <CustomToast {...props} type="info" />,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderLeftWidth: 4,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  textWrap: { flex: 1 },
  title: { fontSize: fonts.sizes.md, fontWeight: '700' },
  message: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
