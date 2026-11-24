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
  onOpen,
  isPending,
  itemError,
  onRemove,
  empty,
}: {
  kind: FavoriteShowKind;
  items: readonly FollowedItem[];
  itemType: FollowedItemType;
  onOpen: (item: FollowedItem) => void;
  isPending: (itemType: FollowedItemType, itemKey: string) => boolean;
  itemError: (itemType: FollowedItemType, itemKey: string) => string | null;
  onRemove: (item: FollowedItem) => void;
  empty?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const plural = kind === "artist" ? "artists" : "venues";
  const title = `Your ${plural} (${items.length})`;

  return (
    <View style={styles.frame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
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
        </View>
      </Pressable>

      {expanded ? (
        <View>
          {items.length === 0 && empty ? (
            <View style={styles.empty}>
              <Body>{empty}</Body>
            </View>
          ) : null}
          {items.map((item) => (
            <FollowedAccordionRow
              key={item.item_key}
              item={item}
              busy={isPending(itemType, item.item_key)}
              error={itemError(itemType, item.item_key)}
              onOpen={() => onOpen(item)}
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
  busy,
  error,
  onOpen,
  onRemove,
}: {
  item: FollowedItem;
  busy: boolean;
  error: string | null;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.item}>
      <View style={styles.itemRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Upcoming shows for ${item.item_label}`}
          onPress={onOpen}
          style={({ pressed }) => [styles.nameButton, pressed && styles.headerPressed]}
        >
          <Text numberOfLines={1} style={styles.name}>
            {item.item_label}
          </Text>
        </Pressable>
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
  chevron: {
    width: 28,
    textAlign: "center",
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 4,
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
