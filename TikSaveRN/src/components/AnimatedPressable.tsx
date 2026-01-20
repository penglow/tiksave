import React, { useCallback } from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
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
    ...rest
}: AnimatedPressableProps) {
    const pressed = useSharedValue(0);

    const handlePressIn = useCallback(
        (event: any) => {
            pressed.value = withTiming(1, {
                duration: Animation.duration.instant,
                easing: Easing.out(Easing.ease)
            });
            onPressIn?.(event);
        },
        [pressed, onPressIn]
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

    return (
        <AnimatedPressableBase
            style={[animatedStyle, style]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            disabled={disabled}
            {...rest}
        >
            {children}
        </AnimatedPressableBase>
    );
}

export default AnimatedPressable;
