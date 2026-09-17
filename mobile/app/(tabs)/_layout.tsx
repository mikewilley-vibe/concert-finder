import { SymbolView, type AndroidSymbol } from "expo-symbols";
import { router, Tabs } from "expo-router";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  type ColorValue,
} from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { colors, fonts } from "@/constants/theme";

function TabIcon({
  ios,
  android,
  color,
}: {
  ios: SFSymbol;
  android: AndroidSymbol;
  color: ColorValue;
}) {
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      tintColor={color}
      size={26}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          Keyboard.dismiss();
        },
      }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.display },
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mute,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.line,
        },
        sceneStyle: { backgroundColor: colors.background },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile and settings"
            hitSlop={8}
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [
              styles.settings,
              pressed && styles.settingsPressed,
            ]}
          >
            <TabIcon
              ios="gearshape"
              android="settings"
              color={colors.foreground}
            />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="house" android="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="artists"
        options={{
          title: "Artists",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="music.note" android="person" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="venues"
        options={{
          title: "Venues",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="building.2" android="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="magnifyingglass" android="search" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "My Shows",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="bookmark" android="bookmark" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: null,
          headerRight: () => null,
          tabBarIcon: ({ color }) => (
            <TabIcon ios="person" android="person" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settings: {
    width: 44,
    height: 44,
    marginRight: 8,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsPressed: {
    backgroundColor: colors.panelHover,
  },
});
