/**
 * referrals.tsx  — Admin Referral Dashboard
 *
 * CHANGES vs original:
 *  • Resizable columns — drag the divider on any column header.
 *    Works on both web (mouse) and mobile (PanResponder touch).
 *  • Column widths live in state; TABLE_WIDTH recomputed from them.
 *  • Everything else (KPI strip, row data, navigation) unchanged.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  PanResponder,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";

interface ReferralRow {
  worker_id: string;
  full_name: string;
  phone: string;
  referral_code: string;
  total_referred: number;
  registered_count: number;
  account_created_count: number;
  not_registered_count: number;
  paid_amount_rs: number;
  pending_amount_rs: number;
}

// Default column definitions — widths are mutable via drag
const DEFAULT_COLS = [
  { key: "sino",          label: "S.No",           width: 50  },
  { key: "name",          label: "Name",            width: 160 },
  { key: "phone",         label: "Phone",           width: 110 },
  { key: "code",          label: "Referral Code",   width: 130 },
  { key: "referred",      label: "Referred",        width: 90  },
  { key: "registered",    label: "Registered",      width: 100 },
  { key: "loggedIn",      label: "Logged In Only",  width: 130 },
  { key: "notRegistered", label: "Not Registered",  width: 130 },
  { key: "paid",          label: "Paid (₹)",        width: 100 },
  { key: "pending",       label: "Pending (₹)",     width: 110 },
];
const MIN_COL_WIDTH = 40;

// ── Resizable column header ────────────────────────────────────────────────
function ResizableHeader({
  label,
  width,
  onResize,
  isLast,
}: {
  label: string;
  width: number;
  onResize: (delta: number) => void;
  isLast: boolean;
}) {
  const startX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { startX.current = e.nativeEvent.pageX; },
      onPanResponderMove: (e) => {
        const delta = e.nativeEvent.pageX - startX.current;
        startX.current = e.nativeEvent.pageX;
        onResize(delta);
      },
    })
  ).current;

  return (
    <View style={{ width, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
        <AppText size="sm" weight="bold" color="#fff" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {!isLast && (
        <View
          {...panResponder.panHandlers}
          style={styles.dragHandle}
          // @ts-ignore
          onMouseDown={
            Platform.OS === "web"
              ? (e: MouseEvent) => {
                  e.preventDefault();
                  let lastX = e.clientX;
                  const onMove = (me: MouseEvent) => {
                    onResize(me.clientX - lastX);
                    lastX = me.clientX;
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }
              : undefined
          }
        />
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function AdminReferrals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Resizable widths in state
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLS.map((c) => c.width));
  const tableWidth = colWidths.reduce((s, w) => s + w, 0);

  const resizeCol = (index: number, delta: number) => {
    setColWidths((prev) => {
      const next = [...prev];
      next[index] = Math.max(MIN_COL_WIDTH, next[index] + delta);
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ rows: ReferralRow[] }>("/admin/referrals/overview");
      setRows(data.rows);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openBreakdown = (category: string, label: string) => {
    router.push({ pathname: "/admin/referral-breakdown", params: { category, label } });
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        referred:      acc.referred      + r.total_referred,
        registered:    acc.registered    + r.registered_count,
        loggedIn:      acc.loggedIn      + r.account_created_count,
        notRegistered: acc.notRegistered + r.not_registered_count,
        paid:          acc.paid          + r.paid_amount_rs,
        pending:       acc.pending       + r.pending_amount_rs,
      }),
      { referred: 0, registered: 0, loggedIn: 0, notRegistered: 0, paid: 0, pending: 0 }
    );
  }, [rows]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Referral Dashboard"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard"))}
      />

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          {/* KPI strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, marginBottom: SPACING.lg }}>
            <Kpi label="Total Referrers"  value={rows.length} />
            <Kpi label="Total Referred"   value={totals.referred}      onPress={() => openBreakdown("referred",      "Total Referred")} />
            <Kpi label="Registered"       value={totals.registered}    color={COLORS.success}  onPress={() => openBreakdown("registered",  "Registered")} />
            <Kpi label="Logged In Only"   value={totals.loggedIn}      color={COLORS.warning}  onPress={() => openBreakdown("logged_in",   "Logged In Only")} />
            <Kpi label="Not Registered"   value={totals.notRegistered} color={COLORS.error}    onPress={() => openBreakdown("not_registered", "Not Registered")} />
            <Kpi label="Total Paid"       value={`₹${totals.paid}`}   color={COLORS.success}  onPress={() => openBreakdown("paid",        "Total Paid")} />
            <Kpi label="Total Pending"    value={`₹${totals.pending}`} color={COLORS.warning}  onPress={() => openBreakdown("pending",     "Total Pending")} />
          </ScrollView>

          {/* Resizable data table */}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: tableWidth, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>

              {/* Header */}
              <View style={[styles.headerRow, { flexDirection: "row" }]}>
                {DEFAULT_COLS.map((col, ci) => (
                  <ResizableHeader
                    key={col.key}
                    label={col.label}
                    width={colWidths[ci]}
                    isLast={ci === DEFAULT_COLS.length - 1}
                    onResize={(delta) => resizeCol(ci, delta)}
                  />
                ))}
              </View>

              {/* Rows */}
              {rows.map((r, i) => (
                <View
                  key={r.worker_id}
                  style={[styles.dataRow, { backgroundColor: i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary }]}
                >
                  <Cell width={colWidths[0]}><AppText size="sm">{i + 1}</AppText></Cell>

                  <Pressable onPress={() => router.push(`/admin/worker/${r.worker_id}?from=referral`)}>
                    <Cell width={colWidths[1]}>
                      <AppText size="sm" weight="semibold">{r.full_name}</AppText>
                    </Cell>
                  </Pressable>

                  <Cell width={colWidths[2]}><AppText size="sm" color={COLORS.muted}>{r.phone}</AppText></Cell>
                  <Cell width={colWidths[3]}><AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{r.referral_code}</AppText></Cell>

                  <Pressable onPress={() => router.push(`/admin/referral-detail/${r.worker_id}`)}>
                    <Cell width={colWidths[4]}><AppText size="sm">{r.total_referred}</AppText></Cell>
                  </Pressable>

                  <Cell width={colWidths[5]}><AppText size="sm" color={COLORS.success} weight="semibold">{r.registered_count}</AppText></Cell>
                  <Cell width={colWidths[6]}><AppText size="sm" color={COLORS.warning} weight="semibold">{r.account_created_count}</AppText></Cell>
                  <Cell width={colWidths[7]}><AppText size="sm" color={COLORS.error}   weight="semibold">{r.not_registered_count}</AppText></Cell>
                  <Cell width={colWidths[8]}><AppText size="sm" color={COLORS.success}>₹{r.paid_amount_rs}</AppText></Cell>
                  <Cell width={colWidths[9]}><AppText size="sm" color={COLORS.warning}>₹{r.pending_amount_rs}</AppText></Cell>
                </View>
              ))}

              {rows.length === 0 && (
                <View style={{ padding: SPACING.xl, alignItems: "center" }}>
                  <AppText color={COLORS.muted}>No referral activity yet</AppText>
                </View>
              )}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{
      width,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      borderRightWidth: 1,
      borderRightColor: COLORS.divider,
      justifyContent: "center",
    }}>
      {children}
    </View>
  );
}

function Kpi({ label, value, color = COLORS.onSurface, onPress }: {
  label: string; value: number | string; color?: string; onPress?: () => void;
}) {
  const content = (
    <View style={[styles.kpi, shadow]}>
      <AppText weight="bold" size="xl" color={color}>{value}</AppText>
      <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2 }}>{label}</AppText>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  headerRow: { backgroundColor: COLORS.surfaceInverse },
  dataRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.divider, alignItems: "center" },
  dragHandle: {
    width: 8,
    alignSelf: "stretch",
    cursor: "col-resize" as any,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.3)",
  },
  kpi: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minWidth: 130,
    alignItems: "flex-start",
  },
});
