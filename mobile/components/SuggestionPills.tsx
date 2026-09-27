import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/constants/theme";
import type { SuggestionPill } from "@/lib/suggestions";

const UNDO_MS = 5000;

export function SuggestionPills({
  label,
  pills,
  followedIds,
  onFollow,
  onUnfollow,
  onDismiss,
  initialCount,
}: {
  label: string;
  pills: SuggestionPill[];
  followedIds: Set<string>;
  onFollow: (pill: SuggestionPill) => Promise<boolean>;
  onUnfollow: (pill: SuggestionPill) => Promise<boolean>;
  onDismiss: (pill: SuggestionPill) => Promise<boolean>;
  initialCount?: number;
}) {
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const [undo, setUndo] = useState<SuggestionPill | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!undo) {
      return;
    }
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const visible = pills.filter((pill) => !hidden[pill.id] && !followedIds.has(pill.id));
  const shown =
    initialCount && !expanded ? visible.slice(0, initialCount) : visible;
  const hasMore = Boolean(initialCount) && !expanded && visible.length > shown.length;
  if (visible.length === 0 && !undo) {
    return null;
  }

  async function follow(pill: SuggestionPill) {
    const ok = await onFollow(pill);
    if (!ok) {
      return;
    }
    setHidden((current) => ({ ...current, [pill.id]: true }));
    setUndo(pill);
    AccessibilityInfo.announceForAccessibility(
      `Following ${pill.name}. Undo is available.`,
    );
  }

  async function undoFollow() {
    if (!undo) {
      return;
    }
    const pill = undo;
    setUndo(null);
    const ok = await onUnfollow(pill);
    if (!ok) {
      return;
    }
    setHidden((current) => {
      const next = { ...current };
      delete next[pill.id];
      return next;
    });
  }

  async function dismiss(pill: SuggestionPill) {
    setHidden((current) => ({ ...current, [pill.id]: true }));
    const ok = await onDismiss(pill);
    if (ok) {
      AccessibilityInfo.announceForAccessibility(`Hid ${pill.name}.`);
      return;
    }
    setHidden((current) => {
      const next = { ...current };
      delete next[pill.id];
      return next;
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{label}</Text>
      <View style={styles.pills}>
        {shown.map((pill) => (
          <View key={pill.id} style={styles.pill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Follow ${pill.name}. ${pill.reason}`}
              onPress={() => {
                void follow(pill);
              }}
              style={({ pressed }) => [styles.main, pressed && styles.pressed]}
            >
              <Text style={styles.name} numberOfLines={2}>
                {pill.name}
              </Text>
              <Text style={styles.reason} numberOfLines={2}>
                {pill.reason}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${pill.name}`}
              hitSlop={8}
              onPress={() => {
                void dismiss(pill);
              }}
              style={styles.dismiss}
            >
              <Text style={styles.dismissLabel}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More suggestions"
          onPress={() => setExpanded(true)}
          style={styles.more}
        >
          <Text style={styles.moreLabel}>More</Text>
        </Pressable>
      ) : null}
      {undo ? (
        <View style={styles.undoRow}>
          <Text style={styles.undoText}>Following {undo.name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Undo following ${undo.name}`}
            onPress={() => {
              void undoFollow();
            }}
          >
            <Text style={styles.undoAction}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  heading: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#667637",
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 2,
  },
  pressed: {
    backgroundColor: "#252b1e",
  },
  name: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
  },
  reason: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  dismiss: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissLabel: {
    color: colors.mute,
    fontSize: 20,
    lineHeight: 22,
  },
  more: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  moreLabel: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  undoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  undoText: {
    flex: 1,
    color: colors.foreground,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  undoAction: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
