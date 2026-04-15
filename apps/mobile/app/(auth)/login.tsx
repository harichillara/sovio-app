import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TextInput, Button, SocialAuthButton, LoadingOverlay } from '@sovio/ui';
import {
  authService,
  useSignIn,
  useSignInWithGoogle,
  useSignInWithApple,
} from '@sovio/core';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [oauthError, setOauthError] = useState<string | null>(null);

  const signInMutation = useSignIn();
  const googleMutation = useSignInWithGoogle();
  const appleMutation = useSignInWithApple();

  const isLoading = signInMutation.isPending || googleMutation.isPending || appleMutation.isPending;
  const error =
    signInMutation.error?.message ||
    googleMutation.error?.message ||
    appleMutation.error?.message ||
    oauthError;

  const handleSignIn = () => {
    if (!email || !password) return;
    setOauthError(null);
    signInMutation.mutate({ email, password });
  };

  const handleGoogleSignIn = async () => {
    try {
      setOauthError(null);
      const redirectTo = authService.getGoogleOAuthRedirectUrl();

      const data = await googleMutation.mutateAsync({ redirectTo });

      if (Platform.OS === 'web') {
        // Supabase owns the browser redirect on web so PKCE state is stored
        // in the expected place before navigating away.
        return;
      }

      if (!data?.url) {
        throw new Error('Google sign-in is unavailable right now.');
      }

      // On native, open the browser. The AuthProvider's Linking listener
      // handles the callback — don't also call completeOAuthFromUrl here
      // to avoid a race on the single-use authorization code.
      await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    } catch (e) {
      console.error(e);
      setOauthError(e instanceof Error ? e.message : 'Google sign-in failed.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const rawNonce = Crypto.getRandomBytes(32).reduce((s: string, b: number) => s + b.toString(16).padStart(2, '0'), '')
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (credential.identityToken) {
        appleMutation.mutate({ identityToken: credential.identityToken, nonce: rawNonce });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppScreen>
      {isLoading ? <LoadingOverlay /> : null}
      <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: theme.accent, textAlign: 'center' }}>
          Sovio
        </Text>
        <Text style={{ fontSize: 16, color: theme.muted, textAlign: 'center', marginBottom: 12 }}>
          Plans, without the effort
        </Text>

        {error ? (
          <Text style={{ color: theme.danger, fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <TextInput
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button label="Sign In" onPress={handleSignIn} />

        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>or continue with</Text>
        </View>

        <SocialAuthButton provider="google" onPress={handleGoogleSignIn} />
        {Platform.OS === 'ios' ? (
          <SocialAuthButton provider="apple" onPress={handleAppleSignIn} />
        ) : null}

        <Pressable onPress={() => router.push('/(auth)/signup')}>
          <Text style={{ color: theme.accent, textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 12 }}>
            Don't have an account? Sign up
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 13 }}>
            Forgot password?
          </Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}
