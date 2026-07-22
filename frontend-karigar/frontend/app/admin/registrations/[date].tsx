import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader, EmptyState } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { Worker, verificationColor } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";

const COLS = [
  { key: "sino",   label: "S.No",   width: 50 },
  { key: "emp_id", label: "EMP_ID", width: 80 },
  { key: "name",   label: "Name",   width: 160 },
  { key: "phone",  label: "Phone",  width: 130 },
  { key: "skill",  label: "Skill",  width: 220 },
  { key: "city",   label: "City",   width: 120 },
  { key: "status", label: "Status", width: 150 },
  { key: "exp",    label: "Exp",    width: 80 },
  { key: "time",   label: "Registered At", width: 150 },
];
const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

function prettyDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function prettyRange(from: string, to: string) {
  const f = new Date(from + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const t = new Date(to + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${f} – ${t}`;
}

export default function AdminRegistrationsByDate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { date, to, label } = useLocalSearchParams<{ date: string; to?: string; label?: string }>();
  const isRange = !!to && to !== date;
  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard"));

  const load = useCallback(async () => {
    if (!date) return;
    try {
      const q = new URLSearchParams();
      if (isRange) {
        q.set("date_from", date);
        q.set("date_to", to as string);
      } else {
        q.set("registered_date", date);
      }
      q.set("page_size", "200");
      const res = await apiFetch<{ items: Worker[]; total: number }>(`/admin/workers?${q.toString()}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      show(e.message || "Could not load registrations", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date, to, isRange]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (worker: Worker, col: string, currentValue: string) => {
    setEditingKey(`${worker.id}:${col}`);
    setDraft(currentValue);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft("");
  };

  const patchWorker = (workerId: string, updated: Partial<Worker>) => {
    setItems((prev) => prev.map((w) => (w.id === workerId ? { ...w, ...updated } : w)));
  };

  const saveEdit = async (worker: Worker, col: string) => {
    const key = `${worker.id}:${col}`;
    let body: any = {};
    if (col === "phone") body.phone = draft.trim();
    else if (col === "city") body.city = draft.trim();
    else if (col === "exp") {
      const n = parseInt(draft, 10);
      if (isNaN(n) || n < 0) { show("Enter a valid number of years", "error"); return; }
      body.years_experience = n;
    } else if (col === "skill") {
      body.skills = draft.split(",").map((s) => s.trim()).filter(Boolean);
      if (body.skills.length === 0) { show("Enter at least one skill", "error"); return; }
    } else {
      return;
    }

    setSavingKey(key);
    try {
      const updated = await apiFetch<Worker>(`/admin/workers/${worker.id}/quick-edit`, {
        method: "PATCH",
        body,
      });
      patchWorker(worker.id, updated);
      show("Saved", "success");
      cancelEdit();
    } catch (e: any) {
      show(e.message || "Could not save change", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const approve = async (worker: Worker) => {
    const key = `${worker.id}:status`;
    setSavingKey(key);
    try {
      await apiFetch(`/admin/workers/${worker.id}/approve`, { method: "POST" });
      patchWorker(worker.id, { verification_status: "approved" });
      show(`${worker.full_name} approved`, "success");
    } catch (e: any) {
      show(e.message || "Could not approve", "error");
    } finally {
      setSavingKey(null);
      setEditingKey(null);
    }
  };

  const reject = async (worker: Worker) => {
    const key = `${worker.id}:status`;
    setSavingKey(key);
    try {
      await apiFetch(`/admin/workers/${worker.id}/reject`, {
        method: "POST",
        body: { reason: "Rejected by admin from Registrations table" },
      });
      setItems((prev) => prev.filter((w) => w.id !== worker.id));
      setTotal((t) => t - 1);
      show(`${worker.full_name} rejected`, "success");
    } catch (e: any) {
      show(e.message || "Could not reject", "error");
    } finally {
      setSavingKey(null);
      setEditingKey(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Registrations"
        subtitle={isRange ? (label ? `${label} (${prettyRange(date, to as string)})` : prettyRange(date, to as string)) : date ? prettyDate(date) : undefined}
        onBack={goBack}
      />

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>
            {total} worker{total !== 1 ? "s" : ""} registered {isRange ? "in this period" : "on this day"}
          </AppText>
          <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.lg, fontStyle: "italic" }}>
            Tap a name to review the full profile. Tap any other cell to edit it in place.
          </AppText>

          {items.length === 0 ? (
            <EmptyState icon="people-outline" title="No registrations" subtitle="No workers registered on this day" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ width: "100%", minWidth: TABLE_WIDTH, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>
                {/* Header */}
                <View style={styles.headerRow}>
                  {COLS.map((c) => (
                    <View key={c.key} style={{ width: c.width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
                      <AppText size="sm" weight="bold" color="#fff">{c.label}</AppText>
                    </View>
                  ))}
                </View>

                {/* Rows */}
                {items.map((w, i) => {
                  const rowBg = i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary;
                  return (
                    <View key={w.id} style={[styles.dataRow, { backgroundColor: rowBg }]} testID={`registration-row-${w.id}`}>
                      <Cell width={COLS[0].width}><AppText size="sm">{i + 1}</AppText></Cell>

                      <Cell width={COLS[1].width}><AppText size="sm">{(w as any).worker_id}</AppText></Cell>

                      <Pressable
                        onPress={() => router.push(`/admin/worker/${w.id}?from=search`)}
                        style={{ width: COLS[2].width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider }}
                        testID={`registration-name-${w.id}`}
                      >
                        <AppText size="sm" weight="semibold" numberOfLines={1} color={COLORS.brandPrimary}>{w.full_name}</AppText>
                      </Pressable>

                      <EditableCell
                        width={COLS[3].width}
                        editing={editingKey === `${w.id}:phone`}
                        saving={savingKey === `${w.id}:phone`}
                        draft={draft}
                        setDraft={setDraft}
                        onStart={() => startEdit(w, "phone", w.phone || "")}
                        onSave={() => saveEdit(w, "phone")}
                        onCancel={cancelEdit}
                        keyboardType="phone-pad"
                        display={<AppText size="sm" color={COLORS.muted} numberOfLines={1}>{w.phone || "—"}</AppText>}
                      />

                      <EditableCell
                        width={COLS[4].width}
                        editing={editingKey === `${w.id}:skill`}
                        saving={savingKey === `${w.id}:skill`}
                        draft={draft}
                        setDraft={setDraft}
                        onStart={() => startEdit(w, "skill", (w.skills || []).join(", "))}
                        onSave={() => saveEdit(w, "skill")}
                        onCancel={cancelEdit}
                        display={<AppText size="sm" numberOfLines={2}>{(w.skills || []).join(", ") || "—"}</AppText>}
                      />

                      <EditableCell
                        width={COLS[5].width}
                        editing={editingKey === `${w.id}:city`}
                        saving={savingKey === `${w.id}:city`}
                        draft={draft}
                        setDraft={setDraft}
                        onStart={() => startEdit(w, "city", w.city || "")}
                        onSave={() => saveEdit(w, "city")}
                        onCancel={cancelEdit}
                        display={<AppText size="sm" numberOfLines={1}>{w.city || "—"}</AppText>}
                      />

                      <Pressable
                        onPress={() => setEditingKey(editingKey === `${w.id}:status` ? null : `${w.id}:status`)}
                        style={{ width: COLS[6].width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider }}
                      >
                        {editingKey === `${w.id}:status` ? (
                          savingKey === `${w.id}:status` ? (
                            <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                          ) : (
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              {w.verification_status !== "approved" && (
                                <Pressable onPress={() => approve(w)} hitSlop={6}>
                                  <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                                </Pressable>
                              )}
                              <Pressable onPress={() => reject(w)} hitSlop={6}>
                                <Ionicons name="close-circle" size={22} color={COLORS.error} />
                              </Pressable>
                            </View>
                          )
                        ) : (
                          <AppText size="sm" weight="semibold" color={verificationColor(w.verification_status)}>
                            {w.verification_status === "approved" ? "✅ Verified" : w.verification_status === "pending" ? "⏳ Pending" : "❌ Rejected"}
                          </AppText>
                        )}
                      </Pressable>

                      <EditableCell
                        width={COLS[7].width}
                        editing={editingKey === `${w.id}:exp`}
                        saving={savingKey === `${w.id}:exp`}
                        draft={draft}
                        setDraft={setDraft}
                        onStart={() => startEdit(w, "exp", String(w.years_experience || 0))}
                        onSave={() => saveEdit(w, "exp")}
                        onCancel={cancelEdit}
                        keyboardType="numeric"
                        display={<AppText size="sm">{w.years_experience || 0} yrs</AppText>}
                      />

                      <Cell width={COLS[8].width}>
                        <AppText size="sm" color={COLORS.muted}>
                          {new Date(w.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </AppText>
                      </Cell>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{ width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider }}>
      {children}
    </View>
  );
}

function EditableCell({
  width,
  editing,
  saving,
  draft,
  setDraft,
  onStart,
  onSave,
  onCancel,
  display,
  keyboardType = "default",
}: {
  width: number;
  editing: boolean;
  saving: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  display: React.ReactNode;
  keyboardType?: "default" | "numeric" | "phone-pad";
}) {
  if (editing) {
    return (
      <View style={{ width, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={onSave}
          onBlur={onSave}
          keyboardType={keyboardType}
          editable={!saving}
          style={{
            flex: 1,
            fontSize: 13,
            paddingVertical: 4,
            paddingHorizontal: 6,
            borderWidth: 1,
            borderColor: COLORS.brandPrimary,
            borderRadius: 6,
            color: COLORS.onSurface,
          }}
        />
        {saving ? (
          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
        ) : (
          <Pressable onPress={onCancel} hitSlop={6}>
            <Ionicons name="close" size={16} color={COLORS.muted} />
          </Pressable>
        )}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onStart}
      style={{ width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider }}
    >
      {display}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.surfaceInverse },
  dataRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.divider },
});
