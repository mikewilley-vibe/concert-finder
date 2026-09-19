import { Button } from "./Button";

export function GoingButton({
  going,
  pending,
  name,
  onPress,
}: {
  going: boolean;
  pending: boolean;
  name: string;
  onPress: () => void;
}) {
  return (
    <Button
      label={going ? "✓ Locked" : "Lock me in"}
      variant={going ? "secondary" : "action"}
      disabled={pending}
      accessibilityLabel={
        going ? `${name} is locked` : `Lock in ${name}`
      }
      onPress={onPress}
    />
  );
}
