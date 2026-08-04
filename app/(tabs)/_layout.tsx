import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/store/auth';
import { colors, space, type } from '../../src/ui/theme';

/**
 * Sits above the tab bar whenever the data on screen is invented.
 *
 * A demo that looks like production is how someone ends up pricing a real load
 * off sample numbers. This is deliberately persistent and slightly loud — it
 * cannot be dismissed, only left.
 */
function DemoBanner() {
  const { mode, exitDemo } = useAuth();
  if (mode !== 'demo') return null;

  return (
    <View style={s.banner}>
      <Text style={s.bannerText}>
        DEMO — sample carrier, invented numbers. Nothing here is your data.
      </Text>
      <Pressable
        onPress={() => {
          exitDemo();
          router.replace('/welcome');
        }}
        accessibilityRole="button"
        style={s.exit}
      >
        <Text style={s.exitText}>Exit</Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <>
    <DemoBanner />
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plan Trip',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: 'Fleet',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trucks"
        options={{
          title: 'Trucks',
          tabBarIcon: ({ color, size }) => <Ionicons name="bus" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="drivers"
        options={{
          title: 'Drivers',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Ledger',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
    </Tabs>
    </>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.amberDim,
    borderBottomWidth: 1,
    borderBottomColor: colors.amber,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  bannerText: { ...type.small, color: colors.amber, flex: 1, lineHeight: 17, fontWeight: '600' },
  exit: { minHeight: 32, justifyContent: 'center', paddingHorizontal: space.sm },
  exitText: { ...type.small, color: colors.amber, fontWeight: '800' },
});
