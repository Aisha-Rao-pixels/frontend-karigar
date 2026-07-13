import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

export default function AddAdmin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [name, setName] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCancel = () => {
    const hasData = name || adminRole || phone || password;
    if (hasData) {
      Alert.alert(
        "Discard changes?",
        "The details you entered will not be saved.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { show("Name is required", "error"); return; }
    if (!adminRole.trim()) { show("Role is required", "error"); return; }
    if (phone.trim().length < 10) { show("Enter a valid 10-digit mobile number", "error"); return; }
    if (password.length < 6) { show("Password must be at least 6 characters", "error"); return; }

    setBusy(true);
    try {
      await apiFetch("/auth/admin/create", {
        method: "POST",
        body: {
          phone: phone.trim(),
          password,
          name: name.trim(),
          admin_role: adminRole.trim(),
        },
      });
      show("Admin added successfully", "success");
      router.back();
    } catch (e: any) {
      show(e.message || "Something went wrong. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Add New Admin</AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: 2 }}>Fill in the details below</AppText>
        </View>
      </View>

      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* ── Form Card ── */}
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
                testID="add-admin-name"
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
                testID="add-admin-role"
              />
            </View>
          </View>

          <View style={styles.fieldDivider} />

          {/* Mobile */}
          <View style={styles.fieldGroup}>
            <AppText weight="semibold" size="sm" style={styles.label}>Mobile Number <AppText style={styles.required}>*</AppText></AppText>
            <View style={styles.inputWrap}>
              <View style={styles.ccBadge}>
                <AppText weight="semibold" size="sm" style={{ color: COLORS.onSurface }}>+91</AppText>
              </View>
              <TextInput
                value={phone}
                onChangeText={(x) => setPhone(x.replace(/[^0-9]/g, ""))}
                placeholder="10-digit mobile number"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                maxLength={10}
                style={[styles.input, { paddingLeft: SPACING.sm }]}
                testID="add-admin-phone"
              />
            </View>
          </View>

          <View style={styles.fieldDivider} />

          {/* Password */}
          <View style={styles.fieldGroup}>
            <AppText weight="semibold" size="sm" style={styles.label}>Password <AppText style={styles.required}>*</AppText></AppText>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 characters"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPwd}
                style={[styles.input, { paddingRight: 44 }]}
                testID="add-admin-password"
              />
              <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10} style={styles.eyeBtn}>
                <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.muted} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Info note ── */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
          <AppText size="sm" style={{ color: COLORS.muted, flex: 1, marginLeft: SPACING.sm }}>
            The new admin will be able to log in immediately using these credentials.
          </AppText>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={handleCancel} testID="cancel-add-admin">
            <AppText weight="semibold" size="base" style={{ color: COLORS.onSurface }}>Cancel</AppText>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, busy && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={busy}
            testID="save-add-admin"
          >
            <Ionicons name="checkmark" size={18} color={COLORS.onBrandPrimary} />
            <AppText weight="semibold" size="base" style={{ color: COLORS.onBrandPrimary, marginLeft: 6 }}>
              {busy ? "Saving..." : "Save Admin"}
            </AppText>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

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
  eyeBtn: { position: "absolute", right: SPACING.sm, height: 40, justifyContent: "center" },
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
