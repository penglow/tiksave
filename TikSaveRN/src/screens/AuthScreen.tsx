import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from '../components';

export default function AuthScreen() {
  const { colors } = useTheme();
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

  const isValid = email.length > 0 && password.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
          {/* Logo Section */}
          <Animated.View entering={FadeIn.duration(200)} style={styles.logoSection}>
            <View style={[styles.logoIcon, { backgroundColor: colors.text }]}>
              <Ionicons name="play" size={28} color={colors.background} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>TikSave</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Organize your TikTok saves{'\n'}with AI-powered folders
            </Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View entering={FadeIn.duration(200).delay(50)} style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>EMAIL</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textQuaternary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>PASSWORD</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { borderColor: colors.border, color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textQuaternary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <AnimatedPressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
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
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            )}

            <AnimatedPressable
              style={[
                styles.submitButton,
                { backgroundColor: colors.text },
                !isValid && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
              haptic
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={[styles.submitButtonText, { color: colors.background }]}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </AnimatedPressable>

            <AnimatedPressable style={styles.toggleButton} onPress={toggleMode}>
              <Text style={[styles.toggleButtonText, { color: colors.textSecondary }]}>
                {isSignUp
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Sign Up"}
              </Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
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
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
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
    ...Typography.label,
    marginLeft: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    transform: [{ translateY: -9 }],
  },
  errorText: {
    ...Typography.caption,
    textAlign: 'center',
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.3,
  },
  submitButtonText: {
    ...Typography.bodyStrong,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  toggleButtonText: {
    ...Typography.caption,
  },
});
