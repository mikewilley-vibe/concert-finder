import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";

export function FollowToggleButton({
  name,
  followed,
  busy,
  onToggle,
}: {
  name: string;
  followed: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmFollowed, setConfirmFollowed] = useState(followed);
  if (followed !== confirmFollowed) {
    setConfirmFollowed(followed);
    if (!followed) {
      setConfirming(false);
    }
  }

  if (followed && confirming) {
    return (
      <View style={styles.confirm}>
        <Button
          label="Remove"
          variant="danger"
          busy={busy}
          disabled={busy}
          accessibilityLabel={`Confirm remove ${name}`}
          onPress={() => {
            setConfirming(false);
            onToggle();
          }}
        />
        <Button
          label="Keep"
          variant="secondary"
          disabled={busy}
          accessibilityLabel={`Keep following ${name}`}
          onPress={() => setConfirming(false)}
        />
      </View>
    );
  }

  return (
    <Button
      label={followed ? "Following" : "Follow"}
      variant={followed ? "secondary" : "action"}
      busy={busy}
      accessibilityLabel={followed ? `Unfollow ${name}` : `Follow ${name}`}
      onPress={() => {
        if (followed) {
          setConfirming(true);
          return;
        }
        onToggle();
      }}
    />
  );
}

const styles = StyleSheet.create({
  confirm: {
    gap: 8,
    alignItems: "flex-end",
  },
});
