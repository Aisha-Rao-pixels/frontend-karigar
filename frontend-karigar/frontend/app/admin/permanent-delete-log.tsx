import React, { useCallback, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { ResizableTable, ResizableTableColumn } from "@/src/components/ResizableTable";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

function formatDDMMYYYY(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface DeleteLogEntry {
  id: string;
  worker_id: string | null;
  full_name: string;
  phone: string;
  original_reason: string | null;
  deleted_by: string;
  deleted_at: string;
}

export default function PermanentDeleteLog() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<DeleteLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/admin/dashboard"));

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ logs: DeleteLogEntry[] }>("/admin/permanent-delete-log");
      setLogs(data.logs || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user?.can_delete_permanently) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Permanently Deleted Log" onBack={goBack} />
        <View style={{ padding: SPACING.xl, alignItems: "center" }}>
          <AppText color={COLORS.muted}>You don't have access to this page.</AppText>
        </View>
      </View>
    );
  }

  const columns: ResizableTableColumn<DeleteLogEntry>[] = [
    { key: "worker_id", label: "EMP_ID", width: 90, resizable: false,
      render: (item) => <AppText size="sm">{item.worker_id || "—"}</AppText> },
    { key: "full_name", label: "Name", width: 160,
      sortable: true, sortValue: (l) => l.full_name?.toLowerCase() ?? "",
      render: (item) => <AppText size="sm" weight="semibold">{item.full_name}</AppText> },
    { key: "phone", label: "Phone", width: 130,
      render: (item) => <AppText size="sm">{item.phone}</AppText> },
    { key: "original_reason", label: "Original Reason", width: 220,
      render: (item) => <AppText size="sm">{item.original_reason || "—"}</AppText> },
    { key: "deleted_by", label: "Deleted By", width: 150,
      sortable: true, sortValue: (l) => l.deleted_by?.toLowerCase() ?? "",
      render: (item) => <AppText size="sm">{item.deleted_by}</AppText> },
    { key: "deleted_at", label: "Date", width: 110,
      sortable: true, sortValue: (l) => l.deleted_at ?? "",
      render: (item) => <AppText size="sm">{formatDDMMYYYY(item.deleted_at)}</AppText> },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Permanently Deleted Log" subtitle={`${logs.length} record(s)`} onBack={goBack} />
      {loading ? <Loader /> : <ResizableTable data={logs} columns={columns} keyExtractor={(l) => l.id} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
});
