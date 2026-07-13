import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { ScreenHeader, AppText, Button, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

interface Admin {
  id: string;
  phone: string;
  name: string;
  admin_role: string;
  created_at?: string;
  is_you: boolean;
}

export default function ManageAdmins() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await apiFetch<Admin[]>("/auth/admins");
      setAdmins(a);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (phone.trim().length < 10) {
      show(t("enterMobile"), "error");
      return;
    }
    if (password.length < 6) {
      show(t("passwordMin6"), "error");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/admin/create", {
        method: "POST",
        body: { phone: phone.trim(), password, name: name.trim(), admin_role: adminRole.trim() || "Admin" },
      });
      setPhone("");
      setPassword("");
      setName("");
      setAdminRole("");
      show(t("adminAdded"), "success");
      load();
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t("manageAdmins")} onBack={() => router.back()} />

      <View style={styles.form}>
        <AppText weight="semibold" size="base" style={{ marginBottom: SPACING.sm }}>
          {t("addNewAdmin")}
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("adminNamePh")}
          placeholderTextColor={COLORS.muted}
          style={[styles.input, { marginBottom: SPACING.sm }]}
          testID="new-admin-name-input"
        />
        <TextInput
          value={adminRole}
          onChangeText={setAdminRole}
          placeholder={t("adminRolePh")}
          placeholderTextColor={COLORS.muted}
          style={[styles.input, { marginBottom: SPACING.sm }]}
          testID="new-admin-role-input"
        />
        <View style={styles.phoneRow}>
          <View style={styles.cc}><AppText weight="semibold">+91</AppText></View>
          <TextInput
            value={phone}
            onChangeText={(x) => setPhone(x.replace(/[^0-9]/g, ""))}
            placeholder={t("enterMobile")}
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.input}
            testID="new-admin-phone-input"
          />
        </View>
        <View style={{ height: SPACING.sm }} />
        <View style={styles.pwdRow}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("passwordCreatePh")}
            placeholderTextColor={COLORS.muted}
            secureTextEntry={!showPwd}
            style={[styles.input, { paddingRight: 44 }]}
            testID="new-admin-password-input"
          />
          <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10} style={styles.eyeBtn} testID="new-admin-toggle-password">
            <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={COLORS.muted} />
          </Pressable>
        </View>
        <View style={{ height: SPACING.md }} />
        <Button title={t("addAdmin")} onPress={add} loading={busy} icon="person-add" testID="add-admin-submit-btn" />
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(a) => a.id}
          ListHeaderComponent={
            <AppText weight="semibold" color={COLORS.muted} size="sm" style={{ marginBottom: SPACING.sm }}>
              {t("existingAdmins", { count: admins.length })}
            </AppText>
          }
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING["2xl"] }}
          renderItem={({ item }) => (
            <View style={[styles.adminRow, shadow]} testID={`admin-row-${item.id}`}>
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">{item.name || "+91 " + item.phone}</AppText>
                <AppText size="sm" color={COLORS.muted}>{item.admin_role || t("administrator")} · +91 {item.phone}</AppText>
              </View>
              {item.is_you && (
                <View style={styles.youBadge}>
                  <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{t("you")}</AppText>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  form: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  phoneRow: { flexDirection: "row", gap: SPACING.sm },
  pwdRow: { flexDirection: "row", alignItems: "center" },
  cc: { height: 52, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, height: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: FONT.lg, color: COLORS.onSurface, backgroundColor: COLORS.surfaceSecondary },
  eyeBtn: { position: "absolute", right: SPACING.md, height: 52, justifyContent: "center" },
  adminRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md },
  adminIcon: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.brandTertiary, alignItems: "center", justifyContent: "center" },
  youBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.brandTertiary },
});
