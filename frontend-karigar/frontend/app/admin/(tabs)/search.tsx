import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, StyleSheet, FlatList, Pressable, TextInput,
  Platform, Modal, Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText, Avatar, Chip, EmptyState, Loader, Button } from "@/src/components/ui";
import { ResizableTable, ResizableTableColumn } from "@/src/components/ResizableTable";
import { apiFetch } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { Worker, availabilityColor, verificationColor } from "@/src/utils/profile";
import { AVAILABILITY_OPTIONS } from "@/src/constants/app";
import { ALL_SKILLS } from "@/src/constants/skills";
import { useToast } from "@/src/components/Toast";

const VERIF_OPTIONS = [
  { value: "all", key: "all" },
  { value: "pending", key: "pending" },
  { value: "approved", key: "verified" },
  { value: "rejected", key: "rejected" },
];

// ── Tooltip component for web hover ─────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [vPos, setVPos] = useState<"top" | "bottom">("bottom");
  const [hAlign, setHAlign] = useState<"center" | "left" | "right">("center");
  const wrapRef = useRef<View>(null);

  if (Platform.OS !== "web") return <>{children}</>;

  const handleEnter = () => {
    // @ts-ignore - getBoundingClientRect exists on web
    const rect = wrapRef.current?.getBoundingClientRect?.();
    if (rect) {
      setVPos(rect.top < 160 ? "bottom" : "top");
      const halfW = 70; // half of the 140px tooltip width
      if (rect.left - halfW < 8) setHAlign("left");
      else if (rect.right + halfW > window.innerWidth - 8) setHAlign("right");
      else setHAlign("center");
    }
    setVisible(true);
  };

  const hStyle =
    hAlign === "left"
      ? { left: 0, right: undefined, transform: [] as any }
      : hAlign === "right"
      ? { left: undefined, right: 0, transform: [] as any }
      : { left: "50%", right: undefined, transform: [{ translateX: -70 }] };

  return (
    <View
      ref={wrapRef}
      style={{ position: "relative" }}
      // @ts-ignore
      onMouseEnter={handleEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <View
          style={[
            tooltipStyles.box,
            vPos === "bottom" ? { top: "110%", bottom: undefined } : { bottom: "110%" },
            hStyle,
          ]}
          pointerEvents="none"
        >
          <AppText size="sm" color="#fff" style={{ textAlign: "center" }}>{text}</AppText>
        </View>
      )}
    </View>
  );
}

const tooltipStyles = StyleSheet.create({
  box: {
    position: "absolute",
    width: 140,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 6,
    padding: 8,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default function WorkerSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const params = useLocalSearchParams<{ verification?: string; availability?: string }>();

  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [availability, setAvailability] = useState(params.availability || "all");
  const [verification, setVerification] = useState(params.verification || "all");
  const [city, setCity] = useState("");
  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewModeState] = useState<"card" | "table">("card");
  const [viewModeLoaded, setViewModeLoaded] = useState(false);
  const [gallerySkill, setGallerySkill] = useState<string | null>(null);
  const [galleryWorkers, setGalleryWorkers] = useState<Worker[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);

  const snapPoints = useMemo(() => ["65%"], []);

  // Restore last-used view mode (card/table) on mount
  useEffect(() => {
    storage.getItem("admin_search_view_mode", "card").then((v) => {
      if (v === "table" || v === "card") setViewModeState(v as "card" | "table");
      setViewModeLoaded(true);
    });
  }, []);

  const setViewMode = useCallback((mode: "card" | "table") => {
    setViewModeState(mode);
    storage.setItem("admin_search_view_mode", mode);
  }, []);

  const buildQuery = useCallback(
    (overrides?: Partial<{ skill: string; availability: string; verification: string; city: string; search: string }>) => {
      const s = { skill, availability, verification, city, search, ...overrides };
      const p = new URLSearchParams();
      if (s.search) p.set("search", s.search);
      if (s.skill && s.skill !== "all") p.set("skill", s.skill);
      if (s.availability && s.availability !== "all") p.set("availability", s.availability);
      if (s.verification && s.verification !== "all") p.set("verification", s.verification);
      if (s.city) p.set("city", s.city);
      p.set("page_size", "100");
      return p.toString();
    },
    [skill, availability, verification, city, search]
  );

  const load = useCallback(
    async (overrides?: any) => {
      setLoading(true);
      try {
        const q = buildQuery(overrides);
        const res = await apiFetch<{ items: Worker[]; total: number }>(`/admin/workers?${q}`);
        setItems(res.items);
        setTotal(res.total);
      } catch (e: any) {
        show(e.message || t("genericError"), "error");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useFocusEffect(useCallback(() => { load(); }, []));

  const openGallery = useCallback(async (selectedSkill: string) => {
    if (selectedSkill === "all") return;
    setGallerySkill(selectedSkill);
    setGalleryVisible(true);
    setGalleryLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("skill", selectedSkill);
      q.set("verification", "approved");
      const res = await apiFetch<{ items: Worker[]; total: number }>(`/admin/workers?${q.toString()}`);
      setGalleryWorkers(res.items);
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  const clearFilters = () => {
    setSkill("all");
    setAvailability("all");
    setVerification("all");
    setCity("");
    load({ skill: "all", availability: "all", verification: "all", city: "" });
    sheetRef.current?.close();
  };

  const applyFilters = () => {
    load();
    sheetRef.current?.close();
  };

  const activeFilterCount =
    (availability !== "all" ? 1 : 0) + (verification !== "all" ? 1 : 0) + (city ? 1 : 0);

  const tableColumns: ResizableTableColumn<Worker>[] = [
    {
      key: "sno", label: "S.No", width: 56, resizable: false,
      render: (_item, index) => <AppText size="sm" color={COLORS.muted}>{index + 1}</AppText>,
    },
    {
      key: "name", label: "Name", width: 160,
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.full_name}</AppText>,
    },
    {
      key: "phone", label: "Phone", width: 130,
      render: (item) => <AppText size="sm" numberOfLines={1} color={COLORS.muted}>{item.phone || "—"}</AppText>,
    },
    {
      key: "skill", label: "Skill", width: 220,
      render: (item) => {
        const skillsText = (item.skills || []).join(", ") || "—";
        return (
          <Tooltip text={skillsText}>
            <AppText size="sm" numberOfLines={2}>{skillsText}</AppText>
          </Tooltip>
        );
      },
    },
    {
      key: "city", label: "City", width: 120,
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.city || "—"}</AppText>,
    },
    {
      key: "status", label: "Status", width: 140,
      render: (item) => (
        <AppText size="sm" numberOfLines={1} color={verificationColor(item.verification_status)}>
          {item.verification_status === "approved" ? "✅ Verified" : item.verification_status === "pending" ? "⏳ Pending" : "❌ Rejected"}
        </AppText>
      ),
    },
    {
      key: "exp", label: "Exp", width: 80,
      render: (item) => <AppText size="sm">{item.years_experience || 0} yrs</AppText>,
    },
  ];

  const GalleryModal = () => (
    <Modal visible={galleryVisible} animationType="slide" onRequestClose={() => setGalleryVisible(false)}>
      <View style={styles.galleryContainer}>
        <View style={styles.galleryHeader}>
          <Pressable onPress={() => setGalleryVisible(false)} style={styles.galleryBack}>
            <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText weight="bold" size="xl">{gallerySkill}</AppText>
            <AppText size="sm" color={COLORS.muted}>
              {galleryWorkers.length} verified worker{galleryWorkers.length !== 1 ? "s" : ""}
            </AppText>
          </View>
        </View>
        {galleryLoading ? <Loader /> : galleryWorkers.length === 0 ? (
          <EmptyState icon="images-outline" title="No verified workers" subtitle={`No verified workers found for ${gallerySkill}`} />
        ) : (
          <FlatList
            data={galleryWorkers}
            keyExtractor={(w) => w.id}
            numColumns={2}
            contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING["2xl"] }}
            columnWrapperStyle={{ gap: SPACING.md }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setGalleryVisible(false); router.push(`/admin/worker/${item.id}?from=search`); }}
                style={styles.galleryCard}
                testID={`gallery-card-${item.id}`}
              >
                {item.portfolio_images && item.portfolio_images.length > 0 ? (
                  <Image source={{ uri: item.portfolio_images[0] }} style={styles.galleryImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.galleryImage, styles.galleryImageFallback]}>
                    <Ionicons name="person" size={40} color={COLORS.muted} />
                  </View>
                )}
                <View style={styles.galleryInfo}>
                  <AppText weight="bold" size="sm" numberOfLines={1}>{item.full_name}</AppText>
                  <AppText size="sm" color={COLORS.muted} numberOfLines={1}>{item.skills?.join(", ")}</AppText>
                  <AppText size="sm" color={COLORS.muted}>{item.city}</AppText>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color={COLORS.success} />
                    <AppText size="sm" color={COLORS.success} weight="semibold">Verified</AppText>
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <GalleryModal />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {router.canGoBack() && (
              <Pressable onPress={() => router.back()} style={{ marginRight: SPACING.sm }} testID="search-back-btn" hitSlop={10}>
                <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
              </Pressable>
            )}
          <AppText weight="bold" size="2xl">Worker Directory</AppText>
        </View>
        {/* View Toggle with tooltips */}
        <View style={styles.viewToggle}>
            <Tooltip text="Card View">
              <Pressable
                onPress={() => setViewMode("card")}
                style={[styles.toggleBtn, viewMode === "card" && styles.toggleBtnActive]}
                testID="toggle-card-view"
              >
                <Ionicons name="list" size={18} color={viewMode === "card" ? COLORS.onBrandPrimary : COLORS.muted} />
              </Pressable>
            </Tooltip>
            <Tooltip text="Table View">
              <Pressable
                onPress={() => setViewMode("table")}
                style={[styles.toggleBtn, viewMode === "table" && styles.toggleBtnActive]}
                testID="toggle-table-view"
              >
                <Ionicons name="grid" size={18} color={viewMode === "table" ? COLORS.onBrandPrimary : COLORS.muted} />
              </Pressable>
            </Tooltip>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              testID="worker-search-input"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load()}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={COLORS.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => { setSearch(""); load({ search: "" }); }}>
                <Ionicons name="close-circle" size={18} color={COLORS.muted} />
              </Pressable>
            )}
          </View>
          <Tooltip text="Filter Workers">
            <Pressable style={styles.filterBtn} onPress={() => sheetRef.current?.expand()} testID="open-filters-btn">
              <Ionicons name="options" size={20} color={COLORS.onBrandPrimary} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <AppText size="sm" color="#fff" weight="bold" style={{ fontSize: 10 }}>{activeFilterCount}</AppText>
                </View>
              )}
            </Pressable>
          </Tooltip>
        </View>
      </View>

      {/* Skill chips with tooltips */}
      <View style={styles.chipRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...ALL_SKILLS]}
          keyExtractor={(s) => s}
          contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}
          renderItem={({ item }) => (
            <Tooltip text={item === "all" ? "Show all workers" : `Filter by ${item} · Long press for photos`}>
              <Chip
                label={item === "all" ? t("all") : item}
                selected={skill === item}
                onPress={() => { setSkill(item); load({ skill: item }); }}
                onLongPress={() => openGallery(item)}
                testID={`skill-filter-${item}`}
              />
            </Tooltip>
          )}
        />
      </View>

      {/* Gallery hint */}
      {skill !== "all" && (
        <Pressable onPress={() => openGallery(skill)} style={styles.galleryHint} testID="open-gallery-hint">
          <Ionicons name="images-outline" size={16} color={COLORS.brandPrimary} />
          <AppText size="sm" color={COLORS.brandPrimary} weight="semibold">
            Tap to view verified photos for "{skill}"
          </AppText>
        </Pressable>
      )}

      <View style={styles.resultsBar}>
        <AppText size="sm" color={COLORS.muted}>{t("resultsCount", { count: total })}</AppText>
      </View>

      <View style={{ flex: 1 }}>
        {loading ? <Loader /> : viewMode === "card" ? (
          <FlatList
            data={items}
            keyExtractor={(w) => w.id}
            contentContainerStyle={{ padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: SPACING["2xl"] }}
            ListEmptyComponent={<EmptyState image="https://images.unsplash.com/photo-1521401415461-83e7162b8e64?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBhcnRpc2FuJTIwZW1icm9pZGVyeSUyMHRhaWxvcmluZyUyMHdvcmtlcnxlbnwwfHx8fDE3ODEyNTk4MTd8MA&ixlib=rb-4.1.0&q=85" title={t("noWorkers")} />}
            renderItem={({ item }) => (
              <Tooltip text={`View ${item.full_name}'s full profile`}>
                <Pressable onPress={() => router.push(`/admin/worker/${item.id}?from=search`)} style={[styles.workerCard, shadow]} testID={`worker-card-${item.id}`}>
                  <Avatar name={item.full_name} size={48} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" size="base" numberOfLines={1}>{item.full_name}</AppText>
                    <AppText size="sm" color={COLORS.muted} numberOfLines={1}>
                      {(item.skills || []).join(", ") || "—"} · {item.years_experience} {t("yearsShort")} · {item.city}
                    </AppText>
                    <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: 6 }}>
                      <View style={[styles.miniDot, { backgroundColor: availabilityColor(item.availability_status) }]} />
                      <View style={[styles.miniDot, { backgroundColor: verificationColor(item.verification_status) }]} />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
                </Pressable>
              </Tooltip>
            )}
          />
        ) : (
          <ResizableTable
            columns={tableColumns}
            data={items}
            keyExtractor={(w) => w.id}
            onRowPress={(w) => router.push(`/admin/worker/${w.id}?from=search`)}
            testIDPrefix="table"
            storageKey="admin_search_table"
            emptyText={t("noWorkers")}
          />
        )}
      </View>

      <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ backgroundColor: COLORS.surfaceSecondary }}>
        <BottomSheetScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}>
          <AppText weight="bold" size="xl" style={{ marginBottom: SPACING.lg }}>{t("filters")}</AppText>
          <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("filterAvailability")}</AppText>
          <View style={styles.wrap}>
            <Chip label={t("all")} selected={availability === "all"} onPress={() => setAvailability("all")} />
            {AVAILABILITY_OPTIONS.map((o) => (
              <Chip key={o.value} label={t(o.key)} selected={availability === o.value} onPress={() => setAvailability(o.value)} />
            ))}
          </View>
          <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>{t("filterVerification")}</AppText>
          <View style={styles.wrap}>
            {VERIF_OPTIONS.map((o) => (
              <Chip key={o.value} label={t(o.key)} selected={verification === o.value} onPress={() => setVerification(o.value)} />
            ))}
          </View>
          <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>{t("filterCity")}</AppText>
          <TextInput value={city} onChangeText={setCity} placeholder="Hyderabad" placeholderTextColor={COLORS.muted} style={styles.sheetInput} />
          <View style={{ flexDirection: "row", gap: SPACING.md, marginTop: SPACING.xl }}>
            <View style={{ flex: 1 }}>
              <Button title={t("clearFilters")} variant="secondary" onPress={clearFilters} testID="clear-filters-btn" />
            </View>
            <View style={{ flex: 2 }}>
              <Button title={t("applyFilters")} onPress={applyFilters} testID="apply-filters-btn" />
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md, zIndex: 10 },
  viewToggle: { flexDirection: "row", gap: 4, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: 4 },
  toggleBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  toggleBtnActive: { backgroundColor: COLORS.brandPrimary },
  searchRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, zIndex: 1 },
  searchBox: { flex: 1, maxWidth: 420, flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: FONT.base, color: COLORS.onSurface },
  filterBtn: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  chipRowWrap: { height: 56, justifyContent: "center", marginTop: SPACING.sm },
  galleryHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  resultsBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  workerCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md },
  miniDot: { width: 10, height: 10, borderRadius: 5 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  sheetInput: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: FONT.base, color: COLORS.onSurface, backgroundColor: COLORS.surface },
  galleryContainer: { flex: 1, backgroundColor: COLORS.surface },
  galleryHeader: { flexDirection: "row", alignItems: "center", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingTop: SPACING["2xl"] },
  galleryBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: SPACING.sm },
  galleryCard: { flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, overflow: "hidden" },
  galleryImage: { width: "100%", height: 160 },
  galleryImageFallback: { backgroundColor: COLORS.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  galleryInfo: { padding: SPACING.sm, gap: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
});
