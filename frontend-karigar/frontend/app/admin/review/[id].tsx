import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { ScreenHeader, Loader, Button, AppText } from "@/src/components/ui";
import WorkerDetail from "@/src/components/WorkerDetail";
import WorkerForm, { fromWorker, toPayload, WorkerFormValues } from "@/src/components/WorkerForm";
import { apiFetch } from "@/src/api/client";
import { Worker } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";

export default function ReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [notFound, setNotFound] = useState(false);

  // This screen is reachable from two different flows:
  //   1) Dashboard -> Verify -> Review                     (from=verify)
  //   2) Dashboard -> Referrals -> Referred User -> Review  (from=referral)
  // router.back() correctly returns to whichever of these the admin came
  // from. It only fails when the navigation stack has been lost (e.g. a
  // browser refresh on web, or a direct link into this screen) — in that
  // case router.canGoBack() is false and we fall back to a sensible parent
  // screen based on where we were told we came from, instead of always
  // assuming "Verify" (which used to silently skip the referral flow).
  const fallbackRoute = from === "referral" ? "/admin/referrals" : "/admin/(tabs)/verify";
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallbackRoute));

  const load = () =>
    apiFetch<Worker>(`/admin/workers/${id}`)
      .then(setWorker)
      .catch(() => setNotFound(true));

  useEffect(() => {
    load();
  }, [id]);

  const approve = async () => {
    setBusy(true);
    try {
      await apiFetch(`/admin/workers/${id}/approve`, { method: "POST" });
      show(t("workerApproved"), "success");
      goBack();
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await apiFetch(`/admin/workers/${id}/reject`, { method: "POST", body: { reason: reason.trim() } });
      show(t("workerRejectedRemoved"), "success");
      sheetRef.current?.close();
      goBack();
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

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
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn} testID="edit-worker-btn">
              <Ionicons name="create-outline" size={18} color={COLORS.brandPrimary} />
              <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{t("edit")}</AppText>
            </Pressable>
          ) : undefined
        }
      />
      {worker ? (
      <WorkerDetail worker={worker} contentBottom={120} />
      ) : notFound ? (
      <View style={{ padding: 20 }}>
      <AppText>This profile could not be found. It may have already been reviewed.</AppText>
      </View>
      ) : (
      <Loader />
      )}

      {worker && worker.verification_status === "approved" ? (
        <View style={[styles.footer, styles.verifiedFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <AppText weight="semibold" size="base" style={{ color: COLORS.success, marginLeft: 8 }}>
            This profile is already verified
          </AppText>
        </View>
      ) : worker ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={{ flex: 1 }}>
            <Button title={t("reject")} variant="danger" onPress={() => sheetRef.current?.expand()} icon="trash" testID="reject-btn" />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t("approve")} variant="success" onPress={approve} loading={busy} icon="checkmark" testID="approve-btn" />
          </View>
        </View>
      ) : null}

      <BottomSheet ref={sheetRef} index={-1} snapPoints={["48%"]} enablePanDownToClose keyboardBehavior="interactive" backgroundStyle={{ backgroundColor: COLORS.surfaceSecondary }}>
        <BottomSheetView style={{ padding: SPACING.lg }}>
          <AppText weight="bold" size="xl" style={{ marginBottom: SPACING.xs }}>{t("rejectConfirmTitle")}</AppText>
          <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.md }}>{t("rejectConfirmBody")}</AppText>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("rejectReasonPh")}
            placeholderTextColor={COLORS.muted}
            multiline
            style={styles.input}
            testID="reject-reason-input"
          />
          <View style={{ marginTop: SPACING.lg }}>
            <Button title={t("rejectRemove")} variant="danger" onPress={reject} loading={busy} testID="confirm-reject-btn" />
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.brandTertiary },
  footer: {
    flexDirection: "row",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  verifiedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    textAlignVertical: "top",
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surface,
  },
});
