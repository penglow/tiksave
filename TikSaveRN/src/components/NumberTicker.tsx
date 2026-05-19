/**
 * Animated numeric display that springs between values (stats, counts on home/library).
 * Skips the initial 0→N pop on first non-zero fetch; updates only on whole-step changes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useSharedValue, withSpring, useAnimatedReaction, runOnJS } from 'react-native-reanimated';

import { Animation } from '../config';

// --- Types / props ---
interface NumberTickerProps {
  value: number;
  /** Style applied to the number text. */
  style?: StyleProp<TextStyle>;
  /** Spring stiffness (higher = faster). */
  stiffness?: number;
  /** Spring damping. */
  damping?: number;
  /** Optional formatter (e.g. for thousands separators). */
  format?: (n: number) => string;
  /** Number of decimal places to render (default: 0). */
  decimals?: number;
}

// --- Main component ---
export function NumberTicker({
  value,
  style,
  stiffness = Animation.spring.gentle.stiffness,
  damping = Animation.spring.gentle.damping,
  format,
  decimals = 0,
}: NumberTickerProps) {
  const animated = useSharedValue(value);
  const [display, setDisplay] = useState(value);
  const primedRef = useRef(value !== 0);

  useEffect(() => {
    if (!primedRef.current) {
      animated.value = value;
      setDisplay(value);
      if (value !== 0) primedRef.current = true;
      return;
    }
    animated.value = withSpring(value, { stiffness, damping, mass: 0.9 });
  }, [value, stiffness, damping, animated]);

  useAnimatedReaction(
    () => animated.value,
    (current, prev) => {
      'worklet';
      const factor = Math.pow(10, decimals);
      const rounded = Math.round(current * factor) / factor;
      const prevRounded = prev != null ? Math.round(prev * factor) / factor : null;
      if (rounded !== prevRounded) {
        runOnJS(setDisplay)(rounded);
      }
    },
    [decimals],
  );

  const text = format ? format(display) : display.toFixed(decimals);

  return <Text style={style}>{text}</Text>;
}
