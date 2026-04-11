import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, fonts } from '../utils/theme';

const { width, height } = Dimensions.get('window');

interface Page {
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
}

const pages: Page[] = [
  {
    title: 'Walk Smarter in JLT',
    subtitle:
      'The fastest routes aren\'t always the shortest. We learn real walking times from the community.',
    icon: 'footsteps',
    accentColor: colors.accent,
  },
  {
    title: 'Discover Shortcuts',
    subtitle:
      'Find hidden cut-throughs, shaded paths, and the best entrances \u2014 all verified by locals.',
    icon: 'compass',
    accentColor: colors.purple,
  },
  {
    title: 'Community Powered',
    subtitle:
      'Every walk you record helps improve routes for everyone in JLT.',
    icon: 'people',
    accentColor: '#00D9F5',
  },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    onComplete();
  };

  const renderPage = ({ item }: { item: Page }) => (
    <View style={styles.page}>
      <View style={[styles.iconCircle, { backgroundColor: item.accentColor + '20' }]}>
        <Icon name={item.icon} size={80} color={item.accentColor} />
      </View>
      <Text style={[styles.title, { color: item.accentColor }]}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  const isLast = currentIndex === pages.length - 1;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {pages.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === currentIndex ? pages[currentIndex].accentColor : colors.textMuted,
                width: i === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goNext}
          style={[styles.nextBtn, { backgroundColor: pages[currentIndex].accentColor }]}
        >
          <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fonts.sizes.hero,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: fonts.sizes.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 50,
  },
  skipBtn: {
    padding: spacing.md,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: fonts.sizes.md,
  },
  nextBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
  },
  nextText: {
    color: colors.bg,
    fontSize: fonts.sizes.md,
    fontWeight: '700',
  },
});
