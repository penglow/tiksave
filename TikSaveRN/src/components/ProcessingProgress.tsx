import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';
import { apiService } from '../services/api';

interface ProcessingStage {
  stage: string;
  progress: number;
  message: string;
  emoji: string;
}

interface ProcessingProgressProps {
  itemId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onCancel?: () => Promise<void> | void;
  isCancelling?: boolean;
  pollInterval?: number;
}

const STAGE_ORDER = ['queued', 'downloading', 'analyzing', 'extracting_location', 'classifying', 'saving', 'ready'];

export function ProcessingProgress({
  itemId,
  onComplete,
  onError,
  onCancel,
  isCancelling = false,
  pollInterval = 500,
}: ProcessingProgressProps) {
  const { colors } = useTheme();
  const [stage, setStage] = useState<ProcessingStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await apiService.getItemProgress(itemId);
        
        if (response.status === 'error') {
          setError(response.processing?.message || 'Processing failed');
          onError?.(response.processing?.message || 'Processing failed');
          return;
        }
        
        setStage(response.processing);
        progressWidth.value = withSpring(response.processing?.progress || 0, {
          damping: 15,
          stiffness: 100,
        });
        
        if (response.status === 'ready') {
          onComplete?.();
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      }
    };

    // Initial fetch
    fetchProgress();

    // Start polling
    pollRef.current = setInterval(fetchProgress, pollInterval);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [itemId, pollInterval, onComplete, onError]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (error) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[styles.container, { backgroundColor: colors.errorSubtle }]}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>❌</Text>
          <Text style={[styles.message, { color: colors.error }]}>{error}</Text>
        </View>
      </Animated.View>
    );
  }

  if (!stage) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.container, { backgroundColor: colors.accentSubtle }]}
      >
        <ActivityIndicator size="small" color={colors.text} />
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Starting...
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { backgroundColor: colors.accentSubtle }]}
    >
      {/* Stage info */}
      <View style={styles.header}>
        <Text style={styles.emoji}>{stage.emoji}</Text>
        <Text style={[styles.message, { color: colors.text }]}>
          {stage.message}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressBar,
            { backgroundColor: colors.success },
            progressBarStyle,
          ]}
        />
      </View>

      {/* Stage indicators */}
      <View style={styles.stagesRow}>
        {STAGE_ORDER.slice(0, -1).map((stageName, index) => {
          const currentIndex = STAGE_ORDER.indexOf(stage.stage);
          const isComplete = index < currentIndex;
          const isCurrent = stageName === stage.stage;
          
          return (
            <View
              key={stageName}
              style={[
                styles.stageDot,
                {
                  backgroundColor: isComplete
                    ? colors.success
                    : isCurrent
                    ? colors.text
                    : colors.border,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Percentage */}
      <Text style={[styles.percentage, { color: colors.textTertiary }]}>
        {Math.round(stage.progress)}%
      </Text>

      {onCancel && stage.stage !== 'ready' && (
        <Pressable
          onPress={() => {
            if (!isCancelling) {
              onCancel();
            }
          }}
          style={[styles.cancelButton, { borderColor: colors.border }]}
          disabled={isCancelling}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 20,
  },
  message: {
    ...Typography.bodyStrong,
    flex: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  stagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  percentage: {
    ...Typography.caption,
    textAlign: 'center',
  },
  cancelButton: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  cancelButtonText: {
    ...Typography.captionStrong,
  },
});

export default ProcessingProgress;
