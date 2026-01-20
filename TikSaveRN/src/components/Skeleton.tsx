import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius } from '../config';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
    /** Animation duration for one complete sweep (default: 1200ms) */
    duration?: number;
}

/**
 * Skeleton loading component with shimmer animation
 */
export function Skeleton({
    width = '100%',
    height = 16,
    borderRadius = BorderRadius.sm,
    style,
    duration = 1200,
}: SkeletonProps) {
    const { colors } = useTheme();
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration, easing: Easing.linear }),
            -1,
            false
        );
    }, [duration]);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(shimmer.value, [0, 1], [-200, 200]);
        return {
            transform: [{ translateX }],
        };
    });

    return (
        <View
            style={[
                styles.container,
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: colors.accentSubtle,
                },
                style,
            ]}
        >
            <Animated.View style={[styles.shimmer, animatedStyle]}>
                <LinearGradient
                    colors={[
                        'transparent',
                        colors.accentMuted,
                        colors.accentSubtle,
                        colors.accentMuted,
                        'transparent',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                />
            </Animated.View>
        </View>
    );
}

interface SkeletonTextProps {
    lines?: number;
    lineHeight?: number;
    spacing?: number;
    lastLineWidth?: number | string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Multi-line text skeleton
 */
export function SkeletonText({
    lines = 3,
    lineHeight = 14,
    spacing = 8,
    lastLineWidth = '60%',
    style,
}: SkeletonTextProps) {
    return (
        <View style={style}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton
                    key={index}
                    height={lineHeight}
                    width={index === lines - 1 ? lastLineWidth : '100%'}
                    style={{ marginBottom: index < lines - 1 ? spacing : 0 }}
                />
            ))}
        </View>
    );
}

interface SkeletonVideoCardProps {
    style?: StyleProp<ViewStyle>;
}

/**
 * Video card skeleton for loading states
 */
export function SkeletonVideoCard({ style }: SkeletonVideoCardProps) {
    return (
        <View style={[styles.videoCard, style]}>
            <Skeleton width={140} height={180} borderRadius={BorderRadius.none} />
            <Skeleton width={120} height={14} style={{ marginTop: 8 }} />
            <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 200,
    },
    gradient: {
        flex: 1,
        width: 200,
    },
    videoCard: {
        width: 140,
    },
});

export default Skeleton;
