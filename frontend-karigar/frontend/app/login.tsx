import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { AppText, Button } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";

const isValidPassword = (pwd: string): { valid: boolean; message: string } => {
  if (pwd.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters" };
  }
  return { valid: true, message: "" };
};

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  // Referral code: pre-filled when the user arrived via a shared link
  // (?ref=CODE), but always editable so someone who was told the code
  // out loud (not via a link) has somewhere to type it in at signup —
  // previously the only referral field in the whole app was buried at
  // the end of the long profile form.
  const [referralCode, setReferralCode] = useState(ref || "");

  const routeUser = (u: { role: string; has_profile: boolean }) => {
    const effectiveRef = referralCode.trim() || ref;
    if (u.role === "karigar") {
      router.replace(
        u.has_profile
          ? "/(artisan)/dashboard"
          : `/profile-form?mode=create${effectiveRef ? `&ref=${effectiveRef}` : ""}`
      );
    } else {
      router.replace("/admin/dashboard");
    }
  };

  const handlePhoneChange = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setPhone(digitsOnly);
    if (digitsOnly.length === 1 && !/^[6-9]$/.test(digitsOnly)) {
      show("Mobile number must start with 6, 7, 8, or 9", "error");
    }
  };

  const handleForgotPassword = () => {
    if (Platform.OS === "web") {
      window.alert("Forgot Password feature is coming soon! Please contact our support team for help.");
    } else {
      Alert.alert(
        "Coming Soon",
        "Forgot Password feature is coming soon! Please contact our support team for help.",
        [{ text: "OK" }]
      );
    }
  };

  const handleSubmit = async () => {
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length !== 10) {
      show("Please enter a 10-digit mobile number", "error");
      return;
    }
    if (!/^[6-9]/.test(trimmedPhone)) {
      show("Mobile number must start with 6, 7, 8, or 9", "error");
      return;
    }
    const pwdCheck = isValidPassword(password);
    if (!pwdCheck.valid) {
      show(pwdCheck.message, "error");
      return;
    }
    setLoading(true);
    try {
      // Try login first — covers the common case of an existing user.
      const u = await login(trimmedPhone, password);
      routeUser(u);
    } catch (loginErr: any) {
      if (loginErr?.status === 401) {
        // No matching phone+password. Could be a brand new user — try
        // creating the account. If the phone turns out to already be
        // registered, we know it was really a wrong password below.
        try {
          const u = await register(trimmedPhone, password, "karigar", referralCode.trim() || undefined);
          routeUser(u);
        } catch (registerErr: any) {
          if (registerErr?.status === 400 && /already registered/i.test(registerErr.message || "")) {
            show("Incorrect password. Please try again.", "error");
          } else {
            show(registerErr.message || t("genericError"), "error");
          }
        }
      } else {
        show(loginErr.message || t("genericError"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + SPACING["3xl"], paddingBottom: SPACING["3xl"] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.push("/language")}
          hitSlop={10}
          style={styles.backBtn}
          testID="login-back-to-language-btn"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>

        <View style={styles.logoBadge}>
          <Ionicons name="cut" size={32} color={COLORS.onBrandPrimary} />
        </View>
        <AppText weight="bold" size="2xl" style={{ marginTop: SPACING.lg }}>
          {t("loginTitle")}
        </AppText>
        <AppText size="base" color={COLORS.muted} style={{ marginTop: 6, marginBottom: SPACING["2xl"] }}>
          Enter your mobile number and password to continue
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
            onChangeText={handlePhoneChange}
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
        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>
          {t("password")}
        </AppText>
        <View style={styles.pwdRow}>
          <TextInput
            testID="password-input"
            value={password}
            onChangeText={setPassword}
            placeholder={t("passwordPh")}
            placeholderTextColor={COLORS.muted}
            secureTextEntry={!showPwd}
            textContentType="password"
            autoComplete="current-password"
            style={styles.pwdInput}
          />
          <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10} style={styles.eyeBtn} testID="toggle-password">
            <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={COLORS.muted} />
          </Pressable>
        </View>
        <AppText size="sm" color={COLORS.muted} style={{ marginTop: 6 }}>
          {t("passwordMin6")}
        </AppText>

        {/* Referral code is captured silently from a shared link's ?ref=
            param (see `referralCode` state above) and sent along at signup —
            it is intentionally NOT shown as a field here. First-time users
            registering with just phone + password should not see an extra
            box; someone who arrives via a referral link never needs to type
            anything, it's already filled in behind the scenes. */}

        <Pressable
          onPress={handleForgotPassword}
          style={styles.forgotBtn}
          testID="forgot-password-btn"
        >
          <AppText size="sm" color={COLORS.brandPrimary} weight="semibold">
            Forgot Password?
          </AppText>
        </Pressable>

        <View style={{ height: SPACING.xl }} />
        <Button
          title="Create & Login"
          onPress={handleSubmit}
          loading={loading}
          icon="arrow-forward"
          testID="auth-submit-btn"
        />

        <Pressable onPress={() => router.push("/admin/login")} style={styles.adminLink} testID="go-admin-login">
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.muted} />
          <AppText size="sm" color={COLORS.muted} weight="semibold">
            {t("staffAdminLogin")}
          </AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  inner: { flex: 1, paddingHorizontal: SPACING.xl },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm, marginLeft: -8 },
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
  forgotBtn: { alignSelf: "flex-end", marginTop: SPACING.sm, padding: SPACING.sm },
  switchBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: SPACING.xl, padding: SPACING.sm },
  adminLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING["2xl"], padding: SPACING.md },
});
