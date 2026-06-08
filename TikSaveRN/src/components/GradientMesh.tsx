/**
 * Decorative mesh backdrop built from overlapping SVG radial-gradient blobs.
 * Sits behind hero sections for depth without a flat linear gradient.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';

interface MeshBlob {
  /** Center X as a 0–1 fraction of the mesh width. */
  cx: number;
  /** Center Y as a 0–1 fraction of the mesh height. */
  cy: number;
  /** Blob radius as a 0–1 fraction of the larger dimension. */
  r: number;
  color: string;
  opacity?: number;
}

interface GradientMeshProps {
  blobs: MeshBlob[];
  style?: ViewStyle;
}

// --- Main component ---
export function GradientMesh({ blobs, style }: GradientMeshProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
        <Defs>
          {blobs.map((blob, i) => (
            <RadialGradient
              key={`grad-${i}`}
              id={`mesh-${i}`}
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
              fx="50%"
              fy="50%"
            >
              <Stop offset="0%" stopColor={blob.color} stopOpacity={blob.opacity ?? 0.55} />
              <Stop
                offset="60%"
                stopColor={blob.color}
                stopOpacity={(blob.opacity ?? 0.55) * 0.25}
              />
              <Stop offset="100%" stopColor={blob.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="transparent" />
        {blobs.map((blob, i) => (
          <Circle
            key={`blob-${i}`}
            cx={blob.cx * 100}
            cy={blob.cy * 100}
            r={blob.r * 100}
            fill={`url(#mesh-${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}
