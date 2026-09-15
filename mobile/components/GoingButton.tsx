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
      label={going ? "✓ Going" : "I'm Going"}
      variant={going ? "secondary" : "action"}
      disabled={pending}
      accessibilityLabel={
        going ? `${name} marked as going` : `Mark ${name} as I'm Going`
      }
      onPress={onPress}
    />
  );
}
