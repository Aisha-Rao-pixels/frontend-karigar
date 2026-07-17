import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText } from "@/src/components/ui";

interface Props {
  children: React.ReactNode;
  exempt?: boolean;
}
export default function OfflineHandler({ children, exempt = false }: Props) {
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable);
      setIsOffline(offline);
      if (offline) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRetry = useCallback(async () => {
    setChecking(true);
    const state = await NetInfo.fetch();
    const offline = !(state.isConnected && state.isInternetReachable);
    setIsOffline(offline);
    setChecking(false);
  }, []);

  if (!isOffline) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={56} color={COLORS.brandPrimary} />
        </View>
        <AppText weight="bold" size="2xl" style={styles.title}>
          No Internet Connection
        </AppText>
        <AppText size="base" color={COLORS.muted} style={styles.subtitle}>
          Please check your WiFi or mobile data and try again.
        </AppText>
        <Pressable
          onPress={handleRetry}
          style={[styles.retryBtn, checking && styles.retryBtnDisabled]}
          disabled={checking}
        >
          <Ionicons
            name={checking ? "refresh" : "refresh-outline"}
            size={20}
            color="#fff"
          />
          <AppText weight="bold" color="#fff" size="base">
            {checking ? "Checking..." : "Try Again"}
          </AppText>
        </Pressable>
        <AppText size="sm" color={COLORS.muted} style={styles.hint}>
          The app will automatically reconnect when internet is available.
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING["2xl"],
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: SPACING.sm,
    color: COLORS.onSurface,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING["2xl"],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  retryBtnDisabled: {
    opacity: 0.6,
  },
  hint: {
    textAlign: "center",
    lineHeight: 18,
  },
});
