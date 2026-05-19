/**
 * Text wrapper with FadeInDown layout entrance (spring or timed).
 * Used for staggered hero copy on auth and onboarding screens.
 */

import React, { useMemo } from 'react';
import { TextProps, TextStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Animation } from '../config';

// --- Types / props ---
interface AnimatedTextProps extends TextProps {
    children: React.ReactNode;
    /** Delay in ms. */
    delay?: number;
    /** Animation duration when `spring` is false. */
    duration?: number;
    /** Use a spring animation (default: true). */
    spring?: boolean;
    /** Damping for spring (lower = more bounce). */
    damping?: number;
    /** Stiffness for spring (higher = snappier). */
    stiffness?: number;
    style?: TextStyle | TextStyle[];
}

// --- Main component ---
export function AnimatedText({
    children,
    delay = 0,
    duration = Animation.duration.normal,
    spring = true,
    damping = Animation.spring.gentle.damping,
    stiffness = Animation.spring.gentle.stiffness,
    style,
    ...props
}: AnimatedTextProps) {

    const enteringAnimation = useMemo(() => {
        const anim = FadeInDown.delay(delay);
        if (spring) {
            return anim.springify().damping(damping).stiffness(stiffness);
        }
        return anim.duration(duration);
    }, [delay, spring, damping, stiffness, duration]);

    return (
        <Animated.Text
            entering={enteringAnimation}
            style={style}
            {...props}
        >
            {children}
        </Animated.Text>
    );
}
