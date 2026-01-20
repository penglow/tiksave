import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInRight,
    SlideInUp,
} from 'react-native-reanimated';
import { Animation } from '../config';

interface AnimatedListItemProps {
    children: React.ReactNode;
    index: number;
    style?: StyleProp<ViewStyle>;
    /** Animation direction (default: 'up') */
    direction?: 'up' | 'right' | 'fade';
    /** Custom delay per item in ms (default: Animation.stagger) */
    staggerDelay?: number;
    /** Base duration for the animation */
    duration?: number;
    /** Whether to animate layout changes */
    animateLayout?: boolean;
}

/**
 * Wrapper for list items that provides staggered entrance animations
 */
export function AnimatedListItem({
    children,
    index,
    style,
    direction = 'up',
    staggerDelay = Animation.stagger,
    duration = Animation.duration.entrance,
    animateLayout = true,
}: AnimatedListItemProps) {
    const delay = index * staggerDelay;

    const getEnteringAnimation = () => {
        switch (direction) {
            case 'right':
                return SlideInRight.duration(duration).springify().damping(14).stiffness(100).delay(delay);
            case 'fade':
                return FadeIn.duration(duration).delay(delay);
            case 'up':
            default:
                return SlideInUp.duration(duration).springify().damping(14).stiffness(100).delay(delay);
        }
    };

    return (
        <Animated.View
            style={style}
            entering={getEnteringAnimation()}
            exiting={FadeOut.duration(Animation.duration.fast)}
        >
            {children}
        </Animated.View>
    );
}

interface AnimatedSectionProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Delay before the section animates in */
    delay?: number;
    /** Animation duration */
    duration?: number;
}

/**
 * Section wrapper with fade-in animation
 */
export function AnimatedSection({
    children,
    style,
    delay = 0,
    duration = Animation.duration.slow,
}: AnimatedSectionProps) {
    return (
        <Animated.View
            style={style}
            entering={FadeIn.duration(duration).delay(delay)}
            exiting={FadeOut.duration(Animation.duration.fast)}
        >
            {children}
        </Animated.View>
    );
}

export default AnimatedListItem;
