/**
 * Branded loading spinner — LogoMark on a continuous rotation with optional pulse.
 * Drop-in alternative to ActivityIndicator on import and processing UIs.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import { LogoMark } from './Logo';

// --- Types / props ---
interface RotatingLogoProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
  /** Time for one full revolution (default: 1100ms). */
  duration?: number;
  /** Adds a subtle pulse on top of the rotation. */
  pulse?: boolean;
}

/**
 * Branded loading spinner — the LogoMark rotating with an optional gentle
 * pulse. Use anywhere you'd otherwise drop in <ActivityIndicator />.
 */
export function RotatingLogo({
  size = 28,
  color,
  style,
  duration = 1100,
  pulse = true,
}: RotatingLogoProps) {
  const angle = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear }),
      -1,
      false,
    );

    if (pulse) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(1, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        true,
      );
    }
  }, [duration, pulse, angle, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }, { scale: scale.value }],
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={[styles.fill, animatedStyle]}>
        <LogoMark size={size} color={color} />
      </Animated.View>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
