/**
 * AuthScreen
 *
 * Sign-in and sign-up for unauthenticated users. Shown as the root stack screen from
 * `RootNavigator` when `useAuthStore` reports no session.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing, BorderRadius, Typography } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import {
  AnimatedPressable,
  GradientButton,
  Wordmark,
  GradientMesh,
  GrainOverlay,
  WordReveal,
} from '../components';

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const { signIn, signUp, isLoading, error, clearError } = useAuthStore();

  const isValid = email.length > 0 && password.length > 5;

  const gradientColors = isDark
    ? ['#0a0a0c', '#0c0c0e', '#16100f'] as const
    : ['#fbf9f6', '#f7f6f3', '#fff5f1'] as const;

  const meshBlobs = useMemo(
    () =>
      isDark
        ? [
            { cx: 0.18, cy: 0.12, r: 0.55, color: '#e8705a', opacity: 0.28 },
            { cx: 0.85, cy: 0.85, r: 0.5, color: '#7c5cff', opacity: 0.16 },
            { cx: 0.55, cy: 0.45, r: 0.4, color: '#fbbf24', opacity: 0.08 },
          ]
        : [
            { cx: 0.18, cy: 0.12, r: 0.55, color: '#f28b78', opacity: 0.32 },
            { cx: 0.85, cy: 0.85, r: 0.5, color: '#fbbf24', opacity: 0.18 },
            { cx: 0.55, cy: 0.45, r: 0.4, color: '#d45a44', opacity: 0.10 },
          ],
    [isDark],
  );

  // --- Handlers ---------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (isSignUp) {
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }
  }, [isSignUp, signUp, email, password, signIn]);

  const toggleMode = useCallback(() => {
    setIsSignUp((prev) => !prev);
    clearError();
  }, [clearError]);

  const toggleShowPassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // --- Render -----------------------------------------------------------------

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={styles.container}>
        <GradientMesh blobs={meshBlobs} />
        <GrainOverlay opacity={0.05} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand mark — full wordmark on the gradient mesh */}
            <Animated.View entering={FadeIn.duration(220)} style={styles.brandRow}>
              <Wordmark height={32} color={colors.text} />
            </Animated.View>

            {/* Editorial hero — eyebrow + word-by-word headline + sub */}
            <View style={styles.heroSection}>
              <Animated.Text
                entering={FadeIn.duration(220).delay(80)}
                style={[styles.eyebrow, { color: colors.accent }]}
              >
                {isSignUp ? 'Start your library' : 'Welcome back'}
              </Animated.Text>

              <WordReveal
                segments={[
                  { text: 'The TikToks you saved,', style: styles.headline as TextStyle },
                  {
                    text: 'found.',
                    style: { ...(styles.headline as TextStyle), color: colors.accent, fontStyle: 'italic' },
                  },
                ]}
                style={{ ...(styles.headline as TextStyle), color: colors.text }}
                delay={140}
                stagger={45}
              />

              <Animated.Text
                entering={FadeInUp.duration(260).delay(420)}
                style={[styles.heroSub, { color: colors.textSecondary }]}
              >
                AI quietly tags, transcribes and organizes everything you save —
                so you can search a thought and get the right clip back.
              </Animated.Text>
            </View>

            {/* Form */}
            <Animated.View entering={FadeInUp.duration(550).delay(160)} style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>EMAIL</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      borderColor: emailFocused ? colors.accent : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Ionicons name="mail-outline" size={18} color={emailFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textQuaternary}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>PASSWORD</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      borderColor: passwordFocused ? colors.accent : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.passwordInput, { color: colors.text }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textQuaternary}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                  <AnimatedPressable
                    style={styles.eyeButton}
                    onPress={toggleShowPassword}
                    noScale
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textTertiary}
                    />
                  </AnimatedPressable>
                </View>
              </View>

              {error && (
                <Animated.View
                  entering={FadeIn.duration(220)}
                  style={[
                    styles.errorBanner,
                    { backgroundColor: colors.errorSubtle, borderColor: colors.error },
                  ]}
                >
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                </Animated.View>
              )}

              <GradientButton
                onPress={handleSubmit}
                disabled={!isValid || isLoading}
                size="lg"
                style={!isValid ? { opacity: 0.45 } : undefined}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  isSignUp ? 'Create account' : 'Sign in'
                )}
              </GradientButton>

              <AnimatedPressable style={styles.toggleButton} onPress={toggleMode}>
                <Text style={[styles.toggleButtonText, { color: colors.textSecondary }]}>
                  {isSignUp
                    ? "Already have an account? "
                    : "New to TikSave? "}
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>
                    {isSignUp ? 'Sign in' : 'Create one'}
                  </Text>
                </Text>
              </AnimatedPressable>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeIn.duration(500).delay(280)} style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textQuaternary }]}>
                By continuing you agree to our{' '}
                <Text style={{ textDecorationLine: 'underline' }}>Terms</Text>
                {' '}and{' '}
                <Text style={{ textDecorationLine: 'underline' }}>Privacy Policy</Text>.
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroSection: {
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  eyebrow: {
    ...Typography.label,
    letterSpacing: 1.6,
  },
  headline: {
    ...Typography.displayLg,
    fontSize: 40,
    lineHeight: 44,
  },
  headlineItalic: {
    ...Typography.displayLg,
    fontSize: 40,
    lineHeight: 44,
    fontStyle: 'italic',
  },
  heroSub: {
    ...Typography.body,
    maxWidth: 360,
    opacity: 0.9,
  },
  formSection: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    ...Typography.label,
    marginLeft: Spacing.xs,
    fontSize: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    marginTop: -10,
    padding: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.captionStrong,
    flex: 1,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  toggleButtonText: {
    ...Typography.body,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    textAlign: 'center',
    maxWidth: 320,
  },
});
