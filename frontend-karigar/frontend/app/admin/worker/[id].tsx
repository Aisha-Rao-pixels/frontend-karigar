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

  const deleteWorker = async () => {
    setBusy(true);
    try {
      await apiFetch(`/admin/workers/${id}`, { method: "DELETE" });
      show(t("workerDeleted"), "success");
      sheetRef.current?.close();
      goBack();
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t("reviewProfile")}
        onBack={goBack}
        right={
          worker ? (
            <Pressable onPress={() => sheetRef.current?.expand()} style={styles.deleteBtn} testID="delete-worker-btn">
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              <AppText size="sm" weight="semibold" color={COLORS.error}>{t("delete")}</AppText>
            </Pressable>
          ) : undefined
        }
      />
      {worker ? <WorkerDetail worker={worker} /> : <Loader />}

      <BottomSheet ref={sheetRef} index={-1} snapPoints={["38%"]} enablePanDownToClose keyboardBehavior="interactive" backgroundStyle={{ backgroundColor: COLORS.surfaceSecondary }}>
        <BottomSheetView style={{ padding: SPACING.lg }}>
          <AppText weight="bold" size="xl" style={{ marginBottom: SPACING.xs }}>{t("deleteConfirmTitle")}</AppText>
          <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.md }}>{t("deleteConfirmBody")}</AppText>
          <Button title={t("deleteRemove")} variant="danger" onPress={deleteWorker} loading={busy} testID="confirm-delete-btn" />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
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
