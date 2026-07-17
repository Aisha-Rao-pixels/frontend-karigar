import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/src/theme";
import { ScreenHeader, Loader, AppText } from "@/src/components/ui";
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
  const { setHasProfile, refresh, logout } = useAuth();

  // A user lands here right after creating their account, before they have
  // a worker profile — login->here replaces history, so there is no earlier
  // screen for a normal "back" to return to and they were previously stuck
  // with no way out until the whole form was filled in. This lets them
  // leave (logging them out) and come straight back to login/home whenever
  // they want; next time they log in they'll simply be brought back here
  // since their profile still isn't created.
  const confirmExit = () => {
    const doExit = async () => {
      await logout();
      router.replace("/login");
    };
    if (Platform.OS === "web") {
      if (window.confirm(t("exitRegistrationConfirm"))) doExit();
    } else {
      Alert.alert(t("exitRegistrationTitle"), t("exitRegistrationConfirm"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("exit"), style: "destructive", onPress: doExit },
      ]);
    }
  };
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
        right={
          !isEdit ? (
            <Pressable onPress={confirmExit} testID="exit-registration-btn" style={styles.exitBtn} hitSlop={10}>
              <Ionicons name="exit-outline" size={18} color={COLORS.error} />
              <AppText size="sm" weight="semibold" color={COLORS.error}>{t("exit")}</AppText>
            </Pressable>
          ) : undefined
        }
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
  exitBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
});
