import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, Loader, Button, AppText } from "@/src/components/ui";
import WorkerDetail from "@/src/components/WorkerDetail";
import { apiFetch } from "@/src/api/client";
import { Worker } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";

function formatDDMMYYYY(dateStr: string) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface RejectedWorker extends Worker {
  rejection_reason: string | null;
  rejected_by: string;
  rejected_at: string;
}

export default function RejectedProfileDetail() {
  const router = useRouter();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<RejectedWorker | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/admin/rejected-profiles"));

  useEffect(() => {
    apiFetch<RejectedWorker>(`/admin/rejected-profiles/${id}`)
      .then(setProfile)
      .catch(() => setNotFound(true));
  }, [id]);

  const restore = async () => {
    setBusy(true);
    try {
      await apiFetch(`/admin/rejected-profiles/${id}/restore`, { method: "POST" });
      show("Profile moved back to Pending Verification", "success");
      goBack();
    } catch (e: any) {
      show(e.message || "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Rejected Profile" onBack={goBack} />
        <View style={{ padding: SPACING.xl, alignItems: "center" }}>
          <AppText color={COLORS.muted}>This profile could not be found.</AppText>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Rejected Profile" onBack={goBack} />
        <Loader />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={profile.full_name} subtitle="Review Profile" onBack={goBack} />

      <View style={styles.reasonBanner}>
        <AppText size="sm" weight="semibold" color={COLORS.error}>
          {profile.rejection_reason === "Deleted by admin" ? "Deletion Reason" : "Rejection Reason"}
        </AppText>
        <AppText size="sm" style={{ marginTop: 2 }}>{profile.rejection_reason || "No reason given"}</AppText>
        <AppText size="sm" color={COLORS.muted} style={{ marginTop: 6 }}>
          By {profile.rejected_by} on {formatDDMMYYYY(profile.rejected_at)}
        </AppText>
      </View>

      <WorkerDetail worker={profile} contentBottom={100} />

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Button
          title="Move Back to Pending Verification"
          onPress={restore}
          loading={busy}
          icon="arrow-undo"
          testID="restore-profile-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  reasonBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.error + "0D",
    borderWidth: 1,
    borderColor: COLORS.error + "33",
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
});
