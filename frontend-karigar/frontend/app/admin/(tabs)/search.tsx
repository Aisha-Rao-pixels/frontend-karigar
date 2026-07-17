import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, FlatList, Pressable, TextInput,
  Modal, Image, ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText, Avatar, Chip, EmptyState, Loader, Button, Tooltip } from "@/src/components/ui";
import { ResizableTable, ResizableTableColumn } from "@/src/components/ResizableTable";
import { apiFetch } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { Worker, availabilityColor, verificationColor } from "@/src/utils/profile";
import { AVAILABILITY_OPTIONS } from "@/src/constants/app";
import { SKILL_CATEGORIES, ALL_SKILLS } from "@/src/constants/skills";
import { useToast } from "@/src/components/Toast";

const VERIF_OPTIONS = [
  { value: "all", key: "all" },
  { value: "pending", key: "pending" },
  { value: "approved", key: "verified" },
  { value: "rejected", key: "rejected" },
];

export default function WorkerSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const params = useLocalSearchParams<{
    verification?: string;
    availability?: string;
    min_exp?: string;
    max_exp?: string;
    area?: string;
    view?: string;
  }>();

  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [availability, setAvailability] = useState(params.availability || "all");
  const [verification, setVerification] = useState(params.verification || "all");
  const [city, setCity] = useState("");
  const [area, setArea] = useState(params.area || "");
  const [minExp, setMinExp] = useState(params.min_exp || "");
  const [maxExp, setMaxExp] = useState(params.max_exp || "");
  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewModeState] = useState<"card" | "table">(params.view === "table" ? "table" : "card");
  const [viewModeLoaded, setViewModeLoaded] = useState(false);
  const [gallerySkill, setGallerySkill] = useState<string | null>(null);
  const [galleryWorkers, setGalleryWorkers] = useState<Worker[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);

  // Inline Status editing (Approve / Reject) for the table view — kept
  // separate from ResizableTable's generic editable-column mechanism
  // because approving/rejecting call dedicated endpoints with side effects
  // (referral rewards, notifications, moving rejected workers out of the
  // workers collection) rather than a plain field update.
  const [statusEditKey, setStatusEditKey] = useState<string | null>(null);
  const [statusSavingKey, setStatusSavingKey] = useState<string | null>(null);

  const patchWorker = useCallback((workerId: string, updated: Partial<Worker>) => {
    setItems((prev) => prev.map((w) => (w.id === workerId ? { ...w, ...updated } : w)));
  }, []);

  const approveWorker = useCallback(async (worker: Worker) => {
    setStatusSavingKey(worker.id);
    try {
      await apiFetch(`/admin/workers/${worker.id}/approve`, { method: "POST" });
      patchWorker(worker.id, { verification_status: "approved" });
      show(`${worker.full_name} approved`, "success");
    } catch (e: any) {
      show(e.message || "Could not approve", "error");
    } finally {
      setStatusSavingKey(null);
      setStatusEditKey(null);
    }
  }, [patchWorker, show]);

  const rejectWorker = useCallback(async (worker: Worker) => {
    setStatusSavingKey(worker.id);
    try {
      await apiFetch(`/admin/workers/${worker.id}/reject`, {
        method: "POST",
        body: { reason: "Rejected by admin from Worker Directory" },
      });
      setItems((prev) => prev.filter((w) => w.id !== worker.id));
      setTotal((n) => n - 1);
      show(`${worker.full_name} rejected`, "success");
    } catch (e: any) {
      show(e.message || "Could not reject", "error");
    } finally {
      setStatusSavingKey(null);
      setStatusEditKey(null);
    }
  }, [show]);

  // Saves whichever editable cells changed in a row (Phone / Area / Skills /
  // City / Experience) via the lightweight quick-edit endpoint.
  const saveQuickEdit = useCallback(async (worker: Worker, changes: Record<string, string>) => {
    const body: any = {};
    if (changes.phone !== undefined) body.phone = changes.phone.trim();
    if (changes.area !== undefined) body.area = changes.area.trim();
    if (changes.city !== undefined) body.city = changes.city.trim();
    if (changes.exp !== undefined) {
      const n = parseInt(changes.exp, 10);
      if (isNaN(n) || n < 0) throw new Error("Enter a valid number of years");
      body.years_experience = n;
    }
    if (changes.skill !== undefined) {
      const skills = changes.skill.split(",").map((s) => s.trim()).filter(Boolean);
      if (skills.length === 0) throw new Error("Enter at least one skill");
      body.skills = skills;
    }
    const updated = await apiFetch<Worker>(`/admin/workers/${worker.id}/quick-edit`, {
      method: "PATCH",
      body,
    });
    patchWorker(worker.id, updated);
    show("Saved", "success");
  }, [patchWorker, show]);

  // Restore last-used view mode (card/table) on mount — unless a drill-down
  // link explicitly requested a view (?view=table), which takes priority.
  useEffect(() => {
    if (params.view === "table") { setViewModeLoaded(true); return; }
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
    (overrides?: Partial<{ skill: string; availability: string; verification: string; city: string; area: string; minExp: string; maxExp: string; search: string }>) => {
      const s = { skill, availability, verification, city, area, minExp, maxExp, search, ...overrides };
      const p = new URLSearchParams();
      if (s.search) p.set("search", s.search);
      if (s.skill && s.skill !== "all") p.set("skill", s.skill);
      if (s.availability && s.availability !== "all") p.set("availability", s.availability);
      if (s.verification && s.verification !== "all") p.set("verification", s.verification);
      if (s.city) p.set("city", s.city);
      if (s.area) p.set("area", s.area);
      if (s.minExp) p.set("min_exp", s.minExp);
      if (s.maxExp) p.set("max_exp", s.maxExp);
      p.set("page_size", "100");
      return p.toString();
    },
    [skill, availability, verification, city, area, minExp, maxExp, search]
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

  // Re-sync local filter state whenever the incoming route params change —
  // not just on first mount. Expo Router keeps this tab screen mounted
  // across navigations, so without this, a second drill-down click from the
  // Dashboard (e.g. a different Experience Mix bar, or "Not Available"
  // after already having opened the directory once) would land on the same
  // screen instance but be silently ignored, because the filter state was
  // only ever initialized once via useState's initial value.
  const paramsKey = [
    params.availability ?? "",
    params.verification ?? "",
    params.min_exp ?? "",
    params.max_exp ?? "",
    params.area ?? "",
    params.view ?? "",
  ].join("|");

  useEffect(() => {
    const nextAvailability = params.availability || "all";
    const nextVerification = params.verification || "all";
    const nextMinExp = params.min_exp || "";
    const nextMaxExp = params.max_exp || "";
    const nextArea = params.area || "";

    setAvailability(nextAvailability);
    setVerification(nextVerification);
    setMinExp(nextMinExp);
    setMaxExp(nextMaxExp);
    setArea(nextArea);
    if (params.view === "table") setViewMode("table");

    load({
      availability: nextAvailability,
      verification: nextVerification,
      minExp: nextMinExp,
      maxExp: nextMaxExp,
      area: nextArea,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  // Refresh the current results whenever this tab regains focus (e.g. after
  // verifying a worker and coming back), using whatever filters are
  // currently active — does not reset them.
  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    setArea("");
    setMinExp("");
    setMaxExp("");
    setExpandedCat(null);
    load({ skill: "all", availability: "all", verification: "all", city: "", area: "", minExp: "", maxExp: "" });
    setFiltersVisible(false);
  };

  const applyFilters = () => {
    load();
    setFiltersVisible(false);
  };

  const activeFilterCount =
    (skill !== "all" ? 1 : 0) + (availability !== "all" ? 1 : 0) + (verification !== "all" ? 1 : 0) + (city ? 1 : 0) + (area ? 1 : 0) + (minExp || maxExp ? 1 : 0);

  const drillDownLabel = area
    ? `Location: ${area}`
    : (minExp || maxExp)
    ? `Experience: ${minExp || "0"}${maxExp ? `–${maxExp}` : "+"} yrs`
    : null;

  const clearDrillDown = () => {
    setArea("");
    setMinExp("");
    setMaxExp("");
    load({ area: "", minExp: "", maxExp: "" });
  };

  const tableColumns: ResizableTableColumn<Worker>[] = [
    {
      key: "sno", label: "S.No", width: 56, resizable: false,
      render: (_item, index) => <AppText size="sm" color={COLORS.muted}>{index + 1}</AppText>,
    },
    {
      key: "name", label: "Name", width: 160,
      sortable: true, sortValue: (w) => w.full_name?.toLowerCase() ?? "",
      filterable: true, filterMatch: (w, f) => w.full_name?.toLowerCase().includes(f.toLowerCase()) ?? false,
      render: (item) => (
        <Pressable onPress={() => router.push(`/admin/worker/${item.id}?from=search`)} testID={`directory-name-${item.id}`}>
          <AppText size="sm" weight="semibold" numberOfLines={1} color={COLORS.brandPrimary}>{item.full_name}</AppText>
        </Pressable>
      ),
    },
    {
      key: "phone", label: "Phone", width: 130,
      filterable: true, filterMatch: (w, f) => (w.phone ?? "").includes(f),
      editable: true, getEditValue: (w) => w.phone || "",
      render: (item) => <AppText size="sm" numberOfLines={1} color={COLORS.muted}>{item.phone || "—"}</AppText>,
    },
    {
      key: "area", label: "Area / Locality", width: 160,
      sortable: true, sortValue: (w) => w.area?.toLowerCase() ?? "",
      filterable: true, filterMatch: (w, f) => (w.area ?? "").toLowerCase().includes(f.toLowerCase()),
      editable: true, getEditValue: (w) => w.area || "",
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.area || "—"}</AppText>,
    },
    {
      key: "skill", label: "Skills", width: 220,
      sortable: true, sortValue: (w) => (w.skills || []).join(", ").toLowerCase(),
      filterable: true, filterMatch: (w, f) => (w.skills || []).join(" ").toLowerCase().includes(f.toLowerCase()),
      editable: true, getEditValue: (w) => (w.skills || []).join(", "),
      render: (item) => (
        <AppText size="sm" numberOfLines={2}>{(item.skills || []).join(", ") || "—"}</AppText>
      ),
    },
    {
      key: "city", label: "City", width: 120,
      sortable: true, sortValue: (w) => w.city?.toLowerCase() ?? "",
      filterable: true, filterMatch: (w, f) => (w.city ?? "").toLowerCase().includes(f.toLowerCase()),
      editable: true, getEditValue: (w) => w.city || "",
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.city || "—"}</AppText>,
    },
    {
      key: "status", label: "Verification", width: 150,
      sortable: true, sortValue: (w) => w.verification_status ?? "",
      filterable: true, filterMatch: (w, f) => (w.verification_status ?? "").toLowerCase().includes(f.toLowerCase()),
      render: (item) => (
        <Pressable
          onPress={(e: any) => { e?.stopPropagation?.(); setStatusEditKey(statusEditKey === item.id ? null : item.id); }}
          testID={`directory-status-${item.id}`}
        >
          {statusEditKey === item.id ? (
            statusSavingKey === item.id ? (
              <AppText size="sm" color={COLORS.muted}>Saving…</AppText>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {item.verification_status !== "approved" && (
                  <Pressable onPress={(e: any) => { e?.stopPropagation?.(); approveWorker(item); }} hitSlop={6}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  </Pressable>
                )}
                <Pressable onPress={(e: any) => { e?.stopPropagation?.(); rejectWorker(item); }} hitSlop={6}>
                  <Ionicons name="close-circle" size={20} color={COLORS.error} />
                </Pressable>
              </View>
            )
          ) : (
            <AppText size="sm" numberOfLines={1} color={verificationColor(item.verification_status)}>
              {item.verification_status === "approved" ? "✅ Verified" : item.verification_status === "pending" ? "⏳ Pending" : "❌ Rejected"}
            </AppText>
          )}
        </Pressable>
      ),
    },
    {
      key: "exp", label: "Experience", width: 100,
      sortable: true, sortValue: (w) => w.years_experience ?? 0,
      filterable: true, filterMatch: (w, f) => String(w.years_experience ?? 0).includes(f),
      editable: true, getEditValue: (w) => String(w.years_experience || 0), editKeyboardType: "numeric",
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
            <Pressable style={styles.filterBtn} onPress={() => setFiltersVisible(true)} testID="open-filters-btn">
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

      {/* Drill-down filter banner (from dashboard Location / Experience Mix clicks) */}
      {drillDownLabel && (
        <View style={styles.drillDownBanner} testID="drilldown-banner">
          <Ionicons name="filter" size={16} color={COLORS.brandPrimary} />
          <AppText size="sm" color={COLORS.brandPrimary} weight="semibold" style={{ flex: 1 }}>
            {drillDownLabel}
          </AppText>
          <Pressable onPress={clearDrillDown} testID="clear-drilldown-btn" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.brandPrimary} />
          </Pressable>
        </View>
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
            getRowTooltip={(w) => `View ${w.full_name}'s profile`}
            testIDPrefix="table"
            storageKey="admin_search_table"
            emptyText={t("noWorkers")}
          />
        )}
      </View>

      <Modal
        visible={filtersVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFiltersVisible(false)}
      >
        <View style={[styles.filterDialog, { paddingTop: insets.top }]}>
          <View style={styles.filterDialogHeader}>
            <AppText weight="bold" size="xl">{t("filters")}</AppText>
            <Pressable onPress={() => setFiltersVisible(false)} testID="close-filters-btn" hitSlop={10}>
              <Ionicons name="close" size={26} color={COLORS.onSurface} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}>
            {/* Skills — category → sub-skill, same picker as the registration form */}
            <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("filterSkill")}</AppText>
            <View style={{ gap: SPACING.sm, marginBottom: SPACING.lg }}>
              <Chip label={t("all")} selected={skill === "all"} onPress={() => { setSkill("all"); setExpandedCat(null); }} testID="skillcat-all" />
              {SKILL_CATEGORIES.map((cat) => {
                const isLeaf = cat.subs.length === 0;
                const selectedSub = !isLeaf && cat.subs.includes(skill) ? skill : null;
                const active = isLeaf ? skill === cat.label : !!selectedSub;
                const open = expandedCat === cat.key;
                return (
                  <View key={cat.key} style={[styles.catWrap, active && { borderColor: COLORS.brandPrimary }]}>
                    <Pressable
                      style={styles.catHeader}
                      onPress={() => (isLeaf ? setSkill(skill === cat.label ? "all" : cat.label) : setExpandedCat(open ? null : cat.key))}
                      testID={`skillcat-${cat.key}`}
                    >
                      <View
                        style={[
                          styles.catCheck,
                          {
                            backgroundColor: active ? COLORS.brandPrimary : COLORS.surfaceTertiary,
                            borderColor: active ? COLORS.brandPrimary : COLORS.borderStrong,
                          },
                        ]}
                      >
                        {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <AppText weight="semibold" style={{ flex: 1 }}>{cat.label}</AppText>
                      {selectedSub && (
                        <AppText size="sm" color={COLORS.brandPrimary} weight="semibold" numberOfLines={1} style={{ maxWidth: 120 }}>
                          {selectedSub}
                        </AppText>
                      )}
                      {!isLeaf && <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={COLORS.muted} />}
                    </Pressable>
                    {open && !isLeaf && (
                      <View style={styles.catBody}>
                        {cat.subs.map((s) => (
                          <Chip
                            key={s}
                            label={s}
                            selected={skill === s}
                            onPress={() => setSkill(skill === s ? "all" : s)}
                            testID={`skill-${s}`}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

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

            <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>Area / Locality</AppText>
            <TextInput value={area} onChangeText={setArea} placeholder="e.g. Charminar" placeholderTextColor={COLORS.muted} style={styles.sheetInput} />

            <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>Experience (years)</AppText>
            <View style={{ flexDirection: "row", gap: SPACING.md }}>
              <TextInput
                value={minExp}
                onChangeText={(v) => setMinExp(v.replace(/[^0-9]/g, ""))}
                placeholder="Min"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                style={[styles.sheetInput, { flex: 1 }]}
              />
              <TextInput
                value={maxExp}
                onChangeText={(v) => setMaxExp(v.replace(/[^0-9]/g, ""))}
                placeholder="Max"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                style={[styles.sheetInput, { flex: 1 }]}
              />
            </View>
          </ScrollView>

          <View style={styles.filterDialogFooter}>
            <View style={{ flex: 1 }}>
              <Button title={t("clearFilters")} variant="secondary" onPress={clearFilters} testID="clear-filters-btn" />
            </View>
            <View style={{ flex: 2 }}>
              <Button title={t("applyFilters")} onPress={applyFilters} testID="apply-filters-btn" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  // zIndex here matters: this header wraps the Filter/Search/View-toggle
  // tooltips, which are absolutely-positioned children that need to render
  // above the skill chip row below them. A child's zIndex only lifts it
  // above unrelated *later* siblings if its own positioned ancestor also
  // out-ranks those siblings — so the header itself needs a zIndex higher
  // than chipRowWrap's, not just the tooltip box.
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, zIndex: 20, position: "relative" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md, zIndex: 10 },
  viewToggle: { flexDirection: "row", gap: 4, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: 4 },
  toggleBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  toggleBtnActive: { backgroundColor: COLORS.brandPrimary },
  searchRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, zIndex: 1 },
  searchBox: { flex: 1, maxWidth: 420, flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: FONT.base, color: COLORS.onSurface },
  filterBtn: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  chipRowWrap: { height: 56, justifyContent: "center", marginTop: SPACING.sm, zIndex: 1, position: "relative" },
  galleryHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  drillDownBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.brandTertiary,
    borderRadius: RADIUS.md,
  },
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
  filterDialog: { flex: 1, backgroundColor: COLORS.surface },
  filterDialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterDialogFooter: {
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  catWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary, overflow: "hidden" },
  catHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, minHeight: 56 },
  catCheck: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catBody: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
});
