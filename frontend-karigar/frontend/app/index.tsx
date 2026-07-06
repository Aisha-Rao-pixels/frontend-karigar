import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { LANG_KEY } from "@/src/i18n";
import { useAuth } from "@/src/context/AuthContext";
import { Loader } from "@/src/components/ui";
import { View } from "react-native";
import { COLORS } from "@/src/theme";

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [langChecked, setLangChecked] = useState(false);
  const [hasLang, setHasLang] = useState(false);

  useEffect(() => {
    storage.getItem(LANG_KEY, "").then((l) => {
      setHasLang(!!l);
      setLangChecked(true);
    });
  }, []);

  useEffect(() => {
    if (loading || !langChecked) return;
    if (!hasLang) {
      router.replace("/language");
      return;
    }
    if (!user) {
      router.replace("/login");
      return;
    }

    (async () => {
      const lastPath = await storage.getItem("last_path", "");

      if (user.role === "karigar") {
        if (!user.has_profile) {
          router.replace("/profile-form?mode=create");
        } else if (lastPath && lastPath.startsWith("/(artisan)")) {
          router.replace(lastPath as any);
        } else {
          router.replace("/(artisan)/dashboard");
        }
      } else {
        if (lastPath && lastPath.startsWith("/admin")) {
          router.replace(lastPath as any);
        } else {
          router.replace("/admin/dashboard");
        }
      }
    })();
  }, [loading, langChecked, hasLang, user, router]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <Loader />
    </View>
  );
}
