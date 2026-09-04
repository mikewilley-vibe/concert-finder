import { SymbolView, type AndroidSymbol } from "expo-symbols";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
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
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.display },
        headerShadowVisible: false,
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
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="bookmark" android="bookmark" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="person" android="person" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
