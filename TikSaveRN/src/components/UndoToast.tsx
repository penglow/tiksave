/**
 * Bottom snackbar with undo action and shrinking progress bar for timed destructive ops.
 * Positioned above the safe-area inset; used after delete/move with grace period.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, BorderRadius, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

// --- Types / props ---
interface UndoToastProps {
  message: string;
  timeRemaining: number;
  totalTime?: number;
  onUndo: () => void;
  onDismiss?: () => void;
  visible: boolean;
}

// --- Main component ---
export function UndoToast({
  message,
  timeRemaining,
  totalTime = 5000,
  onUndo,
  onDismiss,
  visible,
}: UndoToastProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const progress = timeRemaining / totalTime;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress * 100}%`,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(15)}
      exiting={SlideOutDown.duration(200)}
      style={[
        styles.container,
        {
          bottom: insets.bottom + Spacing.md,
          backgroundColor: colors.text,
        },
      ]}
    >
      <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
        <Animated.View
          style={[
            styles.progressBar,
            { backgroundColor: colors.background },
            progressStyle,
          ]}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.messageContainer}>
          <Ionicons name="trash-outline" size={18} color={colors.background} style={styles.icon} />
          <Text style={[styles.message, { color: colors.background }]} numberOfLines={1}>
            {message}
          </Text>
        </View>

        <View style={styles.actions}>
          <AnimatedPressable
            style={styles.undoButton}
            onPress={onUndo}
            haptic
          >
            <Text style={[styles.undoText, { color: colors.warning }]}>
              Undo
            </Text>
          </AnimatedPressable>

          {onDismiss && (
            <Pressable style={styles.dismissButton} onPress={onDismiss}>
              <Ionicons name="close" size={18} color={colors.background} />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  message: {
    ...Typography.body,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  undoButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  undoText: {
    ...Typography.bodyStrong,
  },
  dismissButton: {
    padding: Spacing.xs,
    opacity: 0.7,
  },
});

export default UndoToast;
