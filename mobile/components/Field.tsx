import { useState, type ReactNode, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { colors, fonts } from "@/constants/theme";
import { Body } from "./Typography";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  inputRef?: RefObject<TextInput | null>;
  accessory?: ReactNode;
} & Pick<
  TextInputProps,
  | "placeholder"
  | "autoComplete"
  | "keyboardType"
  | "secureTextEntry"
  | "autoCapitalize"
  | "textContentType"
  | "returnKeyType"
  | "onSubmitEditing"
  | "maxLength"
>;

export function Field({
  label,
  value,
  onChangeText,
  inputRef,
  accessory,
  ...rest
}: FieldProps) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  const input = (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={colors.mute}
      accessibilityLabel={label}
      nativeID={id}
      autoCorrect={false}
      style={[styles.input, accessory ? styles.inputWithToggle : null]}
      {...rest}
    />
  );

  return (
    <View style={styles.field}>
      <Body>{label}</Body>
      {accessory ? (
        <View style={styles.inputRow}>
          {input}
          {accessory}
        </View>
      ) : (
        input
      )}
    </View>
  );
}

type PasswordFieldProps = Omit<FieldProps, "secureTextEntry" | "accessory">;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...props}
      secureTextEntry={!visible}
      accessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          accessibilityState={{ selected: visible }}
          hitSlop={8}
          onPress={() => {
            setVisible((current) => !current);
          }}
          style={({ pressed }) => [
            styles.toggle,
            pressed && styles.togglePressed,
          ]}
        >
          <Text style={styles.toggleLabel}>{visible ? "Hide" : "Show"}</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    paddingRight: 4,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  inputWithToggle: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingRight: 8,
  },
  toggle: {
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  togglePressed: {
    opacity: 0.7,
  },
  toggleLabel: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
