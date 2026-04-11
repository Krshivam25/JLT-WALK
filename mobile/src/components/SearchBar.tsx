import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii } from '../utils/theme';

interface Props {
  onSearch: (query: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  onClear,
  placeholder = 'Where to?',
}: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    setValue(text);
    onSearch(text);
  };

  const handleClear = () => {
    setValue('');
    inputRef.current?.blur();
    onClear?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.greenDot} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={handleChange}
        returnKeyType="search"
        selectionColor={colors.accent}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    height: 48,
    gap: spacing.md,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
});
