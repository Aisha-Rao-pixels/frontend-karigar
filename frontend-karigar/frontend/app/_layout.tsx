import { Stack, usePathname, useGlobalSearchParams } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { AppThemeProvider } from "@/src/context/ThemeContext";
import { ToastProvider } from "@/src/components/Toast";
import OfflineHandler from "@/src/components/OfflineHandler";
import { storage } from "@/src/utils/storage";
import "@/src/i18n";
import { loadSavedLanguage } from "@/src/i18n";
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const pathname = usePathname();
  const { ref } = useGlobalSearchParams<{ ref?: string }>();
  useEffect(() => {
    if (!ref) return;
    storage.setItem("pending_ref", ref);
    const trackedKey = `tracked_ref_${ref}`;
    storage.getItem(trackedKey, false).then((already) => {
      if (!already) {
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL ?? ""}/api/referrals/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referral_code: ref }),
        }).catch(() => {});
        storage.setItem(trackedKey, true);
      }
    });
  }, [ref]);
  useEffect(() => {
    loadSavedLanguage();
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("karigar-font-inter")) return;
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    const fontLink = document.createElement("link");
    fontLink.id = "karigar-font-inter";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(fontLink);
  }, []);
  useEffect(() => {
    if (pathname && pathname !== "/") {
      storage.setItem("last_path", pathname);
    }
  }, [pathname]);
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <ToastProvider>
              <OfflineHandler exempt={pathname === "/profile-form"}>
                <StatusBar style="dark" />
                <View style={styles.webOuter}>
                  <View style={[styles.webInner, Platform.OS === "web" && pathname?.startsWith("/admin") && styles.webInnerAdmin]}>
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FCFAF8" } }} />
                  </View>
                </View>
              </OfflineHandler>
            </ToastProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  webOuter:
    Platform.OS === "web"
      ? { flex: 1, backgroundColor: "#EDE7E1", alignItems: "center" as const }
      : { flex: 1 },
  webInner:
    Platform.OS === "web"
      ? {
          flex: 1,
          width: "100%",
          maxWidth: 560,
          backgroundColor: "#FCFAF8",
          shadowColor: "#1A1817",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.08,
          shadowRadius: 40,
        }
      : { flex: 1 },
  webInnerAdmin: {
    maxWidth: 1100,
  },
});
