import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/store/auth';
import { colors, MAX_CONTENT_WIDTH, space, type } from '../../src/ui/theme';

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

/**
 * A thin strip naming the company you are signed into, and the way out.
 *
 * Small on purpose — it is orientation, not a feature. But it has to exist:
 * without it there is no way to tell which carrier you are looking at, and no
 * way to sign out of a shared cab tablet.
 */
function AccountBar() {
  const { mode, session, signOut } = useAuth();
  if (mode !== 'signed-in' || !session) return null;

  return (
    <View style={s.account}>
      <Text style={s.accountText} numberOfLines={1}>
        {session.companyName}
        <Text style={s.accountRole}>{session.role === 'owner' ? '  ·  Owner' : '  ·  Driver'}</Text>
      </Text>
      <Pressable
        onPress={async () => {
          await signOut();
          router.replace('/welcome');
        }}
        accessibilityRole="button"
        style={s.exit}
      >
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
    <DemoBanner />
    <AccountBar />
    <Tabs
      screenOptions={{
        // The bar names the current screen, so a header underneath it would
        // just repeat "Drivers" twice and eat ~50pt of a phone screen.
        headerShown: false,
        tabBarPosition: 'top',
        tabBarStyle: {
          // Transparent so the surface-coloured band behind it runs the full
          // width of the window while the tabs themselves stay in the same
          // 720pt column as the content. On a desktop browser a full-width bar
          // pushes "Plan Trip" and "Ledger" to opposite edges of a 27-inch
          // monitor, nowhere near the content they belong to.
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderBottomWidth: 0,
          alignSelf: 'center',
          width: '100%',
          maxWidth: MAX_CONTENT_WIDTH,
          height: 58,
          paddingTop: 6,
          paddingBottom: 6,
          elevation: 0,
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

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

  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: 6,
  },
  accountText: { ...type.small, color: colors.text, flex: 1, fontWeight: '700' },
  accountRole: { color: colors.textFaint, fontWeight: '600' },
  signOutText: { ...type.small, color: colors.textDim, fontWeight: '700' },
});
