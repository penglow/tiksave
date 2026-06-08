/**
 * Consistent screen title row: large title, subtitle, sparkle + profile actions.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, BorderRadius, Shadows } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onSparklePress?: () => void;
  onProfilePress?: () => void;
}

export function ScreenHeader({
  title,
  subtitle,
  onSparklePress,
  onProfilePress,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const openSettings = () => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    navigation.navigate('Settings');
  };

  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <AnimatedPressable
          onPress={onSparklePress}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.glassStrong, borderColor: colors.glassBorder },
            Shadows.glass,
          ]}
          accessibilityLabel="Smart features"
        >
          <Ionicons name="sparkles" size={20} color={colors.text} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={openSettings}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.glassStrong, borderColor: colors.glassBorder },
            Shadows.glass,
          ]}
          accessibilityLabel="Profile and settings"
        >
          <Ionicons name="person-circle-outline" size={22} color={colors.text} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.displayMd,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    ...Typography.bodySm,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: 4,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
