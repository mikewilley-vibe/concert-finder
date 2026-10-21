import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { ListRow } from "@/components/ListRow";
import { ScreenBlock } from "@/components/Screen";
import { Body, Strong } from "@/components/Typography";
import { colors } from "@/constants/theme";
import type { FollowedItem, FollowedItemType } from "@/lib/follows";

export function FollowedRoster({
  title,
  empty,
  items,
  itemType,
  isPending,
  itemError,
  onRemove,
}: {
  title: string;
  empty: string;
  items: readonly FollowedItem[];
  itemType: FollowedItemType;
  isPending: (itemType: FollowedItemType, itemKey: string) => boolean;
  itemError: (itemType: FollowedItemType, itemKey: string) => string | null;
  onRemove: (item: FollowedItem) => void;
}) {
  return (
    <ScreenBlock>
      <Strong>{title}</Strong>
      {items.length === 0 ? <Body>{empty}</Body> : null}
      {items.map((item) => (
        <FollowedRosterRow
          key={item.item_key}
          item={item}
          busy={isPending(itemType, item.item_key)}
          error={itemError(itemType, item.item_key)}
          onRemove={() => onRemove(item)}
        />
      ))}
    </ScreenBlock>
  );
}

function FollowedRosterRow({
  item,
  busy,
  error,
  onRemove,
}: {
  item: FollowedItem;
  busy: boolean;
  error: string | null;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.row}>
      <ListRow
        title={item.item_label}
        subtitle={confirming ? "Remove this follow?" : undefined}
        accessibilityLabel={item.item_label}
        trailing={
          confirming ? null : (
            <Button
              label="Remove"
              variant="danger"
              busy={busy}
              disabled={busy}
              accessibilityLabel={`Remove ${item.item_label}`}
              onPress={() => setConfirming(true)}
            />
          )
        }
      />
      {confirming ? (
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
      ) : null}
      {error ? <Body style={styles.error}>{error}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 6,
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
  },
});
