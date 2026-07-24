import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, Loader, Button, AppText } from "@/src/components/ui";
import WorkerDetail from "@/src/components/WorkerDetail";
import WorkerForm, { fromWorker, toPayload, WorkerFormValues } from "@/src/components/WorkerForm";
import { apiFetch } from "@/src/api/client";
import { Worker } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";

export default function AdminWorkerDetail() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const saveEdit = async (v: WorkerFormValues) => {
    setBusy(true);
    try {
      const updated = await apiFetch<Worker>(`/admin/workers/${id}`, { method: "PUT", body: toPayload(v) });
      setWorker(updated);
      setEditing(false);
      show(t("profileUpdated"), "success");
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  // This screen is reachable from two different flows:
  //   1) Dashboard -> Search -> Worker                     (from=search)
  //   2) Dashboard -> Referrals -> Referred User -> Worker  (from=referral)
  // Same fix as the Review screen: only fall back to a hardcoded route when
  // the navigation stack is actually lost, and pick the fallback based on
  // which flow we came from, instead of always assuming "Search".
  const fallbackRoute = from === "referral" ? "/admin/referrals" : "/admin/(tabs)/search";
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallbackRoute));

  useEffect(() => {
    apiFetch<Worker>(`/admin/workers/${id}`).then(setWorker).catch(() => {});
  }, [id]);

 const [deleteReason, setDeleteReason] = useState("");

  const deleteWorker = async () => {
    if (!deleteReason.trim()) {
      show("Please enter a reason for deleting this worker", "error");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/admin/workers/${id}`, { method: "DELETE", body: { reason: deleteReason.trim() } });
      show(t("workerDeleted"), "success");
      sheetRef.current?.close();
      goBack();
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (editing && worker) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title={t("editProfile")} onBack={() => setEditing(false)} />
        <WorkerForm
          initial={fromWorker(worker)}
          submitLabel={t("saveChanges")}
          onSubmit={saveEdit}
          submitting={busy}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t("reviewProfile")}
        onBack={goBack}
        right={
          worker ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setEditing(true)} style={styles.editBtn} testID="edit-worker-btn">
                <Ionicons name="create-outline" size={18} color={COLORS.brandPrimary} />
                <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{t("edit")}</AppText>
              </Pressable>
              <Pressable onPress={() => sheetRef.current?.expand()} style={styles.deleteBtn} testID="delete-worker-btn">
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <AppText size="sm" weight="semibold" color={COLORS.error}>{t("delete")}</AppText>
              </Pressable>
            </View>
          ) : undefined
        }
      />
      {worker ? <WorkerDetail worker={worker} /> : <Loader />}

      <BottomSheet ref={sheetRef} index={-1} snapPoints={["38%"]} enablePanDownToClose keyboardBehavior="interactive" backgroundStyle={{ backgroundColor: COLORS.surfaceSecondary }}>
        <BottomSheetView style={{ padding: SPACING.lg }}>
          <AppText weight="bold" size="xl" style={{ marginBottom: SPACING.xs }}>{t("deleteConfirmTitle")}</AppText>
          <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.md }}>{t("deleteConfirmBody")}</AppText>
          <TextInput
            value={deleteReason}
            onChangeText={setDeleteReason}
            placeholder="Reason for deleting (required)"
            placeholderTextColor={COLORS.muted}
            style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, color: COLORS.onSurface }}
            testID="delete-reason-input"
          />
          <Button title={t("deleteRemove")} variant="danger" onPress={deleteWorker} loading={busy} disabled={!deleteReason.trim()} testID="confirm-delete-btn" />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brandTertiary,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSecondary,
  },
});
