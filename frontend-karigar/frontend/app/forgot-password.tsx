import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { AppText, Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { apiFetch, ApiError } from "@/src/api/client";

type Stage = "phone" | "code" | "password";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const isAdmin = role === "admin";
  const loginPath = isAdmin ? "/admin/login" : "/login";

  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (text: string) => {
    setPhone(text.replace(/[^0-9]/g, ""));
  };

  const requestCode = async () => {
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length !== 10) {
      show("Please enter a 10-digit mobile number", "error");
      return;
    }
    if (!/^[6-9]/.test(trimmedPhone)) {
      show("Mobile number must start with 6, 7, 8, or 9", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ code: string }>("/auth/forgot-password/request", {
        method: "POST",
        body: { phone: trimmedPhone },
        auth: false,
      });
      setGeneratedCode(res.code);
      setEnteredCode("");
      setStage("code");
    } catch (e: any) {
      show(e instanceof ApiError ? e.message : "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = () => {
    if (enteredCode.trim().length !== 6) {
      show("Please enter the 6-digit code shown above", "error");
      return;
    }
    if (enteredCode.trim() !== generatedCode) {
      show("That code doesn't match. Please try again.", "error");
      return;
    }
    setStage("password");
  };

  const submitNewPassword = async () => {
    if (newPassword.length < 6) {
      show("Password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      show("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password/reset", {
        method: "POST",
        body: { phone: phone.trim(), code: enteredCode.trim(), new_password: newPassword },
        auth: false,
      });
      show("Password updated! Please log in with your new password.", "success");
      router.replace(loginPath as any);
    } catch (e: any) {
      show(e instanceof ApiError ? e.message : "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (stage === "phone") {
      router.replace(loginPath as any);
    } else if (stage === "code") {
      setStage("phone");
    } else {
      setStage("code");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + SPACING["3xl"], paddingBottom: SPACING["3xl"] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn} testID="forgot-password-back-btn">
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>

        <View style={styles.logoBadge}>
          <Ionicons name="key" size={32} color={COLORS.onBrandPrimary} />
        </View>
        <AppText weight="bold" size="2xl" style={{ marginTop: SPACING.lg }}>
          Reset Password
        </AppText>

        {stage === "phone" && (
          <>
            <AppText size="base" color={COLORS.muted} style={{ marginTop: 6, marginBottom: SPACING["2xl"] }}>
              Enter your registered mobile number to continue
            </AppText>
            <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>Mobile Number</AppText>
            <View style={styles.phoneRow}>
              <View style={styles.cc}>
                <AppText weight="semibold">+91</AppText>
              </View>
              <TextInput
                testID="forgot-password-phone-input"
                value={phone}
                onChangeText={handlePhoneChange}
                placeholder="Enter mobile number"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.phoneInput}
              />
            </View>
            <View style={{ height: SPACING.xl }} />
            <Button title="Continue" onPress={requestCode} loading={loading} icon="arrow-forward" testID="forgot-password-request-btn" />
          </>
        )}

        {stage === "code" && (
          <>
            <AppText size="base" color={COLORS.muted} style={{ marginTop: 6, marginBottom: SPACING["2xl"] }}>
              Here is your verification code. Enter it below to confirm it's you.
            </AppText>
            <View style={styles.codeDisplay} testID="forgot-password-generated-code">
              <AppText weight="bold" size="2xl" style={styles.codeDisplayText}>
                {generatedCode}
              </AppText>
            </View>
            <View style={{ height: SPACING.lg }} />
            <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>Enter the code above</AppText>
            <TextInput
              testID="forgot-password-code-input"
              value={enteredCode}
              onChangeText={(t) => setEnteredCode(t.replace(/[^0-9]/g, ""))}
              placeholder="6-digit code"
              placeholderTextColor={COLORS.muted}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.codeInput}
            />
            <View style={{ height: SPACING.xl }} />
            <Button title="Verify Code" onPress={verifyCode} icon="checkmark" testID="forgot-password-verify-btn" />
          </>
        )}

        {stage === "password" && (
          <>
            <AppText size="base" color={COLORS.muted} style={{ marginTop: 6, marginBottom: SPACING["2xl"] }}>
              Choose a new password for your account
            </AppText>
            <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>New Password</AppText>
            <View style={styles.pwdRow}>
              <TextInput
                testID="forgot-password-new-password-input"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPwd}
                style={styles.pwdInput}
              />
              <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10} style={styles.eyeBtn} testID="forgot-password-toggle-pwd">
                <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <AppText size="sm" color={COLORS.muted} style={{ marginTop: 6, marginBottom: SPACING.lg }}>
              Must be at least 6 characters
            </AppText>

            <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>Confirm Password</AppText>
            <TextInput
              testID="forgot-password-confirm-password-input"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showPwd}
              style={styles.pwdInputStandalone}
            />

            <View style={{ height: SPACING.xl }} />
            <Button title="Update Password" onPress={submitNewPassword} loading={loading} icon="checkmark" testID="forgot-password-submit-btn" />
          </>
        )}
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
  codeDisplay: {
    height: 72,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandPrimary + "12",
    borderWidth: 1,
    borderColor: COLORS.brandPrimary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  codeDisplayText: { letterSpacing: 8, color: COLORS.brandPrimary },
  codeInput: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceSecondary,
    letterSpacing: 4,
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
  pwdInputStandalone: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.lg,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceSecondary,
  },
  eyeBtn: { position: "absolute", right: SPACING.md, height: 52, justifyContent: "center" },
});
