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

export default function SkillManagement() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiFetch<{ id: string; name: string }[]>("/skills");
      setSkills(s);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string; name: string }>("/skills", { method: "POST", body: { name: name.trim() } });
      setSkills((s) => [...s, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      show(t("skillAdded"), "success");
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setSkills((s) => s.filter((x) => x.id !== id));
    try {
      await apiFetch(`/skills/${id}`, { method: "DELETE" });
    } catch {
      load();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t("skillManagement")} onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard"))}
      <View style={styles.addRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("newSkillPh")}
          placeholderTextColor={COLORS.muted}
          style={styles.input}
          testID="new-skill-input"
        />
        <Pressable style={styles.addBtn} onPress={add} disabled={busy} testID="add-skill-btn">
          <Ionicons name="add" size={26} color={COLORS.onBrandPrimary} />
        </Pressable>
      </View>
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={skills}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING["2xl"] }}
          renderItem={({ item }) => (
            <View style={[styles.skillRow, shadow]}>
              <View style={styles.skillIcon}>
                <Ionicons name="construct" size={18} color={COLORS.brandPrimary} />
              </View>
              <AppText weight="semibold" style={{ flex: 1 }}>{item.name}</AppText>
              <Pressable onPress={() => remove(item.id)} hitSlop={10} testID={`delete-skill-${item.id}`}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  addRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  input: { flex: 1, height: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: FONT.lg, color: COLORS.onSurface, backgroundColor: COLORS.surfaceSecondary },
  addBtn: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center" },
  skillRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md },
  skillIcon: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.brandTertiary, alignItems: "center", justifyContent: "center" },
});
