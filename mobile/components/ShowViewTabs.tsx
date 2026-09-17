import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/constants/theme";
import {
  FAVORITE_SHOW_VIEWS,
  type FavoriteShowView,
} from "@/lib/favorite-show-views";

export function ShowViewTabs({
  selected,
  onSelect,
}: {
  selected: FavoriteShowView;
  onSelect: (view: FavoriteShowView) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Show time range"
      style={styles.frame}
    >
      {FAVORITE_SHOW_VIEWS.map((item) => {
        const active = selected === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${item.label} shows`}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.activeTab,
              pressed && styles.pressedTab,
            ]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: 48,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: colors.accent,
  },
  pressedTab: {
    opacity: 0.78,
  },
  label: {
    color: colors.mute,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  activeLabel: {
    color: colors.onAccent,
  },
});
