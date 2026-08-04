import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StoreProvider } from '../src/store/store';
import { TripProvider } from '../src/store/trip';
import { AuthProvider } from '../src/store/auth';
import { AuthGate } from '../src/ui/AuthGate';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { colors } from '../src/ui/theme';

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <StoreProvider>
      <TripProvider>
        <StatusBar style="light" />
        <AuthGate />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '800' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="walkthrough" options={{ headerShown: false }} />
          <Stack.Screen name="brief" options={{ title: 'Trip Brief' }} />
          <Stack.Screen name="add-cost" options={{ title: 'Add Cost', presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Document' }} />
          <Stack.Screen name="driver-brief" options={{ title: 'Driver Brief' }} />
          <Stack.Screen name="enroute" options={{ title: 'En-Route Watch' }} />
          <Stack.Screen name="truck/[id]" options={{ title: 'Truck' }} />
          <Stack.Screen name="driver/[id]" options={{ title: 'Driver' }} />
        </Stack>
      </TripProvider>
    </StoreProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
