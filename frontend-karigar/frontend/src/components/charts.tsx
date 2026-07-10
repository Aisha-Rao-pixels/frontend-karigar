import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/src/components/ui";
import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";

// Categorical palette used across the BI dashboard charts.
export const SERIES = [
  "#A35C3A", // brand terracotta
  "#0EA5E9", // sky
  "#22C55E", // green
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#64748B", // slate
];

// ----------------------------------------------------------- Panel (BI card)
export function Panel({
  title,
  subtitle,
  icon,
  iconTint = COLORS.brandPrimary,
  right,
  children,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.panel, shadow]}>
      <View style={styles.panelHead}>
        {icon && (
          <View style={[styles.panelIcon, { backgroundColor: iconTint + "1A" }]}>
            <Ionicons name={icon} size={16} color={iconTint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <AppText weight="bold" size="lg">
            {title}
          </AppText>
          {subtitle && (
            <AppText size="sm" color={COLORS.muted} style={{ marginTop: 1 }}>
              {subtitle}
            </AppText>
          )}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// ----------------------------------------------------------- KPI stat tile
export function StatTile({
  label,
  value,
  delta,
  icon,
  tint = COLORS.brandPrimary,
  testID,
  onPress,
}: {
  label: string;
  value: number | string;
  delta?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tile, shadow]}>
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: tint + "1A" }]}>
          <Ionicons name={icon} size={15} color={tint} />
        </View>
        {delta != null && (
          <AppText size="sm" weight="semibold" color={COLORS.success}>
            {delta}
          </AppText>
        )}
      </View>
      <AppText weight="bold" style={{ fontSize: 24, marginTop: SPACING.sm }}>
        {value}
      </AppText>
      <AppText size="sm" color={COLORS.muted} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ----------------------------------------------------------- Horizontal bar list
export function BarList({
  data,
  max,
  showPct,
  colorFor,
  testID,
}: {
  data: { label: string; value: number; pct?: number }[];
  max?: number;
  showPct?: boolean;
  colorFor?: (i: number) => string;
  testID?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <View testID={testID} style={{ gap: SPACING.md }}>
      {data.map((d, i) => {
        const w = Math.max(3, (d.value / top) * 100);
        const c = colorFor ? colorFor(i) : COLORS.brandPrimary;
        return (
          <View key={d.label + i} testID={`bar-${d.label}`}>
            <View style={styles.barLabelRow}>
              <AppText size="base" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {d.label}
              </AppText>
              <AppText size="sm" weight="bold" color={COLORS.onSurface}>
                {d.value}
                {showPct && d.pct != null ? `  ·  ${d.pct}%` : ""}
              </AppText>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${w}%`, backgroundColor: c }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ----------------------------------------------------------- Column (trend) chart
export function ColumnChart({
  data,
  height = 120,
  tint = COLORS.brandPrimary,
  testID,
}: {
  data: { label: string; value: number }[];
  height?: number;
  tint?: string;
  testID?: string;
}) {
  const top = Math.max(1, ...data.map((d) => d.value));
  return (
    <View testID={testID}>
      <View style={[styles.colWrap, { height }]}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / top) * (height - 18));
          return (
            <View key={i} style={styles.colItem}>
              {d.value > 0 && (
                <AppText size="sm" weight="bold" color={COLORS.muted} style={{ fontSize: 10 }}>
                  {d.value}
                </AppText>
              )}
              <View style={[styles.colBar, { height: h, backgroundColor: tint }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.colWrap}>
        {data.map((d, i) => (
          <View key={i} style={styles.colItem}>
            <AppText size="sm" color={COLORS.muted} style={{ fontSize: 9 }}>
              {i % 2 === 0 ? d.label : ""}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ----------------------------------------------------------- Segmented bar + legend
export function SegmentBar({
  segments,
  testID,
}: {
  segments: { label: string; value: number; color: string }[];
  testID?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View testID={testID}>
      <View style={styles.segTrack}>
        {segments.map((s, i) => (
          <View
            key={i}
            style={{
              width: `${(s.value / total) * 100}%`,
              backgroundColor: s.color,
            }}
          />
        ))}
      </View>
      <View style={styles.legendWrap}>
        {segments.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <AppText size="sm" weight="medium">
              {s.label}
            </AppText>
            <AppText size="sm" weight="bold" color={COLORS.muted}>
              {s.value}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  panelHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  panelIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tile: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  barLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5 },
  colWrap: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  colItem: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  colBar: { width: "70%", borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  segTrack: {
    flexDirection: "row",
    height: 18,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceTertiary,
  },
  legendWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
