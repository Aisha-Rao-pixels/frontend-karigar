import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui";
import WorkerForm, { emptyValues, toPayload, WorkerFormValues } from "@/src/components/WorkerForm";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

export default function RegisterWorker() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const onSubmit = async (v: WorkerFormValues) => {
    setBusy(true);
    try {
      await apiFetch("/admin/workers", { method: "POST", body: { ...toPayload(v), mobile: v.mobile } });
      show(t("workerRegistered"), "success");
      router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard");
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t("registerNewWorker")} onBack={() => router.back()} />
      <WorkerForm
        initial={emptyValues()}
        submitLabel={t("registerWorker")}
        onSubmit={onSubmit}
        showMobile
        showReferral
        submitting={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.surface } });
