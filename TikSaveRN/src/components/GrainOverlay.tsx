/**
 * Full-bleed film-grain texture overlay (SVG turbulence on iOS/web; omitted on Android).
 * Purely decorative — pointerEvents none unless `interactive` is set.
 */

import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect } from 'react-native-svg';

interface GrainOverlayProps {
  opacity?: number;
  baseFrequency?: number;
  style?: ViewStyle;
  /** When true, intercept touches; defaults to false so the overlay is purely decorative. */
  interactive?: boolean;
}

// --- Main component ---
export function GrainOverlay({
  opacity = 0.06,
  baseFrequency = 0.85,
  style,
  interactive = false,
}: GrainOverlayProps) {
  // SVG filters render reliably on web and iOS via react-native-svg.
  // On Android we degrade gracefully to a translucent dot pattern via box-shadow.
  const grain = useMemo(() => {
    if (Platform.OS === 'android') {
      return null;
    }
    return (
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <Filter id="grain" x="0" y="0" width="100%" height="100%">
            <FeTurbulence
              type="fractalNoise"
              baseFrequency={baseFrequency}
              numOctaves={2}
              seed={4}
              stitchTiles="stitch"
            />
            <FeColorMatrix
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0.6 0"
            />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter="url(#grain)" opacity={opacity} />
      </Svg>
    );
  }, [opacity, baseFrequency]);

  return (
    <View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFillObject, style]}
    >
      {grain}
    </View>
  );
}
