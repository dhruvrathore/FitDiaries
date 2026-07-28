import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={[{ padding: spacing(4), gap: spacing(4) }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing(24) }}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing(3),
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed && { opacity: 0.7 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontSize: font.h1, fontWeight: '800', color: colors.text }, style]}>
      {children}
    </Text>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontSize: font.h2, fontWeight: '700', color: colors.text }, style]}>
      {children}
    </Text>
  );
}

export function H3({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontSize: font.h3, fontWeight: '700', color: colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontSize: font.body, color: muted ? colors.textMuted : colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Caption({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontSize: font.small, color: colors.textMuted }, style]}>{children}</Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.cardAlt
          : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? colors.primaryText
      : variant === 'ghost'
        ? colors.primary
        : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: small ? spacing(2.5) : spacing(3.5),
          paddingHorizontal: spacing(4),
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? font.small : font.body }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: spacing(1.5),
          paddingHorizontal: spacing(3),
          borderRadius: radius.pill,
          backgroundColor: selected ? accent : colors.cardAlt,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: selected ? accent : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? '#fff' : colors.text,
          fontWeight: '600',
          fontSize: font.small,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: spacing(2),
        borderRadius: radius.sm,
        backgroundColor: color + '22',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color, fontWeight: '700', fontSize: font.tiny }}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  emoji,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing(12), gap: spacing(2) }}>
      {emoji ? <Text style={{ fontSize: 40 }}>{emoji}</Text> : null}
      <H3>{title}</H3>
      {subtitle ? (
        <Body muted style={{ textAlign: 'center', maxWidth: 280 }}>
          {subtitle}
        </Body>
      ) : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }, style]}>
      {children}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}
