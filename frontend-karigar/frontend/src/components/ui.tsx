import React, { useRef, useState } from "react";
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
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { speakLabel } from "@/src/utils/speech";

// Renders a label with a small speaker icon that reads the label's
// primary-language portion aloud (bilingual labels look like
// "English / हिंदी" — we only speak the part before " / ").
export function StatusTracker({ status }: { status: "pending" | "approved" | "rejected" }) {
  const step2Icon = status === "approved" ? "checkmark" : status === "rejected" ? "close" : "time";
  const step2Color = status === "approved" ? COLORS.success : status === "rejected" ? COLORS.error : COLORS.warning;
  const step3Done = status === "approved" || status === "rejected";
  const step3Icon = status === "approved" ? "checkmark" : status === "rejected" ? "close" : "star";
  const step3Color = status === "approved" ? COLORS.success : status === "rejected" ? COLORS.error : COLORS.muted;
  const Node = ({ icon, color, filled, label }: { icon: any; color: string; filled: boolean; label: string }) => (
    <View style={{ alignItems: "center", width: 84 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: filled ? color + "22" : COLORS.surfaceSecondary, borderWidth: filled ? 0 : 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <AppText size="sm" weight="semibold" color={color} style={{ marginTop: 6, textAlign: "center" }}>{label}</AppText>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md }}>
      <Node icon="checkmark" color={COLORS.success} filled label="Submitted" />
      <View style={{ flex: 1, height: 3, backgroundColor: COLORS.success, marginBottom: 22, marginHorizontal: -4 }} />
      <Node icon={step2Icon} color={step2Color} filled label="Being checked" />
      <View style={{ flex: 1, height: 3, backgroundColor: step3Done ? step2Color : COLORS.border, marginBottom: 22, marginHorizontal: -4 }} />
      <Node icon={step3Icon} color={step3Color} filled={step3Done} label={status === "rejected" ? "Rejected" : "Approved"} />
    </View>
  );
}

export function StatusTracker({ status }: { status: "pending" | "approved" | "rejected" }) {
  const step2Icon = status === "approved" ? "checkmark" : status === "rejected" ? "close" : "time";
  const step2Color = status === "approved" ? COLORS.success : status === "rejected" ? COLORS.error : COLORS.warning;
  const step3Done = status === "approved" || status === "rejected";
  const step3Icon = status === "approved" ? "checkmark" : status === "rejected" ? "close" : "star";
  const step3Color = status === "approved" ? COLORS.success : status === "rejected" ? COLORS.error : COLORS.muted;
  const Node = ({ icon, color, filled, label }: { icon: any; color: string; filled: boolean; label: string }) => (
    <View style={{ alignItems: "center", width: 84 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: filled ? color + "22" : COLORS.surfaceSecondary, borderWidth: filled ? 0 : 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <AppText size="sm" weight="semibold" color={color} style={{ marginTop: 6, textAlign: "center" }}>{label}</AppText>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md }}>
      <Node icon="checkmark" color={COLORS.success} filled label="Submitted" />
      <View style={{ flex: 1, height: 3, backgroundColor: COLORS.success, marginBottom: 22, marginHorizontal: -4 }} />
      <Node icon={step2Icon} color={step2Color} filled label="Being checked" />
      <View style={{ flex: 1, height: 3, backgroundColor: step3Done ? step2Color : COLORS.border, marginBottom: 22, marginHorizontal: -4 }} />
      <Node icon={step3Icon} color={step3Color} filled={step3Done} label={status === "rejected" ? "Rejected" : "Approved"} />
    </View>
  );
}
export function LabelWithSpeaker({ label, style }: { label: string; style?: StyleProp<TextStyle> }) {
  const { i18n } = useTranslation();
  const primary = label.split(" / ")[0];
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <AppText weight="semibold" size="base" style={style}>
        {label}
      </AppText>
      <Pressable
        onPress={() => speakLabel(primary, i18n.language)}
        hitSlop={10}
        style={{ marginLeft: 8, padding: 4 }}
        testID="speak-label-btn"
      >
        <Ionicons name="volume-medium" size={26} color={COLORS.brandPrimary} />
      </Pressable>
    </View>
  );
}

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

  const fg = {
    primary: COLORS.onBrandPrimary,
    secondary: COLORS.onSurfaceTertiary,
    ghost: COLORS.brandPrimary,
    danger: COLORS.onError,
    success: COLORS.onSuccess,
  }[variant];
  const isDisabled = disabled || loading;
  const [hovered, setHovered] = React.useState(false);

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
          backgroundColor: bg,
          opacity: isDisabled ? 0.5 : 1,
          // Hover/press feedback is purely a size + shadow change now —
          // colors never shift, so text stays legible no matter what.
          transform: [{ scale: pressed ? 0.97 : hovered ? 1.035 : 1 }],
          shadowColor: "#1A1817",
          shadowOpacity: pressed ? 0.18 : hovered ? 0.14 : 0.06,
          shadowRadius: pressed ? 12 : hovered ? 11 : 8,
          shadowOffset: { width: 0, height: pressed ? 4 : hovered ? 3 : 2 },
          elevation: pressed ? 6 : hovered ? 5 : 2,
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
      <View style={{ flexDirection: "row", marginBottom: SPACING.xs, alignItems: "center" }}>
        <LabelWithSpeaker label={label} />
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
// ---------------------------------------------------------------- Tooltip
// Shared web-hover tooltip. Wrap anything in it; on native it's a no-op
// passthrough (no hover concept on touch devices).
export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [vPos, setVPos] = useState<"top" | "bottom">("bottom");
  const [hAlign, setHAlign] = useState<"center" | "left" | "right">("center");
  const wrapRef = useRef<View>(null);

  if (Platform.OS !== "web") return <>{children}</>;

  const handleEnter = () => {
    // @ts-ignore - getBoundingClientRect exists on web
    const rect = wrapRef.current?.getBoundingClientRect?.();
    if (rect) {
      setVPos(rect.top < 160 ? "bottom" : "top");
      const halfW = 70; // half of the 140px tooltip width
      if (rect.left - halfW < 8) setHAlign("left");
      else if (rect.right + halfW > window.innerWidth - 8) setHAlign("right");
      else setHAlign("center");
    }
    setVisible(true);
  };

  const hStyle =
    hAlign === "left"
      ? { left: 0, right: undefined, transform: [] as any }
      : hAlign === "right"
      ? { left: undefined, right: 0, transform: [] as any }
      : { left: "50%", right: undefined, transform: [{ translateX: -70 }] };

  return (
    <View
      ref={wrapRef}
      style={{ position: "relative" }}
      // @ts-ignore
      onMouseEnter={handleEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <View
          style={[
            tooltipStyles.box,
            vPos === "bottom" ? { top: "110%", bottom: undefined } : { bottom: "110%" },
            hStyle,
          ]}
          pointerEvents="none"
        >
          <AppText size="sm" color="#fff" style={{ textAlign: "center" }}>{text}</AppText>
        </View>
      )}
    </View>
  );
}

const tooltipStyles = StyleSheet.create({
  box: {
    position: "absolute",
    width: 140,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 6,
    padding: 8,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

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
