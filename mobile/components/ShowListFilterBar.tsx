import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Body } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import { openLocationSettings } from "@/lib/current-location";
import {
  SHOW_DATE_FILTERS,
  type ShowDateFilter,
} from "@/lib/show-date-filter";

export function ShowListFilterBar({
  dateFilter,
  onDateFilter,
  nearMe,
  onToggleNearMe,
  locating,
  notice,
  denied,
  hint,
  nearLabel,
  distanceNote,
}: {
  dateFilter: ShowDateFilter;
  onDateFilter: (filter: ShowDateFilter) => void;
  nearMe: boolean;
  onToggleNearMe: () => void;
  locating: boolean;
  notice: string | null;
  denied: boolean;
  hint?: string | null;
  nearLabel: string;
  distanceNote?: string | null;
}) {
  return (
    <View style={styles.wrap}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Date filter"
        style={styles.segment}
      >
        {SHOW_DATE_FILTERS.map((item) => {
          const active = dateFilter === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label} shows`}
              onPress={() => onDateFilter(item.id)}
              style={({ pressed }) => [
                styles.segmentTab,
                active && styles.active,
                pressed && styles.pressed,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.label, active && styles.activeLabel]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: nearMe, disabled: locating }}
        accessibilityLabel={
          nearMe ? `Near me, on. ${nearLabel}` : "Near me, off"
        }
        disabled={locating}
        onPress={onToggleNearMe}
        style={({ pressed }) => [
          styles.nearChip,
          nearMe && styles.active,
          pressed && !locating && styles.pressed,
          locating && styles.disabled,
        ]}
      >
        <Text style={[styles.label, nearMe && styles.activeLabel]}>
          {locating ? "Finding you…" : "Near me"}
        </Text>
      </Pressable>
      {nearMe ? <Body>{nearLabel}.</Body> : null}
      {hint ? <Body>{hint}</Body> : null}
      {distanceNote ? <Body>{distanceNote}</Body> : null}
      {notice ? <Body>{notice}</Body> : null}
      {denied ? (
        <Button
          label="Open Settings"
          variant="secondary"
          accessibilityLabel="Open Settings to enable location"
          onPress={openLocationSettings}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  segment: {
    minHeight: 48,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nearChip: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  active: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.mute,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  activeLabel: {
    color: colors.onAccent,
  },
});
