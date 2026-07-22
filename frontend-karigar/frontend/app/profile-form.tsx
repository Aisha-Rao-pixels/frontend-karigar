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
import NetInfo from "@react-native-community/netinfo";
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

  // If a submission was saved while offline (see handleSubmit's catch
  // block below), send it the moment the connection comes back — the
  // worker doesn't need to press submit again.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (!(state.isConnected && state.isInternetReachable)) return;
      const raw = await storage.getItem("pending_submission", "");
      if (!raw) return;
      try {
        const { isEdit: pendingIsEdit, payload } = JSON.parse(raw);
        if (pendingIsEdit) {
          await apiFetch("/workers/me", { method: "PUT", body: payload });
          show(t("profileUpdated"), "success");
        } else {
          await apiFetch("/workers", { method: "POST", body: payload });
          setHasProfile(true);
          await refresh();
          show(t("profileSubmitted"), "success");
        }
        await storage.removeItem("pending_submission");
      } catch {
        // Still failing for a real reason (not just connectivity) — leave
        // it saved so the next reconnect (or a manual resubmit) can retry.
      }
    });
    return () => unsubscribe();
  }, []);
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
        const created: any = await apiFetch("/workers", { method: "POST", body: toPayload(v) });
        setHasProfile(true);
        await refresh();
        show(t("profileSubmitted"), "success");
        const title = created.gender === "female" ? "Mrs." : "Mr.";
        Alert.alert(
          "Registration Successful",
          `${title} ${created.full_name}, this is your ID: ${created.worker_id}`
        );
        router.replace("/(artisan)/dashboard");
      }
    } catch (e: any) {
      // status 0 = the request never reached the server (no internet), as
      // opposed to a real server-side error (duplicate phone, etc). Save it
      // so it sends itself the moment connection comes back, instead of
      // making the worker sit there retrying or losing what they filled in.
      if (e.status === 0) {
        await storage.setItem("pending_submission", JSON.stringify({ isEdit, payload: toPayload(v) }));
        show("No internet — this will be sent automatically once you're back online.", "info");
      } else {
        show(e.message || t("genericError"), "error");
      }
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
