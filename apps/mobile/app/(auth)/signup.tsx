import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TextInput, Button, SocialAuthButton, LoadingOverlay } from '@sovio/ui';
import { useSignUp, useSignInWithGoogle, useSignInWithApple } from '@sovio/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export default function SignUpScreen() {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signUpMutation = useSignUp();
  const googleMutation = useSignInWithGoogle();
  const appleMutation = useSignInWithApple();

  const isLoading = signUpMutation.isPending || googleMutation.isPending || appleMutation.isPending;
  const error = signUpMutation.error?.message || googleMutation.error?.message || appleMutation.error?.message;

  const handleSignUp = () => {
    if (!fullName || !email || !password) return;
    signUpMutation.mutate({ email, password, fullName });
  };

  const handleGoogleSignIn = async () => {
    try {
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
        <Text style={{ fontSize: 30, fontWeight: '800', color: theme.text }}>
          Create your account
        </Text>
        <Text style={{ fontSize: 16, color: theme.muted, marginBottom: 8 }}>
          Start making real plans, effortlessly.
        </Text>

        {error ? (
          <Text style={{ color: theme.danger, fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <TextInput
          label="Full Name"
          placeholder="Your name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

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
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button label="Create Account" onPress={handleSignUp} />

        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>or continue with</Text>
        </View>

        <SocialAuthButton provider="google" onPress={handleGoogleSignIn} />
        {Platform.OS === 'ios' ? (
          <SocialAuthButton provider="apple" onPress={handleAppleSignIn} />
        ) : null}

        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.accent, textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 12 }}>
            Already have an account? Sign in
          </Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}
