import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

import { Colors, Spacing, BorderRadius } from '../config';
import { AppTheme } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const { userSettings, updateUserSettings } = useAppStore();
  const [thumbnailCacheSize] = useState('0.0 MB');

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data?',
      'This will permanently delete all your saved videos, folders, and learning data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement data deletion
            Alert.alert('Success', 'All data has been deleted.');
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert('Success', 'Thumbnail cache cleared.');
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Processing Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PROCESSING</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Video Upload</Text>
          </View>
          <Switch
            value={userSettings.enableVideoUpload}
            onValueChange={(value) => updateUserSettings({ enableVideoUpload: value })}
            trackColor={{ false: Colors.overlay, true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-file High Confidence</Text>
          </View>
          <Switch
            value={userSettings.autoFileHighConfidence}
            onValueChange={(value) => updateUserSettings({ autoFileHighConfidence: value })}
            trackColor={{ false: Colors.overlay, true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>

        <View style={styles.settingRowVertical}>
          <View style={styles.settingRowTop}>
            <Text style={styles.settingLabel}>Confidence Threshold</Text>
            <Text style={styles.settingValue}>
              {Math.round(userSettings.confidenceThreshold * 100)}%
            </Text>
          </View>
          <Slider
            style={styles.slider}
            value={userSettings.confidenceThreshold}
            onValueChange={(value) => updateUserSettings({ confidenceThreshold: value })}
            minimumValue={0.5}
            maximumValue={0.95}
            step={0.05}
            minimumTrackTintColor={Colors.primary}
            maximumTrackTintColor={Colors.overlay}
            thumbTintColor={Colors.primary}
          />
        </View>

        <Text style={styles.sectionFooter}>
          Video upload enables richer AI analysis. Without it, classification uses only shared
          text and URL.
        </Text>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>APPEARANCE</Text>

        <TouchableOpacity style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Theme</Text>
          </View>
          <View style={styles.themeSelector}>
            {(['light', 'dark', 'system'] as AppTheme[]).map((theme) => (
              <TouchableOpacity
                key={theme}
                style={[
                  styles.themeOption,
                  userSettings.theme === theme && styles.themeOptionSelected,
                ]}
                onPress={() => updateUserSettings({ theme })}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    userSettings.theme === theme && styles.themeOptionTextSelected,
                  ]}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Notifications</Text>
          </View>
          <Switch
            value={userSettings.notificationsEnabled}
            onValueChange={(value) => updateUserSettings({ notificationsEnabled: value })}
            trackColor={{ false: Colors.overlay, true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>
      </View>

      {/* Storage Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>STORAGE</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Cached Thumbnails</Text>
          </View>
          <Text style={styles.settingValue}>{thumbnailCacheSize}</Text>
        </View>

        <TouchableOpacity style={styles.settingRow} onPress={handleClearCache}>
          <Text style={styles.settingLabelWarning}>Clear Thumbnail Cache</Text>
        </TouchableOpacity>
      </View>

      {/* Data & Privacy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>DATA & PRIVACY</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => openLink('https://yourapp.com/privacy')}
        >
          <Text style={styles.settingLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textQuaternary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <Text style={styles.settingLabel}>Export My Data</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textQuaternary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleDeleteData}>
          <Text style={styles.settingLabelDanger}>Delete All My Data</Text>
        </TouchableOpacity>

        <Text style={styles.sectionFooter}>
          Deleting your data removes all saved videos, folders, and learning data permanently.
        </Text>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ABOUT</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Version</Text>
          <Text style={styles.settingValue}>{APP_VERSION}</Text>
        </View>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => openLink('https://yourapp.com/support')}
        >
          <Text style={styles.settingLabel}>Support</Text>
          <Ionicons name="arrow-up-forward" size={14} color={Colors.textQuaternary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => openLink('https://yourapp.com/feedback')}
        >
          <Text style={styles.settingLabel}>Send Feedback</Text>
          <Ionicons name="arrow-up-forward" size={14} color={Colors.textQuaternary} />
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>

        <TouchableOpacity style={styles.settingRow} onPress={handleSignOut}>
          <Text style={styles.settingLabelDanger}>Sign Out</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: Spacing.xxxl,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },
  sectionFooter: {
    fontSize: 12,
    color: Colors.textQuaternary,
    marginTop: Spacing.md,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.overlayLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  settingRowVertical: {
    backgroundColor: Colors.overlayLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  settingRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  settingLabelWarning: {
    fontSize: 15,
    color: Colors.warning,
  },
  settingLabelDanger: {
    fontSize: 15,
    color: Colors.error,
  },
  settingValue: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  themeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
  },
  themeOptionSelected: {
    backgroundColor: Colors.primary,
  },
  themeOptionText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  themeOptionTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
});

