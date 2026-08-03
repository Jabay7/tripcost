import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StoreProvider } from '../src/store/store';
import { TripProvider } from '../src/store/trip';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { colors } from '../src/ui/theme';

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <StoreProvider>
      <TripProvider>
        <StatusBar style="light" />
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
          <Stack.Screen name="brief" options={{ title: 'Trip Brief' }} />
          <Stack.Screen name="add-cost" options={{ title: 'Add Cost', presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Document' }} />
          <Stack.Screen name="driver-brief" options={{ title: 'Driver Brief' }} />
          <Stack.Screen name="truck/[id]" options={{ title: 'Truck' }} />
          <Stack.Screen name="driver/[id]" options={{ title: 'Driver' }} />
        </Stack>
      </TripProvider>
    </StoreProvider>
    </ErrorBoundary>
  );
}
