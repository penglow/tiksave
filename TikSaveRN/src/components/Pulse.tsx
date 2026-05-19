/**
 * Live-status pulse indicator: center dot plus expanding fade rings.
 * Used for recording, live, or in-progress cues on map and detail UI.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

// --- Types / props ---
interface PulseProps {
  /** Color of the dot and the rings. */
  color: string;
  /** Diameter of the inner dot. */
  size?: number;
  /** Number of expanding rings (default: 2). */
  rings?: number;
  /** Cycle duration in ms (default: 1700). */
  duration?: number;
  style?: ViewStyle;
}

// --- Main component ---
export function Pulse({
  color,
  size = 8,
  rings = 2,
  duration = 1700,
  style,
}: PulseProps) {
  return (
    <View
      style={[
        { width: size * 4, height: size * 4, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {Array.from({ length: rings }).map((_, i) => (
        <Ring
          key={i}
          color={color}
          size={size}
          duration={duration}
          delay={(duration / rings) * i}
        />
      ))}
      <View
        style={[
          styles.dot,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function Ring({
  color,
  size,
  duration,
  delay,
}: {
  color: string;
  size: number;
  duration: number;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [duration, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = 1 + progress.value * 3;
    const opacity = (1 - progress.value) * 0.55;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
