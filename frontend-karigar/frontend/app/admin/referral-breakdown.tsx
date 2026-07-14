/**
 * referral-breakdown.tsx
 *
 * CHANGES vs original:
 *  1. Resizable columns — drag the divider on any column header to resize it.
 *     Works on web (mouse) and mobile (PanResponder touch).
 *  2. Bulk-select + Bulk-pay — on the "pending" screen, a checkbox appears on
 *     each row. Select any number, enter the per-referral amount (defaults to
 *     ₹50), then tap "Pay Selected".  The backend /admin/referrals/bulk-mark-paid
 *     does the work and returns a summary of what succeeded / was skipped.
 *  3. Amount column now shows the ACTUAL stored amount (not always ₹50), so
 *     the total on the overview page stays consistent with what was paid.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  PanResponder,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

type Category =
  | "referred"
  | "registered"
  | "logged_in"
  | "paid"
  | "pending"
  | "not_registered";

interface Row {
  referral_id: string;
  referrer_name: string;
  referrer_phone: string;
  referrer_worker_id: string | null;
  referrer_has_payout_number: boolean;
  name: string;
  phone: string;
  worker_id: string | null;
  status: string;
  payout_amount_rs: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  account_created:  { label: "Logged In Only", color: COLORS.warning },
  pending:          { label: "Registered",     color: COLORS.success },
  reward_triggered: { label: "Reward Due",     color: COLORS.warning },
  paid:             { label: "Paid",           color: COLORS.success },
};

// ── Column definitions ────────────────────────────────────────────────────────
// Each col has a default width. The user can drag the right edge to resize.
const DEFAULT_COLS = [
  { key: "check",    label: "",           width: 44  }, // checkbox col (pending only)
  { key: "sino",     label: "S.No",       width: 50  },
  { key: "referrer", label: "Referrer",   width: 160 },
  { key: "name",     label: "Name",       width: 160 },
  { key: "phone",    label: "Phone",      width: 120 },
  { key: "status",   label: "Status",     width: 120 },
  { key: "amount",   label: "Amount (₹)", width: 100 },
  { key: "date",     label: "Date",       width: 110 },
  { key: "action",   label: "",           width: 130 }, // single-pay button col (pending only)
];
const MIN_COL_WIDTH = 40;

// ── Resizable column header ───────────────────────────────────────────────────
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
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.pageX;
      },
      onPanResponderMove: (e) => {
        const delta = e.nativeEvent.pageX - startX.current;
        startX.current = e.nativeEvent.pageX;
        onResize(delta);
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <View style={{ width, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
        <AppText size="sm" weight="bold" color="#fff" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {/* Drag handle — hidden on last column */}
      {!isLast && (
        <View
          {...panResponder.panHandlers}
          style={styles.dragHandle}
          // Web pointer cursor
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

// ── Bulk-pay confirmation modal ───────────────────────────────────────────────
function BulkPayModal({
  visible,
  count,
  defaultAmount,
  onConfirm,
  onCancel,
  loading,
}: {
  visible: boolean;
  count: number;
  defaultAmount: number;
  onConfirm: (amountPerReferral: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [amtText, setAmtText] = useState(String(defaultAmount));
  const amt = parseInt(amtText, 10) || 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <AppText weight="bold" size="lg" style={{ marginBottom: SPACING.sm }}>
            Confirm Bulk Payment
          </AppText>

          <AppText color={COLORS.muted} size="sm" style={{ marginBottom: SPACING.md }}>
            You are about to mark {count} referral{count !== 1 ? "s" : ""} as paid.
            Enter the amount you paid per referral (default ₹50):
          </AppText>

          <View style={styles.amtRow}>
            <AppText weight="semibold" size="base" style={{ marginRight: SPACING.xs }}>₹</AppText>
            <TextInput
              style={styles.amtInput}
              value={amtText}
              onChangeText={setAmtText}
              keyboardType="number-pad"
              selectTextOnFocus
            />
            <AppText color={COLORS.muted} size="sm" style={{ marginLeft: SPACING.sm }}>
              per referral
            </AppText>
          </View>

          <View style={styles.amtSummary}>
            <AppText size="sm" color={COLORS.muted}>Total you paid:</AppText>
            <AppText weight="bold" color={COLORS.success} size="base" style={{ marginLeft: SPACING.sm }}>
              ₹{amt * count}
            </AppText>
          </View>

          <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }}>
            <Pressable style={[styles.modalBtn, { backgroundColor: COLORS.surfaceSecondary }]} onPress={onCancel}>
              <AppText size="sm" weight="semibold">Cancel</AppText>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: COLORS.brandPrimary, flex: 1 }]}
              onPress={() => onConfirm(amt)}
              disabled={loading || amt <= 0}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <AppText size="sm" weight="semibold" color="#fff">
                  Confirm — Pay ₹{amt * count}
                </AppText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReferralBreakdown() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { category, label } = useLocalSearchParams<{ category: Category; label?: string }>();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Resizable columns — store widths in state
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLS.map((c) => c.width));

  const resizeCol = (index: number, delta: number) => {
    setColWidths((prev) => {
      const next = [...prev];
      next[index] = Math.max(MIN_COL_WIDTH, (next[index] ?? DEFAULT_COLS[index].width) + delta);
      return next;
    });
  };

  // Bulk-select (pending tab only)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const eligible = rows.filter((r) => r.referrer_has_payout_number);
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((r) => r.referral_id)));
    }
  };

  const load = useCallback(async () => {
    if (!category || category === "not_registered") {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ rows: Row[] }>(`/admin/referrals/list?category=${category}`);
      setRows(res.rows);
      setSelected(new Set()); // clear selection on reload
    } catch (e: any) {
      show(e.message || "Could not load this list", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Single mark-paid
  const markPaid = async (row: Row) => {
    setPayingId(row.referral_id);
    try {
      await apiFetch(`/admin/referrals/${row.referral_id}/mark-paid`, { method: "POST" });
      show("Marked as paid", "success");
      setRows((prev) => prev.filter((r) => r.referral_id !== row.referral_id));
      setSelected((prev) => { const n = new Set(prev); n.delete(row.referral_id); return n; });
    } catch (e: any) {
      show(e.message || "Could not mark as paid", "error");
    } finally {
      setPayingId(null);
    }
  };

  // Bulk mark-paid
  const executeBulkPay = async (amountPerReferral: number) => {
    setBulkLoading(true);
    try {
      const result = await apiFetch<{
        paid_count: number;
        skipped_count: number;
        total_amount_rs: number;
        skipped: { id: string; reason: string }[];
      }>("/admin/referrals/bulk-mark-paid", {
        method: "POST",
        body: JSON.stringify({
          referral_ids: Array.from(selected),
          amount_per_referral_rs: amountPerReferral,
        }),
      });

      setShowBulkModal(false);
      const paidIds = new Set(Array.from(selected)); // approximate — all selected minus skipped
      result.skipped.forEach((s) => paidIds.delete(s.id));
      setRows((prev) => prev.filter((r) => !paidIds.has(r.referral_id)));
      setSelected(new Set());

      const skipMsg = result.skipped_count > 0
        ? ` (${result.skipped_count} skipped — check payout numbers)`
        : "";
      show(
        `Paid ₹${result.total_amount_rs} for ${result.paid_count} referral${result.paid_count !== 1 ? "s" : ""}${skipMsg}`,
        result.skipped_count > 0 ? "error" : "success"
      );
    } catch (e: any) {
      show(e.message || "Bulk payment failed", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const isPending = category === "pending";
  const eligibleRows = rows.filter((r) => r.referrer_has_payout_number);

  // Visible columns — hide check + action cols when not on pending tab
  const visibleCols = DEFAULT_COLS.filter((c) => {
    if (c.key === "check" || c.key === "action") return isPending;
    return true;
  });
  const visibleWidths = visibleCols.map((c) => colWidths[DEFAULT_COLS.findIndex((d) => d.key === c.key)]);
  const tableWidth = visibleWidths.reduce((s, w) => s + w, 0);

  const title = label || "Referral Details";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/referrals"))}
      />

      {/* Pending info banner */}
      {isPending && (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
          <AppText size="sm" style={{ color: COLORS.muted, flex: 1, marginLeft: SPACING.sm }}>
            Send the payment via UPI first, then select those rows and tap "Pay Selected" — or use
            "Mark as Paid" on individual rows.
          </AppText>
        </View>
      )}

      {/* Bulk-pay toolbar — only shown when rows are selected */}
      {isPending && selected.size > 0 && (
        <View style={styles.bulkBar}>
          <AppText weight="semibold" size="sm" color={COLORS.brandPrimary}>
            {selected.size} selected
          </AppText>
          <Pressable style={styles.bulkBtn} onPress={() => setShowBulkModal(true)}>
            <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
            <AppText size="sm" weight="semibold" color="#fff" style={{ marginLeft: 4 }}>
              Pay Selected
            </AppText>
          </Pressable>
        </View>
      )}

      {loading ? (
        <Loader />
      ) : category === "not_registered" ? (
        <View style={styles.explainerWrap}>
          <Ionicons name="link-outline" size={40} color={COLORS.muted} />
          <AppText weight="semibold" size="base" style={{ color: COLORS.onSurface, marginTop: SPACING.md, textAlign: "center" }}>
            No individual details to show
          </AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: SPACING.xs, textAlign: "center", paddingHorizontal: SPACING.lg }}>
            "Not Registered" counts people who tapped a referral link but never created an account.
            We only record that the link was clicked — not who clicked it — so there's no name or
            phone number to list here.
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: tableWidth, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>

              {/* ── Header row ─────────────────────────────────────────────── */}
              <View style={[styles.headerRow, { flexDirection: "row" }]}>
                {visibleCols.map((col, ci) => {
                  const w = visibleWidths[ci];
                  if (col.key === "check") {
                    // "Select all" checkbox header
                    return (
                      <Pressable
                        key="check"
                        onPress={toggleSelectAll}
                        style={{ width: w, alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons
                          name={selected.size === eligibleRows.length && eligibleRows.length > 0 ? "checkbox" : "square-outline"}
                          size={18}
                          color="#fff"
                        />
                      </Pressable>
                    );
                  }
                  return (
                    <ResizableHeader
                      key={col.key}
                      label={col.label}
                      width={w}
                      isLast={ci === visibleCols.length - 1}
                      onResize={(delta) => resizeCol(DEFAULT_COLS.findIndex((d) => d.key === col.key), delta)}
                    />
                  );
                })}
              </View>

              {/* ── Data rows ──────────────────────────────────────────────── */}
              {rows.map((r, i) => {
                const statusInfo = STATUS_LABELS[r.status] || { label: r.status, color: COLORS.muted };
                const isChecked = selected.has(r.referral_id);

                return (
                  <View
                    key={r.referral_id}
                    style={[
                      styles.dataRow,
                      { backgroundColor: i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary },
                      isChecked && { backgroundColor: COLORS.brandPrimary + "18" },
                    ]}
                  >
                    {isPending && (
                      <Pressable
                        style={{ width: visibleWidths[0], alignItems: "center", justifyContent: "center" }}
                        onPress={() => r.referrer_has_payout_number && toggleSelect(r.referral_id)}
                        disabled={!r.referrer_has_payout_number}
                      >
                        <Ionicons
                          name={isChecked ? "checkbox" : "square-outline"}
                          size={18}
                          color={r.referrer_has_payout_number ? COLORS.brandPrimary : COLORS.muted}
                        />
                      </Pressable>
                    )}

                    <Cell width={visibleWidths[isPending ? 1 : 0]}><AppText size="sm">{i + 1}</AppText></Cell>

                    <Cell width={visibleWidths[isPending ? 2 : 1]}>
                      <AppText size="sm" weight="semibold">{r.referrer_name}</AppText>
                      <AppText size="sm" color={COLORS.muted}>{r.referrer_phone}</AppText>
                    </Cell>

                    <Cell width={visibleWidths[isPending ? 3 : 2]}><AppText size="sm">{r.name}</AppText></Cell>
                    <Cell width={visibleWidths[isPending ? 4 : 3]}><AppText size="sm" color={COLORS.muted}>{r.phone}</AppText></Cell>

                    <Cell width={visibleWidths[isPending ? 5 : 4]}>
                      <AppText size="sm" weight="semibold" color={statusInfo.color}>{statusInfo.label}</AppText>
                    </Cell>

                    <Cell width={visibleWidths[isPending ? 6 : 5]}>
                      <AppText size="sm" color={COLORS.success}>₹{r.payout_amount_rs}</AppText>
                    </Cell>

                    <Cell width={visibleWidths[isPending ? 7 : 6]}>
                      <AppText size="sm" color={COLORS.muted}>
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </AppText>
                    </Cell>

                    {isPending && (
                      <View style={{ width: visibleWidths[8], paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, justifyContent: "center" }}>
                        {!r.referrer_has_payout_number ? (
                          <AppText size="sm" color={COLORS.muted}>No payout number</AppText>
                        ) : payingId === r.referral_id ? (
                          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                        ) : (
                          <Pressable style={styles.payBtn} onPress={() => markPaid(r)} testID={`mark-paid-${r.referral_id}`}>
                            <AppText size="sm" weight="semibold" style={{ color: "#fff" }}>Mark as Paid</AppText>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {rows.length === 0 && (
                <View style={{ padding: SPACING.xl, alignItems: "center" }}>
                  <AppText color={COLORS.muted}>Nothing here yet</AppText>
                </View>
              )}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Bulk-pay modal */}
      <BulkPayModal
        visible={showBulkModal}
        count={selected.size}
        defaultAmount={50}
        onConfirm={executeBulkPay}
        onCancel={() => setShowBulkModal(false)}
        loading={bulkLoading}
      />
    </View>
  );
}

// ── Cell helper ───────────────────────────────────────────────────────────────
function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View
      style={{
        width,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        borderRightWidth: 1,
        borderRightColor: COLORS.divider,
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.lg,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },

  explainerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },

  payBtn: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  amtRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  amtInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.onSurface,
    padding: 0,
    minWidth: 60,
  },
  amtSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  modalBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
});
