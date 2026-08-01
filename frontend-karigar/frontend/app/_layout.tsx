import { Stack, usePathname, useGlobalSearchParams } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

function formWidthFor(windowWidth: number): number | "100%" {
  if (windowWidth < 480) return "100%"; // phone browser
  if (windowWidth < 900) return 620; // tablet
  return 480; // laptop / desktop — paired with the brand side panel
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const pathname = usePathname();
  const { width: windowWidth } = useWindowDimensions();
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

  const isAdminSection = Platform.OS === "web" && pathname?.startsWith("/admin") && pathname !== "/admin/login";
  const isLoginPage = pathname === "/login" || pathname === "/admin/login";
  const isAdminLogin = pathname === "/admin/login";
  const showSplitLogin = Platform.OS === "web" && isLoginPage && windowWidth >= 900;

  const content = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FCFAF8" } }} />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <ToastProvider>
              <OfflineHandler exempt={pathname === "/profile-form"}>
                <StatusBar style="dark" />
                {showSplitLogin ? (
                  <View style={styles.splitOuter}>
                    <View style={[styles.brandPanel, isAdminLogin && styles.brandPanelAdmin]}>
                      <View style={styles.brandMark}>
                        <Ionicons name={isAdminLogin ? "shield-checkmark" : "hammer"} size={32} color={isAdminLogin ? "#1A1817" : "#FFFFFF"} />
                      </View>
                      <View style={styles.brandTextWrap}>
                        <Text style={[styles.brandTitle, isAdminLogin && styles.brandTitleAdmin]}>
                          {isAdminLogin ? "Karigar Admin" : "Karigar"}
                        </Text>
                        <Text style={[styles.brandTagline, isAdminLogin && styles.brandTaglineAdmin]}>
                          {isAdminLogin
                            ? "Verify, manage, and support the workforce from one place."
                            : "Find skilled workers near you, or list your own skills for work."}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.webInner, { maxWidth: formWidthFor(windowWidth), flex: undefined, width: formWidthFor(windowWidth) as any }]}>
                      {content}
                    </View>
                  </View>
                ) : (
                  <View style={styles.webOuter}>
                    <View
                      style={[
                        styles.webInner,
                        isAdminSection ? styles.webInnerAdmin : Platform.OS === "web" ? { maxWidth: formWidthFor(windowWidth) } : null,
                      ]}
                    >
                      {content}
                    </View>
                  </View>
                )}
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
  splitOuter: { flex: 1, flexDirection: "row" as const, backgroundColor: "#FCFAF8" },
  brandPanel: {
    flex: 1,
    backgroundColor: "#A35C3A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 48,
  },
  brandPanelAdmin: { backgroundColor: "#1A1817" },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  brandTextWrap: { marginTop: 24, maxWidth: 360 },
  brandTitle: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", textAlign: "center" as const },
  brandTitleAdmin: { color: "#FFFFFF" },
  brandTagline: { fontSize: 16, color: "rgba(255,255,255,0.8)", textAlign: "center" as const, marginTop: 10, lineHeight: 22 },
  brandTaglineAdmin: { color: "rgba(255,255,255,0.7)" },
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
    maxWidth: "100%",
    width: "100%",
    shadowOpacity: 0,
  },
});
