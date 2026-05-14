import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing, BorderRadius, Typography, Gradients } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, GradientButton } from '../components';

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signUp, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async () => {
    if (isSignUp) {
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  const isValid = email.length > 0 && password.length > 5;

  const gradientColors = isDark
    ? ['#0c0c0e', '#141416', '#1a1a1e'] as const
    : ['#f7f6f3', '#ffffff', '#f0eeea'] as const;

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <Animated.View entering={FadeIn.duration(500)} style={styles.logoSection}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="play" size={28} color="#ffffff" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>TikSave</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Organize your TikTok saves with AI
            </Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Email</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textQuaternary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Password</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textQuaternary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                />
                <AnimatedPressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
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
              <View style={[styles.errorBanner, { backgroundColor: colors.errorSubtle, borderColor: colors.errorSubtle }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <GradientButton
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
              size="lg"
              style={!isValid ? { opacity: 0.5 } : undefined}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </GradientButton>

            <AnimatedPressable style={styles.toggleButton} onPress={toggleMode}>
              <Text style={[styles.toggleButtonText, { color: colors.textSecondary }]}>
                {isSignUp
                  ? "Already have an account? "
                  : "Don't have an account? "}
                <Text style={{ color: colors.accent, fontWeight: '700' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </AnimatedPressable>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textQuaternary }]}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

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
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.displayMd,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  formSection: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    ...Typography.captionStrong,
    marginLeft: Spacing.xs,
    textTransform: 'none',
    letterSpacing: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
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
  },
  toggleButtonText: {
    ...Typography.body,
  },
  footer: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    ...Typography.caption,
    textAlign: 'center',
  },
});
