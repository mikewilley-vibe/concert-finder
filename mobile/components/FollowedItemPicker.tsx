import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, fonts } from "@/constants/theme";
import type { FavoriteShowKind } from "@/lib/favorite-show-views";
import type { FollowedItem } from "@/lib/follows";

export function FollowedItemPicker({
  kind,
  items,
  selectedKey,
  onSelect,
}: {
  kind: FavoriteShowKind;
  items: readonly FollowedItem[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const noun = kind === "artist" ? "artist" : "venue";
  const selected = items.find((item) => item.item_key === selectedKey);
  const allLabel = kind === "artist" ? "All artists" : "All venues";

  function choose(key: string | null) {
    onSelect(key);
    setOpen(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>See upcoming shows for one {noun}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose a ${noun}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerText}>{selected?.item_label ?? allLabel}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                Choose a {noun}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close chooser"
                onPress={() => setOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.options}>
              <PickerOption
                label={allLabel}
                selected={!selectedKey}
                onPress={() => choose(null)}
              />
              {items.map((item) => (
                <PickerOption
                  key={item.item_key}
                  label={item.item_label}
                  selected={selectedKey === item.item_key}
                  onPress={() => choose(item.item_key)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PickerOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.selectedOption,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionText, selected && styles.selectedOptionText]}>
        {label}
      </Text>
      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.mute,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  trigger: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 16,
    flex: 1,
  },
  chevron: {
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 20,
    marginLeft: 12,
  },
  pressed: {
    opacity: 0.75,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  sheet: {
    maxHeight: "80%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: colors.foreground,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  options: {
    padding: 12,
    gap: 8,
  },
  option: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedOption: {
    backgroundColor: colors.panelHover,
  },
  optionText: {
    color: colors.foreground,
    fontFamily: fonts.medium,
    fontSize: 16,
    flex: 1,
  },
  selectedOptionText: {
    fontFamily: fonts.semibold,
  },
  checkmark: {
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: 20,
    marginLeft: 12,
  },
});
