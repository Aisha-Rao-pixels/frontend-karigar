import React, { useState, useCallback } from "react";
import { View, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";

interface Admin {
  id: string;
  phone: string;
  name: string;
  admin_role: string;
  is_you: boolean;
}

export default function EditAdminSelf() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [initialName, setInitialName] = useState("");
  const [initialRole, setInitialRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard"));

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !user) return;
      let active = true;
      (async () => {
        try {
          const admins = await apiFetch<Admin[]>("/auth/admins");
          const me = admins.find((a) => a.is_you);
          if (active && me) {
            setPhone(me.phone);
            setName(me.name || "");
            setAdminRole(me.admin_role || "");
            setInitialName(me.name || "");
            setInitialRole(me.admin_role || "");
          }
        } catch (e: any) {
          show(e.message || "Could not load your details", "error");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [ authLoading, user ])
  );

  const hasChanges = name.trim() !== initialName || adminRole.trim() !== initialRole;

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        "Discard changes?",
        "Your edits will not be saved.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: goBack },
        ]
      );
    } else {
      goBack();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { show("Name is required", "error"); return; }
    if (!adminRole.trim()) { show("Role is required", "error"); return; }

    setBusy(true);
    try {
      await apiFetch("/auth/admin/me", {
        method: "PATCH",
        body: { name: name.trim(), admin_role: adminRole.trim() },
      });
      show("Your details were updated", "success");
      goBack();
    } catch (e: any) {
      show(e.message || "Something went wrong. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loaderWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Edit My Details</AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: 2 }}>You can only update your own profile</AppText>
        </View>
      </View>

      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        <View style={[styles.card, shadow]}>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <AppText weight="semibold" size="sm" style={styles.label}>Full Name <AppText style={styles.required}>*</AppText></AppText>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Priya Sharma"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                testID="edit-self-name"
              />
            </View>
          </View>

          <View style={styles.fieldDivider} />

          {/* Role */}
          <View style={styles.fieldGroup}>
            <AppText weight="semibold" size="sm" style={styles.label}>Role <AppText style={styles.required}>*</AppText></AppText>
            <View style={styles.inputWrap}>
              <Ionicons name="briefcase-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                value={adminRole}
                onChangeText={setAdminRole}
                placeholder="e.g. Manager, Verifier"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                testID="edit-self-role"
              />
            </View>
          </View>

          <View style={styles.fieldDivider} />

          {/* Mobile — read only */}
          <View style={styles.fieldGroup}>
            <AppText weight="semibold" size="sm" style={styles.label}>Mobile Number</AppText>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.surfaceTertiary }]}>
              <View style={styles.ccBadge}>
                <AppText weight="semibold" size="sm" style={{ color: COLORS.onSurface }}>+91</AppText>
              </View>
              <AppText size="base" style={{ color: COLORS.muted, marginLeft: SPACING.sm }}>{phone}</AppText>
            </View>
          </View>
        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
          <AppText size="sm" style={{ color: COLORS.muted, flex: 1, marginLeft: SPACING.sm }}>
            Mobile number and password can't be changed here. Contact a Manager if you need those updated.
          </AppText>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={handleCancel} testID="cancel-edit-self">
            <AppText weight="semibold" size="base" style={{ color: COLORS.onSurface }}>Cancel</AppText>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, busy && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={busy}
            testID="save-edit-self"
          >
            <Ionicons name="checkmark" size={18} color={COLORS.onBrandPrimary} />
            <AppText weight="semibold" size="base" style={{ color: COLORS.onBrandPrimary, marginLeft: 6 }}>
              {busy ? "Saving..." : "Save Changes"}
            </AppText>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loaderWrap: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  body: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING["2xl"] },

  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  fieldGroup: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  fieldDivider: { height: 1, backgroundColor: COLORS.divider },

  label: { color: COLORS.onSurface, marginBottom: 4 },
  required: { color: COLORS.error },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    height: 40,
  },
  inputIcon: { paddingLeft: SPACING.sm },
  input: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT.base,
    color: COLORS.onSurface,
    height: "100%",
  },
  ccBadge: {
    height: 40,
    paddingHorizontal: SPACING.sm,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.surfaceTertiary,
    borderTopLeftRadius: RADIUS.md,
    borderBottomLeftRadius: RADIUS.md,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  actions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.sm },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
