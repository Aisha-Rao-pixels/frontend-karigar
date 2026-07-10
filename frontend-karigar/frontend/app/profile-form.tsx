import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "@/src/theme";
import { ScreenHeader, Loader } from "@/src/components/ui";
import WorkerForm, { emptyValues, fromWorker, toPayload, WorkerFormValues } from "@/src/components/WorkerForm";
import { apiFetch } from "@/src/api/client";
import { Worker } from "@/src/utils/profile";
import { useAuth } from "@/src/context/AuthContext";
import { storage } from "@/src/utils/storage";
import { useToast } from "@/src/components/Toast";
export default function ProfileFormScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { mode, ref } = useLocalSearchParams<{ mode: string; ref?: string }>();
  const isEdit = mode === "edit";
  const { setHasProfile, refresh } = useAuth();
  const [initial, setInitial] = useState<WorkerFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (isEdit) {
      apiFetch<Worker>("/workers/me")
        .then((w) => setInitial(fromWorker(w)))
        .catch(() => {
          show(t("genericError"), "error");
          setInitial(emptyValues());
        });
    } else {
      (async () => {
        const savedRef = ref || (await storage.getItem("pending_ref", ""));
        if (savedRef) storage.removeItem("pending_ref");
        setInitial({ ...emptyValues(), referred_by_code: savedRef || "" });
      })();
    }
  }, [isEdit]);
  const handleSubmit = async (v: WorkerFormValues) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiFetch("/workers/me", { method: "PUT", body: toPayload(v) });
        show(t("profileUpdated"), "success");
        router.back();
      } else {
        await apiFetch("/workers", { method: "POST", body: toPayload(v) });
        setHasProfile(true);
        await refresh();
        show(t("profileSubmitted"), "success");
        router.replace("/(artisan)/dashboard");
      }
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={isEdit ? t("editProfile") : t("createProfile")}
        onBack={isEdit ? () => router.back() : undefined}
      />
      {initial ? (
        <WorkerForm
          initial={initial}
          submitLabel={isEdit ? t("saveChanges") : t("submitForReview")}
          onSubmit={handleSubmit}
          showReferral={!isEdit}
          submitting={submitting}
        />
      ) : (
        <Loader />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
});
