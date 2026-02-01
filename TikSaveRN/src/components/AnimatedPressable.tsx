import React, { useCallback } from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp, Platform, AccessibilityRole } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animation } from '../config';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Scale factor on press (default: 0.97) */
    scaleOnPress?: number;
    /** Opacity on press (default: 0.8) */
    opacityOnPress?: number;
    /** Whether to trigger haptic feedback on press (default: false) */
    haptic?: boolean;
    /** Disable the scale animation */
    noScale?: boolean;
    /** Disable the opacity animation */
    noOpacity?: boolean;
    /** Accessibility label for screen readers */
    accessibilityLabel?: string;
    /** Accessibility hint for screen readers */
    accessibilityHint?: string;
    /** Accessibility role (default: 'button' when onPress is provided) */
    accessibilityRole?: AccessibilityRole;
}

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
            pressed.value = withTiming(1, {
                duration: Animation.duration.instant,
                easing: Easing.out(Easing.ease)
            });
            
            // Trigger haptic feedback if enabled
            if (haptic && Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
                    // Haptics may fail on some devices, ignore silently
                });
            }
            
            onPressIn?.(event);
        },
        [pressed, onPressIn, haptic]
    );

    const handlePressOut = useCallback(
        (event: any) => {
            pressed.value = withTiming(0, {
                duration: Animation.duration.fast,
                easing: Easing.out(Easing.ease)
            });
            onPressOut?.(event);
        },
        [pressed, onPressOut]
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

    // Default to 'button' role if onPress is provided and no role is specified
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
