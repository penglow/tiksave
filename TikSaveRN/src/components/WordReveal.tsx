/**
 * Editorial word-by-word headline reveal using per-word UI-thread springs.
 * Avoids layout `entering` animations that break under react-native-screens detach.
 */

import React, { useMemo, memo, useEffect } from 'react';
import { View, StyleSheet, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';

import { Animation } from '../config';

// --- Types / props ---
type Segment = { text: string; style?: TextStyle };

interface WordRevealProps {
  /**
   * Either a single string (split on whitespace) or pre-segmented chunks.
   * Use segments when parts of the headline need different styling
   * (e.g. an italic accent word).
   */
  text?: string;
  segments?: Segment[];
  /** Style applied to every word. */
  style?: TextStyle | TextStyle[];
  /** Delay before the first word reveals. */
  delay?: number;
  /** Per-word stagger in ms (default: Animation.staggerWord). */
  stagger?: number;
  /** Spring stiffness — higher = snappier (default: 520). */
  stiffness?: number;
  /** Spring damping (default: 18). */
  damping?: number;
  /** Distance words slide from on enter, in pixels (default: 14). */
  fromY?: number;
}

interface RevealWordProps {
  text: string;
  combinedStyle: (TextStyle | undefined)[];
  delayMs: number;
  damping: number;
  stiffness: number;
  fromY: number;
}

// --- Helpers ---
/** One word uses its own shared values — avoids layout `entering` which breaks when screens detach. */
function RevealWord({
  text,
  combinedStyle,
  delayMs,
  damping,
  stiffness,
  fromY,
}: RevealWordProps) {
  const settled = useSharedValue(0);

  useEffect(() => {
    settled.value = 0;
    settled.value = withDelay(
      delayMs,
      withSpring(1, { damping, stiffness, mass: 0.9 }),
    );
    return () => cancelAnimation(settled);
  }, [delayMs, damping, stiffness, fromY, settled]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const p = settled.value;
    return {
      opacity: p <= 0 ? 0 : p >= 1 ? 1 : p,
      transform: [{ translateY: (1 - p) * fromY }],
    };
  });

  return (
    <Animated.Text style={[styles.word, ...combinedStyle, animatedStyle]}>
      {text + ' '}
    </Animated.Text>
  );
}

// --- Main component ---
function WordRevealInner({
  text,
  segments,
  style,
  delay = 0,
  stagger = Animation.staggerWord,
  stiffness = 520,
  damping = 18,
  fromY = 14,
}: WordRevealProps) {
  const words = useMemo(() => {
    if (segments && segments.length > 0) {
      const out: Segment[] = [];
      for (const segment of segments) {
        const tokens = segment.text.split(/(\s+)/).filter(Boolean);
        for (const token of tokens) {
          if (token.trim().length === 0) continue;
          out.push({ text: token, style: segment.style });
        }
      }
      return out;
    }
    return (text ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map<Segment>((t) => ({ text: t }));
  }, [text, segments]);

  return (
    <View style={styles.row}>
      {words.map((word, i) => (
        <RevealWord
          key={`${word.text}-${i}`}
          text={word.text}
          combinedStyle={[style as TextStyle, word.style]}
          delayMs={delay + i * stagger}
          damping={damping}
          stiffness={stiffness}
          fromY={fromY}
        />
      ))}
    </View>
  );
}

export const WordReveal = memo(WordRevealInner);

// --- Styles ---
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  word: {
    // Avoid stray descender clipping when each word is its own view
    paddingBottom: 2,
  },
});
