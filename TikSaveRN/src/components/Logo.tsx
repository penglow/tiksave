/**
 * TikSave brand SVG assets: LogoMark (monogram) and LogoBadge (rounded square with entrance animation).
 * Path data sourced from /logos/icon.svg; tint follows theme or explicit color props.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import { Animation } from '../config';

// --- Constants (SVG paths) ---
const ICON_OUTER_PATH =
  'M315.376831,676.488037 C306.700287,659.213318 305.482086,641.054382 306.245819,622.566040 ' +
  'C306.383270,619.239563 306.714294,615.915344 306.715057,612.589966 ' +
  'C306.730011,546.430481 306.813538,480.270691 306.591766,414.111908 ' +
  'C306.555542,403.301483 305.546722,392.469147 305.974884,381.652557 ' +
  'C307.233246,349.861877 319.847015,324.383820 348.045990,307.981628 ' +
  'C359.079987,301.563568 371.188873,298.766724 383.927185,298.762054 ' +
  'C447.753662,298.738647 511.580139,298.727051 575.406616,298.734253 ' +
  'C608.909485,298.738037 638.132996,319.626648 649.536560,351.350891 ' +
  'C653.423035,362.162903 655.195190,373.237823 655.180359,384.641113 ' +
  'C655.102966,443.967834 655.216553,503.296234 654.762146,562.620239 ' +
  'C654.571960,587.445007 654.984009,612.268372 654.706177,637.077393 ' +
  'C654.321411,671.425903 639.114807,697.482239 607.951965,713.186951 ' +
  'C597.693176,718.356934 586.535461,720.276489 575.037292,720.271240 ' +
  'C511.877380,720.242310 448.716736,720.426575 385.557831,720.173950 ' +
  'C353.580292,720.046021 330.539795,704.745361 315.376831,676.488037 ' +
  'M420.500122,364.307434 C414.500977,364.307220 408.499725,364.206879 402.503326,364.335205 ' +
  'C396.640900,364.460663 390.906921,365.289062 385.610077,368.120117 ' +
  'C368.708923,377.153473 360.314209,391.637573 360.239716,410.384888 ' +
  'C359.972107,477.708801 360.336517,545.035339 360.023712,612.358826 ' +
  'C359.921661,634.323059 380.470581,649.578247 401.871521,637.067078 ' +
  'C423.861328,624.211609 446.748535,612.900024 469.047516,600.559570 ' +
  'C476.222076,596.589172 482.423523,596.577515 489.650665,600.579834 ' +
  'C512.819641,613.410583 536.274536,625.724609 559.600586,638.272400 ' +
  'C565.392212,641.387817 571.432312,642.655396 577.914978,641.128174 ' +
  'C590.643677,638.129578 598.817627,626.814453 598.830505,611.901062 ' +
  'C598.872437,563.240417 598.848145,514.579773 598.850037,465.919098 ' +
  'C598.850769,447.254730 598.922974,428.590057 598.837402,409.926086 ' +
  'C598.737000,388.016113 582.067505,363.578003 552.980164,364.102173 ' +
  'C509.166504,364.891693 465.328033,364.307587 420.500122,364.307434 z';

const ICON_HOOK_PATH =
  'M719.283691,481.000061 C719.281799,536.477478 719.318481,591.454956 719.263306,646.432312 ' +
  'C719.229614,680.061523 694.813293,710.943298 662.310181,718.603210 ' +
  'C652.864014,720.829346 643.325623,720.428284 633.814209,719.957336 ' +
  'C633.419495,717.258667 635.144958,716.429810 636.237915,715.332947 ' +
  'C658.766968,692.723755 669.805786,665.613342 669.724243,633.565063 ' +
  'C669.510132,549.433594 669.443726,465.299713 669.876709,381.169678 ' +
  'C670.033875,350.631073 658.893799,325.486237 637.607178,304.267822 ' +
  'C636.341370,303.006134 634.641052,302.059784 634.041199,299.025604 ' +
  'C641.557251,298.648956 648.931335,298.227448 656.237854,299.155212 ' +
  'C690.326172,303.483490 716.079407,330.285889 719.354431,364.629761 ' +
  'C720.876465,380.591248 719.794434,396.553558 719.489014,412.530518 ' +
  'C719.055969,435.180054 719.318359,457.842896 719.283691,481.000061 z';

const ICON_PLAY_PATH =
  'M479.038269,448.927032 C493.004578,458.341705 506.673950,467.554169 520.346985,476.761200 ' +
  'C528.268066,482.095001 528.356750,491.558929 520.355591,496.907745 ' +
  'C500.838318,509.955261 481.287140,522.953186 461.664337,535.841187 ' +
  'C451.743622,542.356995 442.309143,537.533386 441.904785,525.639832 ' +
  'C441.022278,499.680878 441.182129,473.709778 441.860931,447.749054 ' +
  'C442.172150,435.846497 451.625549,431.073212 461.602295,437.513245 ' +
  'C467.337860,441.215546 473.030792,444.983917 479.038269,448.927032 z';

// --- Types / props ---
interface LogoMarkProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * Square brand monogram — the "video card with play" shape.
 * Use anywhere a square avatar-style logo is needed.
 */
export function LogoMark({ size = 48, color, style }: LogoMarkProps) {
  const { colors } = useTheme();
  const fill = color ?? colors.text;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="280 280 460 460">
        <G>
          <Path d={ICON_OUTER_PATH} fill={fill} />
          <Path d={ICON_HOOK_PATH} fill={fill} />
          <Path d={ICON_PLAY_PATH} fill={fill} />
        </G>
      </Svg>
    </View>
  );
}

interface LogoBadgeProps {
  size?: number;
  background?: string;
  foreground?: string;
  radius?: number;
  style?: ViewStyle;
  glow?: boolean;
  /**
   * Mount-time entrance. `none` is silent; `stamp` is an oversize-and-settle
   * with a quick rotational flick — feels like a wax seal landing.
   * `bounce` is a softer pop. Defaults to `none` so existing call sites
   * don't unexpectedly animate.
   */
  entrance?: 'none' | 'stamp' | 'bounce';
  /** Delay (ms) before the entrance animation begins. */
  entranceDelay?: number;
}

export function LogoBadge({
  size = 80,
  background,
  foreground,
  radius,
  style,
  glow = false,
  entrance = 'none',
  entranceDelay = 0,
}: LogoBadgeProps) {
  const { colors } = useTheme();
  const bg = background ?? colors.text;
  const fg = foreground ?? colors.background;
  const r = radius ?? Math.round(size * 0.28);

  const scale = useSharedValue(entrance === 'none' ? 1 : 0.4);
  const rotation = useSharedValue(entrance === 'stamp' ? -14 : 0);
  const opacity = useSharedValue(entrance === 'none' ? 1 : 0);

  useEffect(() => {
    if (entrance === 'none') return;

    opacity.value = withDelay(entranceDelay, withTiming(1, { duration: 120 }));

    if (entrance === 'stamp') {
      // Oversize → snap into place, with a small rotational kick that settles.
      scale.value = withDelay(
        entranceDelay,
        withSequence(
          withTiming(1.18, { duration: 180 }),
          withSpring(1, Animation.spring.bouncy),
        ),
      );
      rotation.value = withDelay(
        entranceDelay,
        withSpring(0, { damping: 11, stiffness: 320, mass: 0.9 }),
      );
    } else {
      // bounce
      scale.value = withDelay(entranceDelay, withSpring(1, Animation.spring.bouncy));
    }
  }, [entrance, entranceDelay, scale, rotation, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: bg,
        },
        glow && {
          shadowColor: bg,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 28,
          elevation: 12,
        },
        animatedStyle,
        style,
      ]}
    >
      <LogoMark size={Math.round(size * 0.6)} color={fg} />
    </Animated.View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
