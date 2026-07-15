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
  const [hovered, setHovered] = React.useState(false);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.tile,
        shadow,
        {
          // Hover/press feedback is size + shadow only now — background and
          // text color never change, so the tile is always readable.
          backgroundColor: "#FFFFFF",
          transform: [{ scale: pressed ? 0.96 : hovered ? 1.045 : 1 }],
          shadowOpacity: pressed ? 0.16 : hovered ? 0.14 : 0.06,
          shadowRadius: pressed ? 14 : hovered ? 13 : 8,
          elevation: pressed ? 7 : hovered ? 6 : 2,
        }
      ]}
    >
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
function BarListRow({
  d,
  i,
  w,
  c,
  showPct,
  testID,
  onPress,
}: {
  d: { label: string; value: number; pct?: number };
  i: number;
  w: number;
  c: string;
  showPct?: boolean;
  testID?: string;
  onPress?: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const interactive = !!onPress;
  const content = (
    <>
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
    </>
  );

  if (!interactive) {
    return (
      <View testID={testID} style={styles.barRowStatic}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.barRow,
        {
          transform: [{ scale: pressed ? 0.98 : hovered ? 1.02 : 1 }],
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

export function BarList({
  data,
  max,
  showPct,
  colorFor,
  testID,
  onItemPress,
}: {
  data: { label: string; value: number; pct?: number }[];
  max?: number;
  showPct?: boolean;
  colorFor?: (i: number) => string;
  testID?: string;
  /** When provided, each row becomes pressable/hoverable and drills into that item. */
  onItemPress?: (item: { label: string; value: number; pct?: number }, index: number) => void;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <View testID={testID} style={{ gap: SPACING.sm }}>
      {data.map((d, i) => {
        const w = Math.max(3, (d.value / top) * 100);
        const c = colorFor ? colorFor(i) : COLORS.brandPrimary;
        return (
          <BarListRow
            key={d.label + i}
            d={d}
            i={i}
            w={w}
            c={c}
            showPct={showPct}
            testID={`bar-${d.label}`}
            onPress={onItemPress ? () => onItemPress(d, i) : undefined}
          />
        );
      })}
    </View>
  );
}

function ColumnBarItem({
  children,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  testID?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.colItem,
        styles.colItemInteractive,
        {
          transform: [{ scale: pressed ? 0.93 : hovered ? 1.08 : 1 }],
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

// ----------------------------------------------------------- Column (trend) chart
export function ColumnChart({
  data,
  height = 120,
  tint = COLORS.brandPrimary,
  testID,
  onBarPress,
}: {
  data: { label: string; value: number }[];
  height?: number;
  tint?: string;
  testID?: string;
  onBarPress?: (item: { label: string; value: number }, index: number) => void;
}) {
  const top = Math.max(1, ...data.map((d) => d.value));
  return (
    <View testID={testID}>
      <View style={[styles.colWrap, { height }]}>
        {data.map((d, i) => {
          const isZero = d.value <= 0;
          // Zero days still get a small visible stub (not just 2px) so the
          // column reads as "checked, nothing happened" rather than absent.
          const h = isZero ? 6 : Math.max(4, (d.value / top) * (height - 18));
          const barContent = (
            <>
              <AppText size="sm" weight="bold" color={COLORS.muted} style={{ fontSize: 10 }}>
                {d.value}
              </AppText>
              <View
                style={[
                  styles.colBar,
                  { height: h, backgroundColor: isZero ? COLORS.border : tint },
                ]}
              />
            </>
          );
          return onBarPress ? (
            <ColumnBarItem key={i} testID={`${testID || "col"}-bar-${i}`} onPress={() => onBarPress(d, i)}>
              {barContent}
            </ColumnBarItem>
          ) : (
            <View key={i} testID={`${testID || "col"}-bar-${i}`} style={styles.colItem}>
              {barContent}
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
function SegmentLegendItem({
  s,
  onPress,
}: {
  s: { label: string; value: number; color: string };
  onPress?: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const inner = (
    <>
      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
      <AppText size="sm" weight="medium">
        {s.label}
      </AppText>
      <AppText size="sm" weight="bold" color={COLORS.muted}>
        {s.value}
      </AppText>
    </>
  );
  if (!onPress) {
    return <View style={styles.legendItem}>{inner}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.legendItem,
        styles.legendItemInteractive,
        { transform: [{ scale: pressed ? 0.96 : hovered ? 1.05 : 1 }] },
      ]}
    >
      {inner}
    </Pressable>
  );
}

export function SegmentBar({
  segments,
  testID,
  onSegmentPress,
}: {
  segments: { label: string; value: number; color: string; key?: string }[];
  testID?: string;
  /** When provided, called with the segment's `key` (falls back to `label`) on press. */
  onSegmentPress?: (segmentKey: string) => void;
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
          <SegmentLegendItem
            key={i}
            s={s}
            onPress={onSegmentPress ? () => onSegmentPress(s.key ?? s.label) : undefined}
          />
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
  barRow: { borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 6, marginHorizontal: -6 },
  barRowStatic: { paddingVertical: 2 },
  barLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5 },
  colWrap: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  colItem: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  colItemInteractive: { borderRadius: RADIUS.sm, paddingTop: 4 },
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
  legendItemInteractive: { borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 4, marginHorizontal: -6, marginVertical: -4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
