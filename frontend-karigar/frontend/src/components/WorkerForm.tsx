import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { AppText, Button, Chip, Field } from "@/src/components/ui";
import { Calendar } from "@/src/components/Calendar";
import { GENDERS, SPOKEN_LANGUAGES, AVAILABILITY_OPTIONS, PROOF_TYPES } from "@/src/constants/app";
import { SKILL_CATEGORIES } from "@/src/constants/skills";
import { availabilityColor, formatDate, Worker } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";
import { apiFetch } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export interface WorkerFormValues {
  mobile?: string;
  full_name: string;
  gender: string;
  languages: string[];
  area: string;
  city: string;
  location_lat: number | null;
  location_lng: number | null;
  skills: string[];
  years_experience: string;
  current_employer: string;
  previous_employer: string;
  wage_expectation: string;
  upi_id: string;
  portfolio_images: string[];
  aadhar_images: string[];
  employment_proof_type: string;
  employment_proof_images: string[];
  availability_status: string;
  available_from: string;
  referred_by_code: string;
}

export function emptyValues(): WorkerFormValues {
  return {
    mobile: "",
    full_name: "",
    gender: "",
    languages: [],
    area: "",
    city: "Hyderabad",
    location_lat: null,
    location_lng: null,
    skills: [],
    years_experience: "",
    current_employer: "",
    previous_employer: "",
    wage_expectation: "",
    upi_id: "",
    portfolio_images: [],
    aadhar_images: [],
    employment_proof_type: "",
    employment_proof_images: [],
    availability_status: "available_now",
    available_from: "",
    referred_by_code: "",
  };
}

export function fromWorker(w: Worker): WorkerFormValues {
  return {
    full_name: w.full_name,
    gender: w.gender,
    languages: w.languages || [],
    area: w.area,
    city: w.city,
    location_lat: w.location_lat ?? null,
    location_lng: w.location_lng ?? null,
    skills: w.skills || [],
    years_experience: String(w.years_experience ?? ""),
    current_employer: w.current_employer || "",
    previous_employer: w.previous_employer || "",
    wage_expectation: w.wage_expectation != null ? String(w.wage_expectation) : "",
    upi_id: w.upi_id || "",
    portfolio_images: w.portfolio_images || [],
    aadhar_images: w.aadhar_images || [],
    employment_proof_type: w.employment_proof_type || "",
    employment_proof_images: w.employment_proof_images || [],
    availability_status: w.availability_status,
    available_from: w.available_from || "",
    referred_by_code: w.referred_by_code || "",
  };
}

export function toPayload(v: WorkerFormValues) {
  return {
    full_name: v.full_name.trim(),
    gender: v.gender,
    languages: v.languages,
    area: v.area.trim(),
    city: v.city.trim() || "Hyderabad",
    location_lat: v.location_lat,
    location_lng: v.location_lng,
    skills: v.skills,
    years_experience: parseInt(v.years_experience || "0", 10) || 0,
    current_employer: v.current_employer.trim() || null,
    previous_employer: v.previous_employer.trim() || null,
    wage_expectation: v.wage_expectation ? parseInt(v.wage_expectation, 10) : null,
    upi_id: v.upi_id.trim() || null,
    portfolio_images: v.portfolio_images,
    aadhar_images: v.aadhar_images,
    employment_proof_type: v.employment_proof_type || null,
    employment_proof_images: v.employment_proof_images,
    availability_status: v.availability_status,
    available_from: v.availability_status === "available_from" ? v.available_from || null : null,
    referred_by_code: v.referred_by_code.trim() || null,
  };
}

function MultiDocUpload({
  images,
  onAdd,
  onRemove,
  error,
  testID,
}: {
  images: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  error?: string;
  testID: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
        {images.map((img, i) => (
          <View key={i} style={styles.docThumbWrap}>
            <Image source={{ uri: img }} style={styles.docThumb} contentFit="cover" />
            <Pressable style={styles.thumbX} onPress={() => onRemove(i)} testID={`${testID}-remove-${i}`}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable
          style={[styles.docAddTile, !!error && images.length === 0 && { borderColor: COLORS.error }]}
          onPress={onAdd}
          testID={testID}
        >
          <Ionicons name="cloud-upload-outline" size={24} color={COLORS.brandPrimary} />
          <AppText size="sm" color={COLORS.brandPrimary} weight="semibold" style={{ marginTop: 4, textAlign: "center" }}>
            {images.length > 0 ? t("addMore") : t("tapToUpload")}
          </AppText>
        </Pressable>
      </ScrollView>
      {!!error && (
        <AppText size="sm" color={COLORS.error} style={{ marginTop: 4 }}>
          {error}
        </AppText>
      )}
    </>
  );
}

export default function WorkerForm({
  initial,
  submitLabel,
  onSubmit,
  showMobile,
  showReferral,
  submitting,
}: {
  initial: WorkerFormValues;
  submitLabel: string;
  onSubmit: (v: WorkerFormValues) => void;
  showMobile?: boolean;
  showReferral?: boolean;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [v, setV] = useState<WorkerFormValues>(initial);

  React.useEffect(() => {
    storage.getItem("form_draft", "").then((draft) => {
      if (draft) {
        try {
          setV((prev) => ({ ...prev, ...JSON.parse(draft) }));
        } catch {}
      }
    });
  }, []);
  const [gpsFilledArea, setGpsFilledArea] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof WorkerFormValues, val: any) => setV((p) => {
    const updated = { ...p, [k]: val };
    storage.setItem("form_draft", JSON.stringify(updated));
    return updated;
  });
  const toggle = (k: "languages" | "skills", item: string) =>
    setV((p) => {
      const arr = p[k];
      return { ...p, [k]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show("Photo permission needed to upload portfolio", "error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.5,
      base64: true,
    });
    if (!res.canceled) {
      const uris = res.assets.filter((a) => a.base64).map((a) => `data:image/jpeg;base64,${a.base64}`);
      if (uris.length) set("portfolio_images", [...v.portfolio_images, ...uris]);
    }
  };

  const pickMulti = async (field: "aadhar_images" | "employment_proof_images") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show("Photo permission needed to upload documents", "error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled) {
      const uris = res.assets.filter((a) => a.base64).map((a) => `data:image/jpeg;base64,${a.base64}`);
      if (uris.length) set(field, [...(v[field] as string[]), ...uris]);
    }
  };

  const removeAt = (field: "aadhar_images" | "employment_proof_images" | "portfolio_images", index: number) =>
    set(field, (v[field] as string[]).filter((_, i) => i !== index));

  const [locating, setLocating] = useState(false);
  const detectLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        show(t("locationPermDenied"), "error");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      try {
        const result = await apiFetch<{ area: string; city: string }>(
          `/geocode/reverse?lat=${latitude}&lng=${longitude}`
        );
        setV((p) => ({
          ...p,
          location_lat: latitude,
          location_lng: longitude,
          area: result.area || p.area,
          city: result.city || p.city,
        }));
        if (result.area) setGpsFilledArea(result.area);
        show(t("locationDetected"), "success");
      } catch {
        // Geocoding failed but we still have raw coordinates — keep them and
        // let the worker type the area manually rather than blocking them.
        setV((p) => ({ ...p, location_lat: latitude, location_lng: longitude }));
        show(t("locationCoordsOnly"), "info");
      }
    } catch {
      show(t("locationFailed"), "error");
    } finally {
      setLocating(false);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (showMobile && (!v.mobile || v.mobile.trim().length < 10)) e.mobile = t("enterMobile");
    if (!v.full_name.trim()) e.full_name = t("nameRequired");
    if (!v.gender) e.gender = t("required");
    if (v.languages.length === 0) e.languages = t("pickAtLeastOneLang");
    if (!v.area.trim()) e.area = t("required");
    if (v.skills.length === 0) e.skills = t("pickAtLeastOneSkill");
    if (!v.years_experience || parseInt(v.years_experience, 10) <= 0) e.years_experience = t("expRequired");
    if (!v.previous_employer.trim()) e.previous_employer = t("prevEmpRequired");
    if (v.aadhar_images.length === 0) e.aadhar_images = t("aadhaarRequired");
    if (!v.employment_proof_type) e.employment_proof_type = t("proofTypeRequired");
    if (v.employment_proof_images.length === 0) e.employment_proof_images = t("proofImageRequired");
    if (v.portfolio_images.length === 0) e.portfolio_images = t("portfolioRequired");
    if (v.availability_status === "available_from" && !v.available_from) e.available_from = t("pickAvailableDate");
    setErrors(e);
    if (Object.keys(e).length > 0) {
      show(Object.values(e)[0], "error");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (validate()) {
      storage.removeItem("form_draft");
      onSubmit(v);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {showMobile && (
          <Field
            label={t("workerMobile")}
            value={v.mobile || ""}
            onChangeText={(x) => set("mobile", x.replace(/[^0-9]/g, ""))}
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.mobile}
            testID="form-mobile"
          />
        )}

        <Field
          label={t("fullName")}
          value={v.full_name}
          onChangeText={(x) => set("full_name", x)}
          placeholder={t("fullNamePh")}
          maxLength={80}
          autoCapitalize="words"
          error={errors.full_name}
          testID="form-name"
        />


        {/* Gender */}
        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>
          {t("gender")}
        </AppText>
        <View style={styles.row}>
          {GENDERS.map((g) => (
            <Chip key={g.value} label={t(g.key)} selected={v.gender === g.value} onPress={() => set("gender", g.value)} testID={`gender-${g.value}`} />
          ))}
        </View>

        {/* Languages */}
        <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
          {t("languagesSpoken")}
        </AppText>
        <View style={styles.wrap}>
          {SPOKEN_LANGUAGES.map((l) => (
            <Chip key={l} label={l} selected={v.languages.includes(l)} onPress={() => toggle("languages", l)} testID={`lang-${l}`} />
          ))}
        </View>

        <View style={{ height: SPACING.lg }} />
        <Pressable
          onPress={detectLocation}
          disabled={locating}
          style={[styles.detectLocationBtn, locating && { opacity: 0.6 }]}
          testID="detect-location-btn"
        >
          <Ionicons name="locate" size={18} color={COLORS.brandPrimary} />
          <AppText size="sm" weight="semibold" color={COLORS.brandPrimary} style={{ marginLeft: SPACING.xs }}>
            {locating ? t("detectingLocation") : t("detectMyLocation")}
          </AppText>
        </Pressable>
        <Field
          label={t("area")}
          value={v.area}
          onChangeText={(x) =>
            setV((p) => ({
              ...p,
              area: x,
              ...(gpsFilledArea !== null && x !== gpsFilledArea
                ? { location_lat: null, location_lng: null }
                : {}),
            }))
          }
          placeholder={t("areaPh")}
          maxLength={100}
          error={errors.area}
          testID="form-area"
        />
        <Field label={t("city")} value={v.city} onChangeText={(x) => set("city", x)} maxLength={60} testID="form-city" />

        {/* Skills — category → sub-skill */}
        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>
          {t("skills")}
        </AppText>
        <View style={{ gap: SPACING.sm }}>
          {SKILL_CATEGORIES.map((cat) => {
            const isLeaf = cat.subs.length === 0;
            const count = isLeaf
              ? v.skills.includes(cat.label)
                ? 1
                : 0
              : cat.subs.filter((s) => v.skills.includes(s)).length;
            const open = expandedCat === cat.key;
            const active = count > 0;
            return (
              <View key={cat.key} style={[styles.catWrap, active && { borderColor: COLORS.brandPrimary }]}>
                <Pressable
                  style={styles.catHeader}
                  onPress={() => (isLeaf ? toggle("skills", cat.label) : setExpandedCat(open ? null : cat.key))}
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
                  <AppText weight="semibold" style={{ flex: 1 }}>
                    {cat.label}
                  </AppText>
                  {!isLeaf && count > 0 && (
                    <View style={styles.catCount}>
                      <AppText size="sm" weight="bold" color={COLORS.onBrandPrimary}>
                        {count}
                      </AppText>
                    </View>
                  )}
                  {!isLeaf && <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={COLORS.muted} />}
                </Pressable>
                {open && !isLeaf && (
                  <View style={styles.catBody}>
                    {cat.subs.map((s) => (
                      <Chip key={s} label={s} selected={v.skills.includes(s)} onPress={() => toggle("skills", s)} testID={`skill-${s}`} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {errors.skills && (
          <AppText size="sm" color={COLORS.error} style={{ marginTop: 4 }}>
            {errors.skills}
          </AppText>
        )}

        <View style={{ height: SPACING.lg }} />
        <Field label={t("experience")} value={v.years_experience} onChangeText={(x) => set("years_experience", x.replace(/[^0-9]/g, ""))} keyboardType="numeric" maxLength={2} error={errors.years_experience} testID="form-exp" />
        <Field label={t("currentEmployer")} value={v.current_employer} onChangeText={(x) => set("current_employer", x)} optional={t("optional")} maxLength={100} testID="form-curemp" />
        <Field label={t("prevEmployer")} value={v.previous_employer} onChangeText={(x) => set("previous_employer", x)} maxLength={100} error={errors.previous_employer} testID="form-prevemp" />

        {/* Aadhaar card upload */}
        <AppText weight="semibold" style={{ marginBottom: 2 }}>{t("aadhaarCard")}</AppText>
        <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.sm }}>{t("uploadAadhaarMulti")}</AppText>
        <MultiDocUpload images={v.aadhar_images} onAdd={() => pickMulti("aadhar_images")} onRemove={(i) => removeAt("aadhar_images", i)} error={errors.aadhar_images} testID="aadhaar-upload" />

        {/* Proof of previous employment */}
        <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>{t("employmentProof")}</AppText>
        <View style={[styles.dropdown, errors.employment_proof_type && { borderColor: COLORS.error }]}>
          <Pressable style={styles.dropdownHeader} onPress={() => setProofOpen((o) => !o)} testID="proof-type-dropdown">
            <AppText color={v.employment_proof_type ? COLORS.onSurface : COLORS.muted} style={{ flex: 1 }}>
              {v.employment_proof_type ? t(PROOF_TYPES.find((p) => p.value === v.employment_proof_type)!.key) : t("selectProofType")}
            </AppText>
            <Ionicons name={proofOpen ? "chevron-up" : "chevron-down"} size={20} color={COLORS.muted} />
          </Pressable>
          {proofOpen && (
            <View style={styles.dropdownBody}>
              {PROOF_TYPES.map((p) => {
                const sel = v.employment_proof_type === p.value;
                return (
                  <Pressable key={p.value} style={styles.dropdownItem} onPress={() => { set("employment_proof_type", p.value); setProofOpen(false); }} testID={`proof-opt-${p.value}`}>
                    <AppText color={sel ? COLORS.brandPrimary : COLORS.onSurface} weight={sel ? "bold" : "regular"} style={{ flex: 1 }}>
                      {t(p.key)}
                    </AppText>
                    {sel && <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        {errors.employment_proof_type && (
          <AppText size="sm" color={COLORS.error} style={{ marginTop: 4 }}>{errors.employment_proof_type}</AppText>
        )}
        <AppText size="sm" color={COLORS.muted} style={{ marginTop: SPACING.md, marginBottom: SPACING.sm }}>{t("uploadProofDocMulti")}</AppText>
        <MultiDocUpload images={v.employment_proof_images} onAdd={() => pickMulti("employment_proof_images")} onRemove={(i) => removeAt("employment_proof_images", i)} error={errors.employment_proof_images} testID="proof-upload" />

        <View style={{ height: SPACING.lg }} />
        <Field label={t("wage")} value={v.wage_expectation} onChangeText={(x) => set("wage_expectation", x.replace(/[^0-9]/g, ""))} keyboardType="numeric" optional={t("optional")} maxLength={6} testID="form-wage" />
        <Field label={t("phonepeGpay")} value={v.upi_id} onChangeText={(x) => set("upi_id", x.replace(/[^0-9]/g, ""))} placeholder={t("phonepePh")} keyboardType="phone-pad" maxLength={10} optional={t("optional")} autoCapitalize="none" testID="form-upi" />

        {showReferral && (
          <Field label={t("referredBy")} value={v.referred_by_code} onChangeText={(x) => set("referred_by_code", x.toUpperCase())} placeholder={t("referredByPh")} autoCapitalize="none" testID="form-referredby" />
        )}

        {/* Portfolio (mandatory) */}
        <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>
          {t("portfolio")}
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
          {v.portfolio_images.map((img, i) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
              <Pressable
                style={styles.thumbX}
                onPress={() => removeAt("portfolio_images", i)}
                testID={`remove-photo-${i}`}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={[styles.addPhoto, errors.portfolio_images && v.portfolio_images.length === 0 && { borderColor: COLORS.error }]}
            onPress={pickImage}
            testID="add-photo-btn"
          >
            <Ionicons name="camera" size={24} color={COLORS.brandPrimary} />
            <AppText size="sm" color={COLORS.brandPrimary} style={{ marginTop: 4 }}>
              {t("addPhoto")}
            </AppText>
          </Pressable>
        </ScrollView>
        {errors.portfolio_images && (
          <AppText size="sm" color={COLORS.error} style={{ marginTop: 4 }}>
            {errors.portfolio_images}
          </AppText>
        )}

        {/* Availability */}
        <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
          {t("availability")}
        </AppText>
        <View style={{ gap: SPACING.sm }}>
          {AVAILABILITY_OPTIONS.map((o) => {
            const active = v.availability_status === o.value;
            const c = availabilityColor(o.value);
            return (
              <View key={o.value}>
                <Pressable
                  onPress={() => set("availability_status", o.value)}
                  style={[styles.availRow, { borderColor: active ? c : COLORS.border, backgroundColor: active ? c + "12" : COLORS.surfaceSecondary }]}
                  testID={`avail-${o.value}`}
                >
                  <View style={[styles.availDot, { backgroundColor: c }]} />
                  <AppText weight={active ? "bold" : "medium"} color={active ? c : COLORS.onSurface}>
                    {t(o.key)}
                  </AppText>
                  {o.value === "available_from" && active && v.available_from ? (
                    <AppText size="sm" weight="semibold" color={c} style={{ marginLeft: SPACING.sm }}>
                      · {formatDate(v.available_from)}
                    </AppText>
                  ) : null}
                  {active && <Ionicons name="checkmark-circle" size={20} color={c} style={{ marginLeft: "auto" }} />}
                </Pressable>
                {o.value === "available_from" && active && (
                  <View style={{ marginTop: SPACING.sm }}>
                    <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>
                      {t("pickAvailableDate")}
                    </AppText>
                    <Calendar
                      value={v.available_from || null}
                      onSelect={(iso) => set("available_from", iso)}
                      testID="availfrom-calendar"
                    />
                    {errors.available_from && (
                      <AppText size="sm" color={COLORS.error} style={{ marginTop: 4 }}>
                        {errors.available_from}
                      </AppText>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Button title={submitLabel} onPress={handleSubmit} loading={submitting} testID="form-submit-btn" />
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  minHeight: 52,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: RADIUS.md,
  paddingHorizontal: SPACING.md,
  fontSize: FONT.lg,
  color: COLORS.onSurface,
  backgroundColor: COLORS.surfaceSecondary,
} as const;

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACING.sm },
  
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  catWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary, overflow: "hidden" },
  catHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, minHeight: 56 },
  catCheck: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginRight: 4 },
  catBody: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  thumbWrap: { position: "relative" },
  thumb: { width: 88, height: 88, borderRadius: RADIUS.md },
  thumbX: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.brandTertiary,
  },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  availDot: { width: 14, height: 14, borderRadius: 7 },
  dropdown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary, overflow: "hidden" },
  dropdownHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, minHeight: 52 },
  dropdownBody: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  dropdownItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, minHeight: 48, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  docThumbWrap: { position: "relative" },
  docThumb: { width: 100, height: 100, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary },
  docAddTile: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    backgroundColor: COLORS.brandTertiary,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  detectLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.md,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brandPrimary,
    backgroundColor: COLORS.brandTertiary,
    marginBottom: SPACING.md,
  },
});
