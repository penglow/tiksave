import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius } from '../config';
import { getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { InboxStackScreenProps } from '../navigation/types';

// This screen can be accessed from multiple stacks, so we use a union type
type Props =
  | InboxStackScreenProps<'VideoDetail'>
  | { route: { params: { item: import('../types').SaveItem } }; navigation: any };

export default function VideoDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const [isDeleting, setIsDeleting] = useState(false);

  const openInTikTok = () => {
    Linking.openURL(item.sourceURL);
  };

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      await apiService.deleteItem(item.id);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to delete video. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete video. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Delete this video from your library? This cannot be undone.');
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Video',
        'Are you sure you want to delete this video from your library? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Video Preview */}
      <View style={styles.previewContainer}>
        <TouchableOpacity 
          style={styles.previewWrapper}
          onPress={openInTikTok}
          activeOpacity={0.8}
        >
          {item.thumbnailURL ? (
            <Image 
              source={{ 
                uri: item.thumbnailURL,
                cache: 'force-cache'
              }} 
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[`${Colors.secondary}66`, `${Colors.primary}66`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewGradient}
            />
          )}
          
          {/* Open in TikTok Overlay */}
          <View style={styles.previewOverlay} pointerEvents="none">
            <TouchableOpacity style={styles.playButton} activeOpacity={1}>
              <Ionicons name="play-circle" size={60} color={Colors.text} />
              <Text style={styles.openText}>Open in TikTok</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        {/* Title */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Title</Text>
          <Text style={styles.infoTitle}>{getDisplayTitle(item)}</Text>
        </View>

        {/* Creator */}
        {item.creatorUsername && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Creator</Text>
            <Text style={styles.infoCreator}>{item.creatorUsername}</Text>
          </View>
        )}

        {/* Folder */}
        {item.folderName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Filed in</Text>
            <View style={styles.folderBadge}>
              <Ionicons name="folder" size={14} color={Colors.text} />
              <Text style={styles.folderBadgeText}>{item.folderName}</Text>
            </View>
          </View>
        )}

        {/* Topics */}
        {item.detectedTopics.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Topics</Text>
            <View style={styles.tagsContainer}>
              {item.detectedTopics.map((topic) => (
                <View key={topic} style={styles.topicTag}>
                  <Text style={styles.topicTagText}>{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Labels */}
        {item.detectedLabels.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Labels</Text>
            <View style={styles.tagsContainer}>
              {item.detectedLabels.slice(0, 10).map((label) => (
                <View key={label} style={styles.labelTag}>
                  <Text style={styles.labelTagText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Transcript */}
        {item.transcriptText && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Transcript</Text>
            <Text style={styles.transcriptText} numberOfLines={10}>
              {item.transcriptText}
            </Text>
          </View>
        )}

        {/* Confidence */}
        {item.confidence !== undefined && item.confidence !== null && item.confidence > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>AI Confidence</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${item.confidence * 100}%` },
                  item.confidence >= 0.85
                    ? styles.confidenceHigh
                    : item.confidence >= 0.6
                      ? styles.confidenceMedium
                      : styles.confidenceLow,
                ]}
              />
            </View>
            <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}%</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.actionButton} onPress={openInTikTok} activeOpacity={0.8}>
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.actionButtonGradient}
        >
          <Ionicons name="open-outline" size={20} color={Colors.text} />
          <Text style={styles.actionButtonText}>Open in TikTok</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Delete Button */}
      <TouchableOpacity 
        style={styles.deleteButton} 
        onPress={handleDelete} 
        activeOpacity={0.8}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color={Colors.error} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete Video</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewWrapper: {
    width: 200,
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewGradient: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  openText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: Colors.overlayLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  infoRow: {
    gap: Spacing.sm,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  infoCreator: {
    fontSize: 15,
    color: Colors.primary,
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  folderBadgeText: {
    fontSize: 14,
    color: Colors.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  topicTag: {
    backgroundColor: `${Colors.primary}33`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  topicTagText: {
    fontSize: 13,
    color: Colors.primary,
  },
  labelTag: {
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  labelTagText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  transcriptText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: Colors.overlay,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceHigh: {
    backgroundColor: Colors.success,
  },
  confidenceMedium: {
    backgroundColor: Colors.warning,
  },
  confidenceLow: {
    backgroundColor: Colors.error,
  },
  confidenceText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  actionButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  actionButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.lg,
  },
  deleteButtonText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '500',
  },
});

