/**
 * List/section wrappers with capped staggered layout animations (Reanimated entering/exiting).
 * AnimatedListItem wraps rows; AnimatedSection wraps grouped blocks.
 */

import React, { useMemo } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideInUp,
  SlideInDown,
} from 'react-native-reanimated';
import { Animation } from '../config';

// --- Types / props ---
interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
  /** Animation direction (default: 'up'). */
  direction?: 'up' | 'down' | 'right' | 'fade';
  /** Custom delay per item in ms (default: Animation.stagger). */
  staggerDelay?: number;
  /** Base duration for the animation. */
  duration?: number;
  /** Maximum stagger delay — caps total runway for long lists. */
  maxStagger?: number;
  /** Turn off native exit layout animations (avoids jank/detach quirks on tab/stack blur). */
  disableExitAnimation?: boolean;
}

// --- Main component ---
export function AnimatedListItem({
  children,
  index,
  style,
  direction = 'up',
  staggerDelay = Animation.stagger,
  duration = Animation.duration.entrance,
  maxStagger = 320,
  disableExitAnimation = false,
}: AnimatedListItemProps) {
  const delay = Math.min(index * staggerDelay, maxStagger);
  const exitingAnimation = useMemo(() => FadeOut.duration(Animation.duration.exit), []);

  const enteringAnimation = useMemo(() => {
    const spring = Animation.spring.gentle;
    switch (direction) {
      case 'right':
        return SlideInRight.duration(duration)
          .springify()
          .damping(spring.damping)
          .stiffness(spring.stiffness)
          .mass(spring.mass)
          .delay(delay);
      case 'down':
        return SlideInDown.duration(duration)
          .springify()
          .damping(spring.damping)
          .stiffness(spring.stiffness)
          .mass(spring.mass)
          .delay(delay);
      case 'fade':
        return FadeIn.duration(duration).delay(delay);
      case 'up':
      default:
        return SlideInUp.duration(duration)
          .springify()
          .damping(spring.damping)
          .stiffness(spring.stiffness)
          .mass(spring.mass)
          .delay(delay);
    }
  }, [
    delay,
    direction,
    duration,
    Animation.spring.gentle.damping,
    Animation.spring.gentle.stiffness,
    Animation.spring.gentle.mass,
  ]);

  return (
    <Animated.View
      style={style}
      entering={enteringAnimation}
      {...(disableExitAnimation ? {} : { exiting: exitingAnimation })}
    >
      {children}
    </Animated.View>
  );
}

interface AnimatedSectionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}

/** Section wrapper with quick fade-in. */
export function AnimatedSection({
  children,
  style,
  delay = 0,
  duration = Animation.duration.normal,
}: AnimatedSectionProps) {
  const exitingAnimation = useMemo(() => FadeOut.duration(Animation.duration.exit), []);

  const enteringAnimation = useMemo(
    () => FadeIn.duration(duration).delay(delay),
    [delay, duration],
  );

  return (
    <Animated.View style={style} entering={enteringAnimation} exiting={exitingAnimation}>
      {children}
    </Animated.View>
  );
}

export default AnimatedListItem;
