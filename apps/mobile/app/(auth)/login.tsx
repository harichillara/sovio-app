import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TextInput, Button, SocialAuthButton, LoadingOverlay } from '@sovio/ui';
import { useSignIn, useSignInWithGoogle, useSignInWithApple } from '@sovio/core';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signInMutation = useSignIn();
  const googleMutation = useSignInWithGoogle();
  const appleMutation = useSignInWithApple();

  const isLoading = signInMutation.isPending || googleMutation.isPending || appleMutation.isPending;
  const error = signInMutation.error?.message || googleMutation.error?.message || appleMutation.error?.message;

  const handleSignIn = () => {
    if (!email || !password) return;
    signInMutation.mutate({ email, password });
  };

  const handleGoogleSignIn = async () => {
    try {
      // In production, use Google OAuth flow and pass idToken
      // For now, this is a placeholder that will be wired to expo-auth-session
      console.log('Google sign-in flow');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(36)
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        appleMutation.mutate({ identityToken: credential.identityToken, nonce });
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
