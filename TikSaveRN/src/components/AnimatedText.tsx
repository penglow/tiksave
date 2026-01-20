import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Animation } from '../config';

interface AnimatedTextProps extends TextProps {
    children: React.ReactNode;
    /** Delay in ms */
    delay?: number;
    /** Animation duration (ignored if spring is used, but kept for API consistency) */
    duration?: number;
    /** Whether to use a spring animation (default: true) */
    spring?: boolean;
    /** Damping for spring (default: 12) - lower = more bounce */
    damping?: number;
    /** Stiffness for spring (default: 100) */
    stiffness?: number;
    style?: TextStyle | TextStyle[];
}

/**
 * Text component that enters with a modern, subtle spring animation.
 */
export function AnimatedText({
    children,
    delay = 0,
    duration = Animation.duration.normal,
    spring = true,
    damping = 12,
    stiffness = 100,
    style,
    ...props
}: AnimatedTextProps) {

    const getEnteringAnimation = () => {
        let anim = FadeInDown.delay(delay);

        if (spring) {
            return anim.springify().damping(damping).stiffness(stiffness);
        }

        return anim.duration(duration);
    };

    return (
        <Animated.Text
            entering={getEnteringAnimation()}
            style={style}
            {...props}
        >
            {children}
        </Animated.Text>
    );
}
