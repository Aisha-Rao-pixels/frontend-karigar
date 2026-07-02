import React, { useEffect, useState } from "react";
import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { AppText, Button } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { apiFetch } from "@/src/api/client";

export default function AdminLogin() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { login, register, logout } = useAuth();
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ exists: boolean }>("/auth/admin/exists", { auth: false })
      .then((r) => {
        setAdminExists(r.exists);
        setMode(r.exists ? "login" : "register");
      })
      .catch(() => setAdminExists(true));
  }, []);

  const isRegister = mode === "register";

  const submit = async () => {
    if (phone.trim().length < 10) {
      show(t("enterMobile"), "error");
      return;
    }
    if (password.length < 6) {
      show(t("passwordMin6"), "error");
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register(phone.trim(), password, "admin");
        router.replace("/admin/dashboard");
      } else {
        const u = await login(phone.trim(), password);
        if (u.role !== "admin") {
          await logout();
          show(t("notStaffAccount"), "error");
          return;
        }
        router.replace("/admin/dashboard");
      }
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: insets.top + SPACING.xl }]}>
        <Pressable onPress={() => router.replace("/login")} style={styles.back} hitSlop={10} testID="admin-back-to-artisan">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.logoBadge}>
          <Ionicons name="shield-checkmark" size={30} color={COLORS.onBrandPrimary} />
        </View>
        <AppText weight="bold" size="2xl" color="#fff" style={{ marginTop: SPACING.md }}>
          {t("staffPortal")}
        </AppText>
        <AppText size="base" color="rgba(255,255,255,0.75)" style={{ marginTop: 4 }}>
          {isRegister ? t("setupFirstAdmin") : t("adminAccessOnly")}
        </AppText>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        {isRegister && (
          <View style={styles.firstAdminHint} testID="first-admin-hint">
            <Ionicons name="key" size={18} color={COLORS.brandPrimary} />
            <AppText size="sm" color={COLORS.onSurfaceTertiary} style={{ flex: 1 }}>
              {t("firstAdminHint")}
            </AppText>
          </View>
        )}

        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("mobileNumber")}</AppText>
        <View style={styles.phoneRow}>
          <View style={styles.cc}><AppText weight="semibold">+91</AppText></View>
          <TextInput
            testID="admin-phone-input"
            value={phone}
            onChangeText={(x) => setPhone(x.replace(/[^0-9]/g, ""))}
            placeholder={t("enterMobile")}
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
            maxLength={10}
            textContentType="telephoneNumber"
            autoComplete="tel"
            style={styles.phoneInput}
          />
        </View>

        <View style={{ height: SPACING.lg }} />
        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("password")}</AppText>
        <View style={styles.pwdRow}>
          <TextInput
            testID="admin-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder={isRegister ? t("passwordCreatePh") : t("passwordPh")}
            placeholderTextColor={COLORS.muted}
            secureTextEntry={!showPwd}
            style={styles.pwdInput}
          />
          <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10} style={styles.eyeBtn} testID="admin-toggle-password">
            <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={COLORS.muted} />
          </Pressable>
        </View>

        <View style={{ height: SPACING.xl }} />
        <Button
          title={isRegister ? t("createAdminAccount") : t("loginCta")}
          onPress={submit}
          loading={loading || adminExists === null}
          icon="arrow-forward"
          testID="admin-submit-btn"
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { backgroundColor: COLORS.surfaceInverse, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg },
  back: { position: "absolute", left: SPACING.md, top: SPACING.xl, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  logoBadge: { width: 60, height: 60, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: SPACING.lg },
  body: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING["2xl"] },
  firstAdminHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandPrimary + "12",
    borderWidth: 1,
    borderColor: COLORS.brandPrimary + "33",
  },
  phoneRow: { flexDirection: "row", gap: SPACING.sm },
  cc: { height: 52, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  phoneInput: { flex: 1, height: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: FONT.lg, color: COLORS.onSurface, backgroundColor: COLORS.surfaceSecondary },
  pwdRow: { flexDirection: "row", alignItems: "center" },
  pwdInput: { flex: 1, height: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingRight: 44, fontSize: FONT.lg, color: COLORS.onSurface, backgroundColor: COLORS.surfaceSecondary },
  eyeBtn: { position: "absolute", right: SPACING.md, height: 52, justifyContent: "center" },
});
