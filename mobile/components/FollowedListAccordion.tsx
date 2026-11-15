import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Body } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import type { FavoriteShowKind } from "@/lib/favorite-show-views";
import type { FollowedItem, FollowedItemType } from "@/lib/follows";

export function FollowedListAccordion({
  kind,
  items,
  itemType,
  selectedKey = null,
  onSelect,
  isPending,
  itemError,
  onRemove,
  empty,
}: {
  kind: FavoriteShowKind;
  items: readonly FollowedItem[];
  itemType: FollowedItemType;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  isPending: (itemType: FollowedItemType, itemKey: string) => boolean;
  itemError: (itemType: FollowedItemType, itemKey: string) => string | null;
  onRemove: (item: FollowedItem) => void;
  empty?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const plural = kind === "artist" ? "artists" : "venues";
  const title = `Your ${plural} (${items.length})`;
  const allLabel = kind === "artist" ? "All artists" : "All venues";
  const selected = items.find((item) => item.item_key === selectedKey) ?? null;

  function choose(key: string | null) {
    onSelect?.(key);
    setExpanded(false);
  }

  return (
    <View style={styles.frame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selected ? `${title}, filtered to ${selected.item_label}` : title
        }
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text accessible={false} importantForAccessibility="no" style={styles.chevron}>
              {expanded ? "⌄" : "›"}
            </Text>
          </View>
          {selected ? (
            <Text style={styles.headerFilter} numberOfLines={1}>
              {selected.item_label}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {expanded ? (
        <View>
          {onSelect ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={allLabel}
              accessibilityState={{ selected: selected === null }}
              onPress={() => choose(null)}
              style={({ pressed }) => [
                styles.allRow,
                selected === null && styles.rowSelected,
                pressed && styles.headerPressed,
              ]}
            >
              <Text style={[styles.name, selected === null && styles.nameSelected]}>
                {allLabel}
              </Text>
            </Pressable>
          ) : null}
          {items.length === 0 && empty ? (
            <View style={styles.empty}>
              <Body>{empty}</Body>
            </View>
          ) : null}
          {items.map((item) => (
            <FollowedAccordionRow
              key={item.item_key}
              item={item}
              selected={selectedKey === item.item_key}
              busy={isPending(itemType, item.item_key)}
              error={itemError(itemType, item.item_key)}
              onSelect={onSelect ? () => choose(item.item_key) : undefined}
              onRemove={() => onRemove(item)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FollowedAccordionRow({
  item,
  selected,
  busy,
  error,
  onSelect,
  onRemove,
}: {
  item: FollowedItem;
  selected: boolean;
  busy: boolean;
  error: string | null;
  onSelect?: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={[styles.item, selected && styles.rowSelected]}>
      <View style={styles.itemRow}>
        {onSelect ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selected
                ? `Showing upcoming shows for ${item.item_label}`
                : `Show upcoming shows for ${item.item_label}`
            }
            accessibilityState={{ selected }}
            onPress={onSelect}
            style={({ pressed }) => [styles.nameButton, pressed && styles.headerPressed]}
          >
            <Text
              numberOfLines={1}
              style={[styles.name, selected && styles.nameSelected]}
            >
              {item.item_label}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.nameButton}>
            <Text numberOfLines={1} style={styles.name}>
              {item.item_label}
            </Text>
          </View>
        )}
        {confirming ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.item_label}`}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            hitSlop={8}
            onPress={() => setConfirming(true)}
            style={[styles.removeButton, busy && styles.busy]}
          >
            <Text style={styles.removeLabel}>Remove</Text>
          </Pressable>
        )}
      </View>
      {confirming ? (
        <View style={styles.confirmBlock}>
          <Body style={styles.confirmPrompt}>Remove this follow?</Body>
          <View style={styles.confirm}>
            <Button
              label="Remove"
              variant="danger"
              busy={busy}
              disabled={busy}
              accessibilityLabel={`Confirm remove ${item.item_label}`}
              onPress={() => {
                setConfirming(false);
                onRemove();
              }}
            />
            <Button
              label="Keep"
              variant="secondary"
              disabled={busy}
              accessibilityLabel={`Keep ${item.item_label}`}
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : null}
      {error ? <Body style={styles.error}>{error}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  header: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerPressed: {
    backgroundColor: colors.panelHover,
  },
  headerCopy: {
    gap: 2,
  },
  titleRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  headerFilter: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chevron: {
    width: 28,
    textAlign: "center",
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
  },
  allRow: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    justifyContent: "center",
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 4,
  },
  rowSelected: {
    backgroundColor: colors.panelHover,
  },
  itemRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nameButton: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  name: {
    color: colors.foreground,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  nameSelected: {
    color: colors.accent,
    fontFamily: fonts.semibold,
  },
  removeButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  removeLabel: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  busy: {
    opacity: 0.55,
  },
  confirmBlock: {
    gap: 8,
    paddingBottom: 8,
  },
  confirmPrompt: {
    fontSize: 13,
    lineHeight: 18,
  },
  confirm: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    paddingBottom: 6,
  },
  empty: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
