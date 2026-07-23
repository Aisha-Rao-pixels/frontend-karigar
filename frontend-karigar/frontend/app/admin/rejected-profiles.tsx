import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader, Chip } from "@/src/components/ui";
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

interface RejectedProfile {
  id: string;
  full_name: string;
  phone: string;
  area: string;
  city: string;
  skills: string[];
  portfolio_images: string[];
  rejection_reason: string | null;
  rejected_by: string;
  rejected_at: string;
}

// Deleted profiles land in the same `rejected_profiles` collection as
// rejected ones — the backend only tells them apart by defaulting
// rejection_reason to this exact string when an admin deletes an active
// worker who was never actually rejected first (see admin_delete_worker in
// server.py). We reuse that same signal here to label each row.
const DELETED_REASON = "Deleted by admin";
type ProfileType = "rejected" | "deleted";
function profileType(p: RejectedProfile): ProfileType {
  return p.rejection_reason === DELETED_REASON ? "deleted" : "rejected";
}

export default function RejectedProfiles() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<RejectedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | ProfileType>("all");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ profiles: RejectedProfile[] }>("/admin/rejected-profiles");
      setProfiles(data.profiles);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh every time this screen regains focus — e.g. after restoring a
  // profile back to Pending Verification from the review page, coming back
  // here should immediately drop it from the list.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rejectedCount = useMemo(() => profiles.filter((p) => profileType(p) === "rejected").length, [profiles]);
  const deletedCount = useMemo(() => profiles.filter((p) => profileType(p) === "deleted").length, [profiles]);
  const visibleProfiles = useMemo(
    () => (typeFilter === "all" ? profiles : profiles.filter((p) => profileType(p) === typeFilter)),
    [profiles, typeFilter]
  );

  const columns: ResizableTableColumn<RejectedProfile>[] = [
    {
      key: "sno", label: "S.No", width: 60, resizable: false,
      render: (_item, index) => <AppText size="sm" color={COLORS.muted}>{index + 1}</AppText>,
    },
    {
      key: "emp_id", label: "EMP_ID", width: 80, resizable: false,
      sortable: true, sortValue: (p) => p.worker_id ?? "",
      render: (item: any) => <AppText size="sm" numberOfLines={1}>{item.worker_id}</AppText>,
    }, {
      key: "name", label: "Name", width: 170,
      sortable: true, sortValue: (p) => p.full_name?.toLowerCase() ?? "",
      filterable: true, filterMatch: (p, f) => p.full_name?.toLowerCase().includes(f.toLowerCase()) ?? false,
      render: (item) => (
        <Pressable onPress={() => router.push(`/admin/rejected-profile/${item.id}`)} testID={`rejected-name-${item.id}`}>
          <AppText size="sm" weight="semibold" numberOfLines={1} color={COLORS.brandPrimary}>{item.full_name}</AppText>
        </Pressable>
      ),
    },
    {
      key: "phone", label: "Phone", width: 120,
      filterable: true, filterMatch: (p, f) => (p.phone ?? "").includes(f),
      render: (item) => <AppText size="sm" numberOfLines={1} color={COLORS.muted}>{item.phone || "—"}</AppText>,
    },
    {
      key: "area", label: "Area / Locality", width: 140,
      sortable: true, sortValue: (p) => p.area?.toLowerCase() ?? "",
      filterable: true, filterMatch: (p, f) => (p.area ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.area || "—"}</AppText>,
    },
    {
      key: "city", label: "City", width: 110,
      sortable: true, sortValue: (p) => p.city?.toLowerCase() ?? "",
      filterable: true, filterMatch: (p, f) => (p.city ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.city || "—"}</AppText>,
    },
    {
      key: "skills", label: "Skills", width: 200,
      sortable: true, sortValue: (p) => (p.skills || []).join(", ").toLowerCase(),
      filterable: true, filterMatch: (p, f) => (p.skills || []).join(" ").toLowerCase().includes(f.toLowerCase()),
      render: (item) => <AppText size="sm" numberOfLines={2}>{(item.skills || []).join(", ") || "—"}</AppText>,
    },
    {
      key: "type", label: "Type", width: 100,
      sortable: true, sortValue: (p) => profileType(p),
      filterable: true, filterMatch: (p, f) => profileType(p).includes(f.toLowerCase()),
      render: (item) => {
        const type = profileType(item);
        const color = type === "deleted" ? COLORS.muted : COLORS.error;
        return (
          <View style={[styles.typeBadge, { backgroundColor: color + "1A", borderColor: color + "55" }]}>
            <AppText size="sm" weight="semibold" color={color}>{type === "deleted" ? "Deleted" : "Rejected"}</AppText>
          </View>
        );
      },
    },
    {
      key: "reason", label: "Reason", width: 220,
      filterable: true, filterMatch: (p, f) => (p.rejection_reason ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (item) => <AppText size="sm" numberOfLines={2}>{item.rejection_reason || "No reason given"}</AppText>,
    },
    {
      key: "rejected_by", label: "By", width: 140,
      filterable: true, filterMatch: (p, f) => (p.rejected_by ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (item) => <AppText size="sm" color={COLORS.muted} numberOfLines={1}>{item.rejected_by || "—"}</AppText>,
    },
    {
      key: "rejected_at", label: "Date", width: 110,
      sortable: true, sortValue: (p) => p.rejected_at ?? "",
      render: (item) => <AppText size="sm" color={COLORS.muted}>{formatDDMMYYYY(item.rejected_at)}</AppText>,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Rejected Profiles"
        subtitle={`${rejectedCount} rejected · ${deletedCount} deleted`}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/dashboard"))}
      />

      <View style={styles.typeFilterRow}>
        <Chip label={`All (${profiles.length})`} selected={typeFilter === "all"} onPress={() => setTypeFilter("all")} testID="type-filter-all" />
        <Chip label={`Rejected (${rejectedCount})`} selected={typeFilter === "rejected"} onPress={() => setTypeFilter("rejected")} testID="type-filter-rejected" />
        <Chip label={`Deleted (${deletedCount})`} selected={typeFilter === "deleted"} onPress={() => setTypeFilter("deleted")} testID="type-filter-deleted" />
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <Loader />
        ) : (
          <ResizableTable
            columns={columns}
            data={visibleProfiles}
            keyExtractor={(p) => p.id}
            testIDPrefix="rejected"
            storageKey="admin_rejected_profiles_table"
            emptyText="No rejected or deleted profiles"
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  typeFilterRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
});
