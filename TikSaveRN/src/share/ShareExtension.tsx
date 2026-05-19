/**
 * Native share extension UI for importing TikTok links into TikSave.
 * Parses shared content and deep-links into the host app import flow.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { View as ShareExtensionView } from 'expo-share-extension';
import * as Linking from 'expo-linking';
import { extractTikTokUrl } from '../utils/tiktokUrl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShareExtensionProps = {
  sharedContent?: any;
  openHostApp?: (path?: string) => void;
  close?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize share payload shapes into a single text blob. */
function getSharedText(sharedContent: any): string {
  if (!sharedContent) return '';
  if (typeof sharedContent === 'string') return sharedContent;
  if (typeof sharedContent.text === 'string') return sharedContent.text;
  if (typeof sharedContent.url === 'string') return sharedContent.url;
  if (Array.isArray(sharedContent)) {
    return sharedContent
      .map((item) => item?.text || item?.url || '')
      .filter(Boolean)
      .join('\n');
  }
  if (Array.isArray(sharedContent.items)) {
    return sharedContent.items
      .map((item: any) => item?.text || item?.url || '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Share sheet entry point shown when the user shares a link to TikSave. */
export default function ShareExtension(props: ShareExtensionProps) {
  const sharedText = useMemo(() => getSharedText(props.sharedContent), [props.sharedContent]);
  const tiktokUrl = useMemo(() => extractTikTokUrl(sharedText), [sharedText]);

  const openInTikSave = () => {
    if (!tiktokUrl) return;
    const path = `create?url=${encodeURIComponent(tiktokUrl)}`;

    if (props.openHostApp) {
      props.openHostApp(path);
      return;
    }

    const deepLink = Linking.createURL(path);
    Linking.openURL(deepLink).catch(() => {
      // Ignore if host app isn't installed yet.
    });
  };

  return (
    <ShareExtensionView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>TikSave</Text>
        {tiktokUrl ? (
          <>
            <Text style={styles.subtitle}>Import this TikTok into your library</Text>
            <Text style={styles.url} numberOfLines={2}>{tiktokUrl}</Text>
            <Pressable style={styles.button} onPress={openInTikSave}>
              <Text style={styles.buttonText}>Open in TikSave</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>No TikTok URL found in this share.</Text>
            <Text style={styles.help} numberOfLines={2}>
              Share a TikTok link and choose TikSave again.
            </Text>
          </>
        )}
      </View>
    </ShareExtensionView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    gap: 10,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
  },
  url: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
  },
  help: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '600',
  },
});
