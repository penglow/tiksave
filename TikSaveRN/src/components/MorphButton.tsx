/**
 * Import-screen primary CTA with morphing state machine (idle → submitting → progress → done/error).
 * Pill collapses to a circle; progress ring and done checkmark are driven by Reanimated shared values.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator, Platform, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Animation, Spacing, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';

// --- Constants ---
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BUTTON_HEIGHT = 52;

// --- Types / props ---
export type MorphState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'progress'; completed: number; total: number }
  | { kind: 'done' }
  | { kind: 'error' };

interface MorphButtonProps {
  /** Visible label in idle state. e.g. "Import 2 →" or "Paste a link to start". */
  label: string;
  state: MorphState;
  /** 'solid' = filled (active CTA). 'ghost' = outline (no-op CTA — onPress fires onPressGhost). */
  variant: 'solid' | 'ghost';
  /** Fired on tap when variant === 'solid' AND state.kind === 'idle'. */
  onPress?: () => void;
  /** Fired on tap when variant === 'ghost'. Use to trigger a shake on an empty input. */
  onPressGhost?: () => void;
  /** Fired on tap when state.kind === 'progress'. Use to confirm + cancel. */
  onPressProgress?: () => void;
  /** Fired on tap when state.kind === 'error'. Use to retry. */
  onPressRetry?: () => void;
  /** Fire haptic on press-in (native only). */
  haptic?: boolean;
  accessibilityLabel?: string;
}

// --- Main component ---
export function MorphButton({
  label,
  state,
  variant,
  onPress,
  onPressGhost,
  onPressProgress,
  onPressRetry,
  haptic = false,
  accessibilityLabel,
}: MorphButtonProps) {
  const { colors } = useTheme();

  const [parentWidth, setParentWidth] = useState(0);
  const pressFill = useSharedValue(0);
  const morph = useSharedValue(0); // 0 = full-width pill, 1 = circle
  const ring = useSharedValue(0);  // 0..1 progress ring fill (progress state)
  const doneScale = useSharedValue(0);
  const errorFlash = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - parentWidth) > 0.5) setParentWidth(w);
  };

  // Effect A — fires on kind transitions; handles all morph/doneScale/errorFlash/pressFill.
  // ring is intentionally NOT cancelled here so Effect B's smooth spring isn't interrupted.
  useEffect(() => {
    if (state.kind === 'idle') {
      morph.value = withTiming(0, { duration: Animation.morph.morphDuration });
      doneScale.value = withTiming(0, { duration: Animation.duration.fast });
      ring.value = withTiming(0, { duration: Animation.duration.fast });
      errorFlash.value = withTiming(0, { duration: Animation.duration.fast });
      pressFill.value = withTiming(0, { duration: Animation.duration.fast });
    } else if (state.kind === 'submitting') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      ring.value = withTiming(0, { duration: Animation.duration.fast });
    } else if (state.kind === 'progress') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      // Initial ring value handled by Effect B below.
    } else if (state.kind === 'done') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      ring.value = withSpring(1, Animation.morph.ringFillSpring);
      doneScale.value = withDelay(
        120,
        withSpring(1, Animation.morph.doneScaleSpring),
      );
    } else if (state.kind === 'error') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      errorFlash.value = withSequence(
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }),
      );
    }
    return () => {
      cancelAnimation(morph);
      cancelAnimation(doneScale);
      cancelAnimation(errorFlash);
      cancelAnimation(pressFill);
      // Note: ring is NOT cancelled here — its progress is owned by Effect B
      // so its smooth spring isn't interrupted on every progress tick.
    };
  }, [state.kind]); // intentional: only re-run on kind changes; shared values are stable refs

  // Effect B — drives the ring spring smoothly as progress numbers change.
  // Only `progressCompleted` and `progressTotal` are deps so the spring is never
  // restarted except when the fraction actually changes.
  const progressCompleted = state.kind === 'progress' ? state.completed : 0;
  const progressTotal = state.kind === 'progress' ? state.total : 0;

  useEffect(() => {
    if (state.kind !== 'progress') return;
    const target = progressTotal > 0 ? progressCompleted / progressTotal : 0;
    ring.value = withSpring(target, Animation.morph.ringFillSpring);
  }, [progressCompleted, progressTotal]); // intentional: state.kind/ring/Animation are stable

  const handlePressIn = () => {
    if (state.kind !== 'idle' && state.kind !== 'error') return;
    if (variant === 'solid') {
      pressFill.value = withTiming(1, {
        duration: Animation.press.fillDuration,
        easing: Easing.bezier(...Animation.press.fillEasing),
      });
    }
    if (haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressOut = () => {
    pressFill.value = withTiming(0, { duration: Animation.duration.fast });
  };

  const handlePress = () => {
    if (state.kind === 'progress') {
      onPressProgress?.();
      return;
    }
    if (state.kind === 'error') {
      onPressRetry?.();
      return;
    }
    if (state.kind !== 'idle') return;
    if (variant === 'ghost') {
      onPressGhost?.();
    } else {
      onPress?.();
    }
  };

  // Width morph: full parent width → square (BUTTON_HEIGHT) using measured layout
  const containerStyle = useAnimatedStyle(() => {
    if (parentWidth <= 0) {
      // Pre-measure: don't animate, use full width.
      return { width: '100%', alignSelf: 'center' as const };
    }
    const w = interpolate(
      morph.value,
      [0, 1],
      [parentWidth, BUTTON_HEIGHT],
      Extrapolation.CLAMP,
    );
    return { width: w, alignSelf: 'center' as const };
  });

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: pressFill.value }],
    opacity: 1 - morph.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1 - morph.value,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity:
      state.kind === 'submitting' || state.kind === 'progress' ? morph.value : 0,
  }));

  const ringStyle = useAnimatedStyle(() => {
    // Border-conic effect via two semi-circles is hard in RN.
    // Use opacity + scale instead; ProgressArc is a simple radial fill bar.
    return { opacity: state.kind === 'progress' ? 1 : 0 };
  });

  const ringFillStyle = useAnimatedStyle(() => ({
    height: `${ring.value * 100}%`,
  }));

  const doneStyle = useAnimatedStyle(() => ({
    opacity: doneScale.value,
    transform: [{ scale: doneScale.value }],
  }));

  const errorFlashStyle = useAnimatedStyle(() => ({
    opacity: errorFlash.value * 0.6,
  }));

  const solidBg =
    state.kind === 'error' ? colors.error : colors.text;
  const ghostBg = 'transparent';
  const baseBg = variant === 'solid' ? solidBg : ghostBg;
  const fgColor = variant === 'solid' ? colors.background : colors.textSecondary;

  const a11yState = {
    busy: state.kind === 'submitting' || state.kind === 'progress',
  };

  const a11yLabel = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    switch (state.kind) {
      case 'submitting':
        return 'Submitting';
      case 'progress':
        return `Importing ${state.completed} of ${state.total}, tap to cancel`;
      case 'done':
        return 'Import complete';
      case 'error':
        return 'Import failed, tap to retry';
      default:
        return label;
    }
  }, [state, label, accessibilityLabel]);

  return (
    <View style={styles.outerHost} onLayout={handleLayout}>
    <Animated.View style={[styles.outer, containerStyle]}>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={a11yState}
        style={[
          styles.button,
          {
            backgroundColor: baseBg,
            borderColor: variant === 'ghost' ? colors.border : 'transparent',
          },
        ]}
      >
        {/* Press-fill sweep (left → right). Hidden once morph begins. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: colors.accent },
            fillStyle,
          ]}
        />

        {/* Error-flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: colors.error, transform: [{ scaleX: 1 }] },
            errorFlashStyle,
          ]}
        />

        {/* Idle label */}
        <Animated.View style={[styles.labelRow, labelStyle]}>
          <Text style={[styles.labelText, { color: fgColor }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>

        {/* Spinner (submitting) */}
        <Animated.View style={[styles.center, spinnerStyle]} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.background} />
        </Animated.View>

        {/* Progress fill bar (rises bottom → top inside the circle) */}
        <Animated.View style={[styles.center, ringStyle]} pointerEvents="none">
          <View style={styles.ringTrack}>
            <Animated.View
              style={[
                styles.ringFill,
                { backgroundColor: colors.accent },
                ringFillStyle,
              ]}
            />
          </View>
          {state.kind === 'progress' && (
            <Text style={[styles.ringText, { color: colors.background }]}>
              {state.completed}/{state.total}
            </Text>
          )}
        </Animated.View>

        {/* Done check */}
        <Animated.View style={[styles.center, doneStyle]} pointerEvents="none">
          <Ionicons name="checkmark" size={24} color={colors.background} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  outerHost: {
    width: '100%',
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    height: BUTTON_HEIGHT,
  },
  button: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '100%',
    transformOrigin: 'left center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  labelText: {
    ...Typography.bodyStrong,
  },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: BUTTON_HEIGHT - 8,
    height: BUTTON_HEIGHT - 8,
    borderRadius: (BUTTON_HEIGHT - 8) / 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    opacity: 0.4,
  },
  ringFill: {
    width: '100%',
  },
  ringText: {
    ...Typography.captionStrong,
    position: 'absolute',
    fontSize: 11,
  },
});

export default MorphButton;
