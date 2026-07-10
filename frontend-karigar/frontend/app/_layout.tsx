import { Stack, usePathname, useGlobalSearchParams } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { ToastProvider } from "@/src/components/Toast";
import OfflineHandler from "@/src/components/OfflineHandler";
import { storage } from "@/src/utils/storage";
import "@/src/i18n";
import { loadSavedLanguage } from "@/src/i18n";
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const pathname = usePathname();
  useEffect(() => {
    loadSavedLanguage();
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
        <BottomSheetModalProvider>
          <AuthProvider>
            <ToastProvider>
              <OfflineHandler>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FCFAF8" } }} />
              </OfflineHandler>
            </ToastProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
