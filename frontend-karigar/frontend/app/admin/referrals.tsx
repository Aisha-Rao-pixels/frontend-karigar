/**
 * referrals.tsx — Admin Referral Dashboard
 *
 * Reloads data every time admin navigates back from referral-detail,
 * so Paid/Pending columns always reflect the latest saved values.
 */
import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, Linking, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "@/src/components/Toast";
import { ResizableTable, ResizableTableColumn } from "@/src/components/ResizableTable";
import { apiFetch, getToken, BASE } from "@/src/api/client";
import { formatDateTime } from "@/src/utils/profile";

interface ReferralRow {
  worker_id: string;
  emp_id?: string;
  full_name: string;
  phone: string;
  referral_code: string;
  total_referred: number;
  registered_count: number;
  account_created_count: number;
  not_registered_count: number;
  paid_amount_rs: number;
  pending_amount_rs: number;
  created_at?: string;
}
export default function AdminReferrals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { show } = useToast();

  const handleExport = useCallback(async () => {
    try {
      const token = await getToken();
      const url = `${BASE}/admin/referrals/export?token=${token}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = "referrals.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      show(e.message || "Export failed", "error");
    }
  }, [show]);

  const handleResetAll = useCallback(async () => {
    const warn1 = "This will PERMANENTLY delete ALL referral history and click tracking, and reset every referrer's paid amount to ₹0. This cannot be undone. Continue?";
    const warn2 = "Are you absolutely sure? This is your last chance to cancel — all referral data will be wiped right now.";

    const proceed = Platform.OS === "web"
      ? window.confirm(warn1) && window.confirm(warn2)
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Reset All Referrals?", warn1, [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Continue", style: "destructive", onPress: () => {
              Alert.alert("Final Confirmation", warn2, [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Yes, Reset Everything", style: "destructive", onPress: () => resolve(true) },
              ]);
            }},
          ]);
        });

    if (!proceed) return;

    setResetting(true);
    try {
      await apiFetch("/admin/referrals/reset-all", { method: "POST" });
      show("All referral data has been reset ✓", "success");
      setRows([]);
      load();
    } catch (e: any) {
      show(e.message || "Could not reset referral data", "error");
    } finally {
      setResetting(false);
    }
  }, [show]);

 
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

  // Reload every time this screen comes into focus (e.g. coming back from
  // referral-detail after changing paid amount) so Paid/Pending are fresh.
  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

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

  const columns: ResizableTableColumn<ReferralRow>[] = [
    {
      key: "sino", label: "S.No", width: 50, resizable: false,
      render: (_r, i) => <AppText size="sm">{i + 1}</AppText>,
    },
    {
      key: "emp_id", label: "EMP_ID", width: 80, resizable: false,
      sortable: true, sortValue: (r) => r.emp_id ?? "",
      filterable: true, filterMatch: (r, f) => (r.emp_id ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (r) => <AppText size="sm">{r.emp_id}</AppText>,
    },
    {
      key: "name", label: "Name", width: 160,
      sortable: true, sortValue: (r) => r.full_name?.toLowerCase() ?? "",
      filterable: true, filterMatch: (r, f) => (r.full_name ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (r) => (
        <Pressable onPress={() => router.push(`/admin/worker/${r.worker_id}?from=referral`)}>
          <AppText size="sm" weight="semibold" numberOfLines={1}>{r.full_name}</AppText>
        </Pressable>
      ),
    },
    {
      key: "phone", label: "Phone", width: 110,
      render: (r) => <AppText size="sm" color={COLORS.muted}>{r.phone}</AppText>,
    },
    {
      key: "code", label: "Referral Code", width: 130,
      render: (r) => <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{r.referral_code}</AppText>,
    },
    {
      key: "referred", label: "Referred", width: 90,
      render: (r) => (
        <Pressable onPress={() => router.push(`/admin/referral-detail/${r.worker_id}`)}>
          <AppText size="sm">{r.total_referred}</AppText>
        </Pressable>
      ),
    },
    {
      key: "registered", label: "Registered", width: 100,
      render: (r) => (
        <Pressable onPress={() => router.push(`/admin/referral-detail/${r.worker_id}`)}>
          <AppText size="sm" color={COLORS.success} weight="semibold">{r.registered_count}</AppText>
        </Pressable>
      ),
    },
    {
      key: "loggedIn", label: "Logged In Only", width: 130,
      render: (r) => (
        <Pressable onPress={() => router.push(`/admin/referral-detail/${r.worker_id}`)}>
          <AppText size="sm" color={COLORS.warning} weight="semibold">{r.account_created_count}</AppText>
        </Pressable>
      ),
    },
    {
      key: "notRegistered", label: "Not Registered", width: 130,
      render: (r) => <AppText size="sm" color={COLORS.error} weight="semibold">{r.not_registered_count}</AppText>,
    },
    {
      key: "paid", label: "Paid (₹)", width: 100,
      render: (r) => <AppText size="sm" color={COLORS.success}>₹{r.paid_amount_rs}</AppText>,
    },
    {
      key: "joined", label: "Joined On", width: 160,
      sortable: true, sortValue: (r) => r.created_at ?? "",
      filterable: true, filterMatch: (r, f) => formatDateTime(r.created_at).toLowerCase().includes(f.toLowerCase()),
      render: (item) => <AppText size="sm" color={COLORS.muted}>{item.created_at ? formatDateTime(item.created_at) : "—"}</AppText>,
    },
    {
      key: "pending", label: "Pending (₹)", width: 110,
      render: (r) => <AppText size="sm" color={r.pending_amount_rs > 0 ? COLORS.warning : COLORS.muted}>₹{r.pending_amount_rs}</AppText>,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Referral Dashboard"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard"))}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={handleExport} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border }}>
              <Ionicons name="download-outline" size={16} color={COLORS.onSurface} />
              <AppText size="sm" weight="semibold">Export CSV</AppText>
            </Pressable>
            <Pressable
              onPress={handleResetAll}
              disabled={resetting}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.error + "15", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error, opacity: resetting ? 0.6 : 1 }}
            >
              {resetting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons name="trash-outline" size={16} color={COLORS.error} />
              )}
              <AppText size="sm" weight="semibold" color={COLORS.error}>Reset All</AppText>
            </Pressable>
          </View>
        }
      />

      {loading ? (
        <Loader />
      ) : (
        <>
          {/* KPI strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm, padding: SPACING.lg, paddingBottom: SPACING.sm }}
            style={{ flexGrow: 0 }}
          >
            <Kpi label="Total Referrers"  value={rows.length} />
            <Kpi label="Total Referred"   value={totals.referred}      onPress={() => openBreakdown("referred",       "Total Referred")} />
            <Kpi label="Registered"       value={totals.registered}    color={COLORS.success}  onPress={() => openBreakdown("registered",    "Registered")} />
            <Kpi label="Logged In Only"   value={totals.loggedIn}      color={COLORS.warning}  onPress={() => openBreakdown("logged_in",     "Logged In Only")} />
            <Kpi label="Not Registered"   value={totals.notRegistered} color={COLORS.error}    onPress={() => openBreakdown("not_registered","Not Registered")} />
            <Kpi label="Total Paid"       value={`₹${totals.paid}`}   color={COLORS.success}  onPress={() => openBreakdown("paid",          "Total Paid")} />
            <Kpi label="Total Pending"    value={`₹${totals.pending}`} color={COLORS.warning}  onPress={() => openBreakdown("pending",       "Total Pending")} />
          </ScrollView>

          <View style={{ flex: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg }}>
            <ResizableTable
              columns={columns}
              data={rows}
              keyExtractor={(r) => r.worker_id}
              testIDPrefix="referral"
              storageKey="admin_referrals_table"
              emptyText="No referral activity yet"
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
            />
          </View>
        </>
      )}
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
  kpi: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minWidth: 130,
    alignItems: "flex-start",
  },
});
