import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { AppText, Button } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const routeUser = (u: { role: string; has_profile: boolean }) => {
    if (u.role === "karigar") {
      router.replace(u.has_profile ? "/(artisan)/dashboard" : "/profile-form?mode=create");
    } else {
      router.replace("/admin/dashboard");
    }
  };

 const handleSubmit = async () => {
    if (phone.trim().length !== 10 || !/^[6-9]\d{9}$/.test(phone.trim())) {
      show(t("enterMobile"), "error");
      return;
    }
    if (password.length < 6) {
      show(t("passwordMin6"), "error");
      return;
    }
    setLoading(true);
    try {
      const u =
        mode === "login"
          ? await login(phone.trim(), password)
          : await register(phone.trim(), password, "karigar");
      routeUser(u);
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "register";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top + SPACING["3xl"] }]}>
        <View style={styles.logoBadge}>
          <Ionicons name="cut" size={32} color={COLORS.onBrandPrimary} />
        </View>
        <AppText weight="bold" size="2xl" style={{ marginTop: SPACING.lg }}>
          {isRegister ? t("createAccount") : t("loginTitle")}
        </AppText>
        <AppText size="base" color={COLORS.muted} style={{ marginTop: 6, marginBottom: SPACING["2xl"] }}>
          {isRegister ? t("registerSubtitle") : t("loginSubtitle")}
        </AppText>

        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>
          {t("mobileNumber")}
        </AppText>
        <View style={styles.phoneRow}>
          <View style={styles.cc}>
            <AppText weight="semibold">+91</AppText>
          </View>
          <TextInput
            testID="phone-input"
            value={phone}
            onChangeText={(x) => setPhone(x.replace(/[^0-9]/g, ""))}
            placeholder={t("enterMobile")}
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.phoneInput}
          />
        </View>

        <View style={{ height: SPACING.lg }} />
        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>
          {t("password")}
        </AppText>
        <View style={styles.pwdRow}>
          <TextInput
            testID="password-input"
            value={password}
            onChangeText={setPassword}
            placeholder={isRegister ? t("passwordCreatePh") : t("passwordPh")}
            placeholderTextColor={COLORS.muted}
            secureTextEntry={!showPwd}
            style={styles.pwdInput}
          />
          <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10} style={styles.eyeBtn} testID="toggle-password">
            <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={COLORS.muted} />
          </Pressable>
        </View>
        {isRegister && (
          <AppText size="sm" color={COLORS.muted} style={{ marginTop: 6 }}>
            {t("passwordMin6")}
          </AppText>
        )}

        <View style={{ height: SPACING.xl }} />
        <Button
          title={isRegister ? t("createAccount") : t("loginCta")}
          onPress={handleSubmit}
          loading={loading}
          icon="arrow-forward"
          testID="auth-submit-btn"
        />

        <Pressable
          onPress={() => setMode(isRegister ? "login" : "register")}
          style={styles.switchBtn}
          testID="toggle-auth-mode"
        >
          <AppText size="sm" color={COLORS.muted}>
            {isRegister ? t("haveAccount") : t("noAccount")}{" "}
          </AppText>
          <AppText size="sm" color={COLORS.brandPrimary} weight="semibold">
            {isRegister ? t("loginCta") : t("createAccount")}
          </AppText>
        </Pressable>

        <Pressable onPress={() => router.push("/admin/login")} style={styles.adminLink} testID="go-admin-login">
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.muted} />
          <AppText size="sm" color={COLORS.muted} weight="semibold">
            {t("staffAdminLogin")}
          </AppText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  inner: { flex: 1, paddingHorizontal: SPACING.xl },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneRow: { flexDirection: "row", gap: SPACING.sm },
  cc: {
    height: 52,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceSecondary,
  },
  pwdRow: { flexDirection: "row", alignItems: "center" },
  pwdInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingRight: 44,
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceSecondary,
  },
  eyeBtn: { position: "absolute", right: SPACING.md, height: 52, justifyContent: "center" },
  switchBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: SPACING.xl, padding: SPACING.sm },
  adminLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING["2xl"], padding: SPACING.md },
});
