import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";

// ---------------------------------------------------------------- Text
export function AppText({
  children,
  style,
  weight = "regular",
  size = "base",
  color = COLORS.onSurface,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  weight?: "regular" | "medium" | "semibold" | "bold";
  size?: keyof typeof FONT;
  color?: string;
  numberOfLines?: number;
}) {
  const fw: Record<string, TextStyle["fontWeight"]> = {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  };
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontSize: FONT[size], color, fontWeight: fw[weight] }, style]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- Button
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const bg = {
    primary: COLORS.brandPrimary,
    secondary: COLORS.surfaceTertiary,
    ghost: "transparent",
    danger: COLORS.error,
    success: COLORS.success,
  }[variant];

  // Pressed (hover) background — richer, darker shade for each variant
  const pressedBg = {
    primary:   "#7A3F1E",   // deeper brand brown
    secondary: "#E8DDD5",   // warm taupe
    ghost:     "#F7EBE5",   // soft brand tint
    danger:    "#C0392B",   // deeper red
    success:   "#16A34A",   // deeper green
  }[variant];

  const fg = {
    primary: COLORS.onBrandPrimary,
    secondary: COLORS.onSurfaceTertiary,
    ghost: COLORS.brandPrimary,
    danger: COLORS.onError,
    success: COLORS.onSuccess,
  }[variant];
  const isDisabled = disabled || loading;
  const [hovered, setHovered] = React.useState(false);

  // Hover background — subtle, one step lighter/darker than the base color
  const hoverBg = {
    primary:   "#8C4A24",
    secondary: "#EFE6DE",
    ghost:     "#FBF3EF",
    danger:    "#D9463A",
    success:   "#22B457",
  }[variant];

  return (
    <Pressable
      testID={testID}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: isDisabled ? bg : pressed ? pressedBg : hovered ? hoverBg : bg,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          shadowColor: pressed ? "#000" : "#1A1817",
          shadowOpacity: pressed ? 0.18 : hovered ? 0.1 : 0.06,
          shadowRadius: pressed ? 12 : hovered ? 10 : 8,
          shadowOffset: { width: 0, height: pressed ? 4 : 2 },
          elevation: pressed ? 6 : hovered ? 4 : 2,
        },
        variant === "ghost" && { borderWidth: 1, borderColor: pressed || hovered ? COLORS.brandPrimary : COLORS.border },
        style,
      ]}
    >      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Chip
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed
            ? selected ? "#7A3F1E" : "#EDD9CE"
            : selected ? COLORS.brandPrimary : COLORS.brandTertiary,
          borderColor: selected ? COLORS.brandPrimary : COLORS.border,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color: selected ? COLORS.onBrandPrimary : COLORS.onBrandTertiary,
          fontWeight: "600",
          fontSize: FONT.base,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- StatusBadge
export function StatusBadge({ label, color, testID }: { label: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: color + "1A", borderColor: color + "55" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={{ color, fontWeight: "600", fontSize: FONT.sm }}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- ProgressBar
export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
    </View>
  );
}

// ---------------------------------------------------------------- Avatar
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.brandTertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: COLORS.onBrandTertiary, fontWeight: "700", fontSize: size * 0.36 }}>{initials || "?"}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Field
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
  optional,
  multiline,
  maxLength,
  testID,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  error?: string;
  optional?: string;
  multiline?: boolean;
  maxLength?: number;
  testID?: string;
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <View style={{ flexDirection: "row", marginBottom: SPACING.xs }}>
        <AppText weight="semibold" size="base">
          {label}
        </AppText>
        {optional && (
          <AppText size="sm" color={COLORS.muted} style={{ marginLeft: 6, alignSelf: "center" }}>
            ({optional})
          </AppText>
        )}
      </View>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          multiline && { height: 96, textAlignVertical: "top", paddingTop: 12 },
          error && { borderColor: COLORS.error },
        ]}
      />
      {error && (
        <AppText size="sm" color={COLORS.error} style={{ marginTop: 4 }}>
          {error}
        </AppText>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- MetricCard
export function MetricCard({
  label,
  value,
  icon,
  tint = COLORS.brandPrimary,
  testID,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.metricCard, shadow]}>
      <View style={[styles.metricIcon, { backgroundColor: tint + "1A" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- Header
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack && (
        <Pressable
          testID="header-back"
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: pressed ? COLORS.brandTertiary : "transparent",
              transform: [{ scale: pressed ? 0.93 : 1 }],
              borderRadius: RADIUS.md,
            },
          ]}
        >
          {({ pressed }) => (
            <Ionicons name="chevron-back" size={24} color={pressed ? COLORS.brandPrimary : COLORS.onSurface} />
          )}
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <AppText weight="bold" size="2xl">
          {title}
        </AppText>
        {subtitle && (
          <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------- States
export function Loader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.brandPrimary} />
    </View>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  subtitle,
  image,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  image?: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      {image ? (
        <Image source={{ uri: image }} style={styles.emptyImg} contentFit="cover" />
      ) : (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={40} color={COLORS.brandSecondary} />
        </View>
      )}
      <AppText weight="semibold" size="lg" style={{ marginTop: SPACING.lg, textAlign: "center" }}>
        {title}
      </AppText>
      {subtitle && (
        <AppText size="base" color={COLORS.muted} style={{ marginTop: 6, textAlign: "center" }}>
          {subtitle}
        </AppText>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, shadow, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- ChipRow (horizontal scroller)
export function ChipScroller({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}
      style={{ maxHeight: 56 }}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  btnText: { fontSize: FONT.lg, fontWeight: "700" },
  chip: {
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5, backgroundColor: COLORS.brandPrimary },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceSecondary,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    minHeight: 110,
    justifyContent: "space-between",
  },
  metricIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 28, fontWeight: "800", color: COLORS.onSurface, marginTop: SPACING.sm },
  metricLabel: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  emptyWrap: { alignItems: "center", justifyContent: "center", padding: SPACING["2xl"], paddingTop: SPACING["3xl"] },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyImg: { width: 160, height: 160, borderRadius: RADIUS.lg },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
});
