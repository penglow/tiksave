/**
 * Pressable with Reanimated scale/opacity feedback and optional haptics.
 * Base interaction primitive used by buttons, chips, list rows, and modals.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  PressableProps,
  ViewStyle,
  StyleProp,
  Platform,
  AccessibilityRole,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animation } from '../config';

// --- Constants ---
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

// --- Types / props ---
interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale factor on press (default: Animation.press.scale). */
  scaleOnPress?: number;
  /** Opacity on press (default: Animation.press.opacity). */
  opacityOnPress?: number;
  /** Trigger haptic feedback on press in (default: false). */
  haptic?: boolean;
  /** Disable scale animation. */
  noScale?: boolean;
  /** Disable opacity animation. */
  noOpacity?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
}

// --- Main component ---
export function AnimatedPressable({
  children,
  style,
  scaleOnPress = Animation.press.scale,
  opacityOnPress = Animation.press.opacity,
  haptic = false,
  noScale = false,
  noOpacity = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  ...rest
}: AnimatedPressableProps) {
  const pressed = useSharedValue(0);

  const handlePressIn = useCallback(
    (event: any) => {
      pressed.value = withSpring(1, Animation.spring.crisp, () => {});

      if (haptic && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      onPressIn?.(event);
    },
    [pressed, onPressIn, haptic],
  );

  const handlePressOut = useCallback(
    (event: any) => {
      pressed.value = withSpring(0, Animation.spring.snappy);
      onPressOut?.(event);
    },
    [pressed, onPressOut],
  );

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const scale = noScale ? 1 : interpolate(pressed.value, [0, 1], [1, scaleOnPress]);
    const opacity = noOpacity ? 1 : interpolate(pressed.value, [0, 1], [1, opacityOnPress]);

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const effectiveRole = accessibilityRole ?? (onPress ? 'button' : undefined);

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={effectiveRole}
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}

export default AnimatedPressable;
