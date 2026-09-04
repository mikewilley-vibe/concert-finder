import { Text, type TextProps } from "react-native";

import { colors, fonts } from "@/constants/theme";

export function Eyebrow({ children, style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: colors.accent,
          fontFamily: fonts.medium,
          fontSize: 12,
          letterSpacing: 1.6,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Title({ children, style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: colors.foreground,
          fontFamily: fonts.display,
          fontSize: 28,
          lineHeight: 34,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: colors.mute,
          fontFamily: fonts.body,
          fontSize: 16,
          lineHeight: 24,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Strong({ children, style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: colors.foreground,
          fontFamily: fonts.semibold,
          fontSize: 16,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
