import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText, Loader } from "@/src/components/ui";
import { ResizableTable, ResizableTableColumn } from "@/src/components/ResizableTable";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

interface Admin {
  id: string;
  phone: string;
  name: string;
  admin_role: string;
  created_at?: string;
  is_you: boolean;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ManageAdmins() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Admin | null>(null);
  const [confirmPhone, setConfirmPhone] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setSlowLoad(false);
    // If loading takes more than 2 seconds (Render cold start), show a hint
    const slowTimer = setTimeout(() => setSlowLoad(true), 2000);
    try {
      const a = await apiFetch<Admin[]>("/auth/admins");
      setAdmins(a);
    } catch {
    } finally {
      clearTimeout(slowTimer);
      setSlowLoad(false);
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // The logged-in admin's own row tells us their admin_role.
  const me = admins.find((a) => a.is_you);
  const isManager = me?.admin_role === "Manager";

  const handleDelete = (admin: Admin) => {
    Alert.alert(
      "Remove admin?",
      `${admin.name || admin.phone} will lose access immediately. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setConfirmPhone("");
            setConfirmError("");
            setConfirmTarget(admin);
          },
        },
      ]
    );
  };

  const closeConfirm = () => {
    setConfirmTarget(null);
    setConfirmPhone("");
    setConfirmError("");
  };

  const submitDelete = async () => {
    if (!confirmTarget) return;
    if (confirmPhone.trim().length !== 10 || !/^\d{10}$/.test(confirmPhone.trim())) {
      setConfirmError("Enter your own 10-digit mobile number to confirm");
      return;
    }
    const admin = confirmTarget;
    setDeletingId(admin.id);
    try {
      await apiFetch(`/auth/admins/${admin.id}`, {
        method: "DELETE",
        body: { confirm_phone: confirmPhone.trim() },
      });
      show("Admin removed", "success");
      setAdmins((prev) => prev.filter((x) => x.id !== admin.id));
      closeConfirm();
   } catch (e: any) {
      const msg = e.message || "Could not remove admin";
      // If it looks like a network/timeout error, give a more helpful message
      if (e.status === 0 || !e.status) {
        setConfirmError("Server is waking up, please try again in a moment.");
      } else {
        setConfirmError(msg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const adminColumns: ResizableTableColumn<Admin>[] = [
    {
      key: "sno", label: "#", width: COL_WIDTHS.c1, resizable: false,
      render: (_item, index) => <AppText size="sm" color={COLORS.muted}>{index + 1}</AppText>,
    },
    {
      key: "name", label: "Name", width: COL_WIDTHS.c2, minWidth: 130,
      render: (item) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={styles.avatar}>
            <AppText weight="semibold" size="sm" style={{ color: COLORS.onBrandPrimary }}>
              {(item.name || item.phone).charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="semibold" size="sm" style={{ color: COLORS.onSurface }} numberOfLines={1}>
              {item.name || "—"}
            </AppText>
            {item.is_you && (
              <View style={styles.youBadge}>
                <AppText size="sm" weight="semibold" style={{ color: COLORS.brandPrimary, fontSize: 10 }}>
                  YOU
                </AppText>
              </View>
            )}
          </View>
        </View>
      ),
    },
    {
      key: "role", label: "Role", width: COL_WIDTHS.c3,
      render: (item) => (
        <View style={styles.roleBadge}>
          <AppText size="sm" style={{ color: COLORS.onSurface, fontSize: 11 }} numberOfLines={1}>
            {item.admin_role || "Admin"}
          </AppText>
        </View>
      ),
    },
    {
      key: "mobile", label: "Mobile", width: COL_WIDTHS.c4,
      render: (item) => <AppText size="sm" style={{ color: COLORS.onSurface }}>+91 {item.phone}</AppText>,
    },
    {
      key: "added_on", label: "Added On", width: COL_WIDTHS.c5,
      render: (item) => <AppText size="sm" style={{ color: COLORS.muted }}>{formatDate(item.created_at)}</AppText>,
    },
    {
      key: "actions", label: " ", width: COL_WIDTHS.c6, resizable: false,
      render: (item) => (
        <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
          {isManager && !item.is_you && (
            deletingId === item.id ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); handleDelete(item); }}
                hitSlop={8}
                testID={`delete-admin-${item.id}`}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </Pressable>
            )
          )}
          <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
        </View>
      ),
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Admin Management</AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: 2 }}>
            {admins.length} {admins.length === 1 ? "account" : "accounts"} registered
          </AppText>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/admin/add-admin")}
          testID="go-to-add-admin"
        >
          <Ionicons name="person-add-outline" size={16} color={COLORS.brandPrimary} />
          <AppText weight="semibold" size="sm" style={{ color: COLORS.brandPrimary, marginLeft: 6 }}>
            Add Admin
          </AppText>
        </Pressable>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.brandPrimary} />
          {slowLoad && (
            <AppText size="sm" style={{ color: COLORS.muted, marginTop: 12, textAlign: "center" }}>
              Server is waking up, please wait...{"\n"}This may take up to 30 seconds.
            </AppText>
          )}
        </View>
      ) : admins.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color={COLORS.muted} />
          <AppText size="base" style={{ color: COLORS.muted, marginTop: SPACING.md }}>No admins found</AppText>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ResizableTable
            columns={adminColumns}
            data={admins}
            keyExtractor={(item) => item.id}
            testIDPrefix="admin"
            storageKey="admin_manage_table"
            onRowPress={(item) => {
              if (item.is_you) {
                router.push("/admin/edit-admin-self");
              } else {
                router.push({
                  pathname: "/admin/admin-restricted",
                  params: { name: item.name || item.phone, role: item.admin_role || "Admin" },
                });
              }
            }}
          />
          {/* Footer note */}
          <AppText size="sm" style={styles.footerNote}>
            {isManager
              ? "As a Manager, you can remove other admins. Deleting an admin is permanent."
              : "Only Managers can remove admin accounts."}
          </AppText>
        </View>
      )}

      {/* ── Delete confirmation modal ── */}
      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, shadow]}>
            <AppText weight="semibold" size="lg" style={{ color: COLORS.onSurface }}>
              Confirm removal
            </AppText>
            <AppText size="sm" style={{ color: COLORS.muted, marginTop: 4, marginBottom: SPACING.md }}>
              For security, enter your own registered mobile number to confirm you want to remove{" "}
              {confirmTarget?.name || confirmTarget?.phone}.
            </AppText>
            <View style={styles.modalInputWrap}>
              <View style={styles.ccBadge}>
                <AppText weight="semibold" size="sm" style={{ color: COLORS.onSurface }}>+91</AppText>
              </View>
              <TextInput
                value={confirmPhone}
                onChangeText={(t) => { setConfirmPhone(t.replace(/[^0-9]/g, "")); setConfirmError(""); }}
                placeholder="Your mobile number"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.modalInput}
                testID="confirm-delete-phone"
                autoFocus
              />
            </View>
            {!!confirmError && (
              <AppText size="sm" style={{ color: COLORS.error, marginTop: 6 }}>{confirmError}</AppText>
            )}
            <View style={{ flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg }}>
              <Pressable style={styles.modalCancelBtn} onPress={closeConfirm} testID="cancel-confirm-delete">
                <AppText weight="semibold" size="base" style={{ color: COLORS.onSurface }}>Cancel</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, deletingId === confirmTarget?.id && { opacity: 0.7 }]}
                onPress={submitDelete}
                disabled={deletingId === confirmTarget?.id}
                testID="confirm-delete-admin"
              >
                {deletingId === confirmTarget?.id ? (
                  <ActivityIndicator size="small" color={COLORS.onBrandPrimary ?? "#fff"} />
                ) : (
                  <AppText weight="semibold" size="base" style={{ color: "#fff" }}>Remove</AppText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const COL_WIDTHS = { c1: 28, c2: 130, c3: 90, c4: 110, c5: 85, c6: 60 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xl },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },

  footerNote: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  youBadge: {
    marginTop: 2,
    alignSelf: "flex-start",
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brandTertiary,
    borderWidth: 1, borderColor: COLORS.brandSecondary,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  modalInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    height: 44,
  },
  ccBadge: {
    height: 44,
    paddingHorizontal: SPACING.sm,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.surfaceTertiary,
    borderTopLeftRadius: RADIUS.md,
    borderBottomLeftRadius: RADIUS.md,
  },
  modalInput: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT.base,
    color: COLORS.onSurface,
    height: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
  },
  modalDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
});
