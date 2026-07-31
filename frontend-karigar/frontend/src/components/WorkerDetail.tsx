import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, Avatar, StatusBadge, Card } from "@/src/components/ui";
import { Worker, ProfileVersion, availabilityColor, verificationColor, calcAge, formatDate } from "@/src/utils/profile";

function aKey(s: string) { return s === "available_now" ? "avail_now" : s === "available_from" ? "avail_from" : "avail_no"; }
function vKey(s: string) { return s === "approved" ? "verified" : s === "pending" ? "pending" : "rejected"; }

export default function WorkerDetail({ worker, contentBottom = 40 }: { worker: Worker; contentBottom?: number }) {
  const { t } = useTranslation();
  const [viewer, setViewer] = React.useState<string | null>(null);
  const availLabel = worker.availability_status === "available_from" && worker.available_from
    ? `${t("avail_from")} · ${formatDate(worker.available_from)}`
    : t(aKey(worker.availability_status));
  return (
    <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: contentBottom }} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Avatar name={worker.full_name} size={64} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold" size="xl" numberOfLines={1}>{worker.full_name}</AppText>
          {worker.worker_id && (
            <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>
              EMP_ID: {worker.worker_id}
            </AppText>
          )}
          <AppText size="sm" color={COLORS.muted}>+91 {worker.phone}</AppText>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
        <StatusBadge label={t(vKey(worker.verification_status))} color={verificationColor(worker.verification_status)} />
        <StatusBadge label={availLabel} color={availabilityColor(worker.availability_status)} />
      </View>

      {worker.verification_status === "rejected" && worker.rejection_reason && (
        <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: COLORS.error }]}>
          <AppText weight="semibold" color={COLORS.error}>{t("rejectionReason")}</AppText>
          <AppText style={{ marginTop: 4 }}>{worker.rejection_reason}</AppText>
        </Card>
      )}

      {worker.duplicate_flags && worker.duplicate_flags.length > 0 && (
        <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: COLORS.warning }]} testID="duplicate-flags-banner">
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginBottom: SPACING.xs }}>
            <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
            <AppText weight="semibold" color={COLORS.warning}>{t("duplicateFlagsTitle")}</AppText>
          </View>
          {worker.duplicate_flags.map((flag, i) => (
            <AppText key={i} size="sm" style={{ marginTop: i > 0 ? 4 : 0 }}>{flag}</AppText>
          ))}
        </Card>
      )}

      <Card style={styles.card}>
        {worker.dob ? <Row label={t("dob")} value={`${worker.dob} (${calcAge(worker.dob)} ${t("yearsShort")})`} /> : null}
        <Row label={t("gender")} value={t(worker.gender)} />
        <Row label={t("area")} value={`${worker.area}, ${worker.city}`} />
        <Row label={t("experience")} value={`${worker.years_experience} ${t("yearsShort")}`} />
        {worker.wage_expectation ? <Row label={t("wage")} value={`₹${worker.wage_expectation} ${t("perMonth")}`} /> : null}
        {worker.current_employer ? <Row label={t("currentEmployer")} value={worker.current_employer} /> : null}
        {worker.previous_employer ? <Row label={t("prevEmployer")} value={worker.previous_employer} /> : null}
        <Row label={t("languagesSpoken")} value={worker.languages.join(", ")} last />
      </Card>

      {worker.referred_by && (
        <Card style={[styles.card, { marginTop: 0, borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary }]}>
          <View style={styles.refRow}>
            <Ionicons name="people-outline" size={18} color={COLORS.brandPrimary} />
            <View style={{ flex: 1 }}>
              <AppText size="sm" color={COLORS.muted}>{t("referredByPerson")}</AppText>
              <AppText weight="semibold">{worker.referred_by.name}</AppText>
            </View>
            <AppText size="sm" weight="semibold" color={COLORS.muted}>+91 {worker.referred_by.phone}</AppText>
          </View>
        </Card>
      )}

      <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("skills")}</AppText>
      <View style={styles.wrap}>
        {worker.skills.map((s) => (
          <View key={s} style={styles.tag}>
            <AppText size="sm" weight="semibold" color={COLORS.onBrandTertiary}>{s}</AppText>
          </View>
        ))}
      </View>

      {worker.portfolio_images.length > 0 && (
        <View style={{ marginTop: SPACING.lg }}>
          <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("portfolio")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
            {worker.portfolio_images.map((img, i) => (
              <Pressable key={i} onPress={() => setViewer(img)} testID={`portfolio-img-${i}`}>
                <Image source={{ uri: img }} style={styles.portfolio} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {((worker.aadhar_images && worker.aadhar_images.length > 0) ||
        (worker.employment_proof_images && worker.employment_proof_images.length > 0)) && (
        <View style={{ marginTop: SPACING.lg }}>
          <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("documents")}</AppText>
          {worker.aadhar_images && worker.aadhar_images.length > 0 && (
            <View style={{ marginBottom: SPACING.md }}>
              <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>
                {t("aadhaarCard")} ({worker.aadhar_images.length})
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
                {worker.aadhar_images.map((img, i) => (
                  <Pressable key={i} onPress={() => setViewer(img)} testID={`aadhaar-img-${i}`}>
                    <Image source={{ uri: img }} style={styles.docThumb} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {worker.employment_proof_images && worker.employment_proof_images.length > 0 && (
            <View>
              <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>
                {t("employmentProof")}{worker.employment_proof_type ? ` · ${t("proof_" + ({ payslip: "payslip", onsite_photo: "onsite", salary_statement: "salary", appointment_letter: "appointment" } as Record<string, string>)[worker.employment_proof_type])}` : ""} ({worker.employment_proof_images.length})
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
                {worker.employment_proof_images.map((img, i) => (
                  <Pressable key={i} onPress={() => setViewer(img)} testID={`proof-img-${i}`}>
                    <Image source={{ uri: img }} style={styles.docThumb} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {worker.history && worker.history.length > 0 && <VersionHistory history={worker.history} onImagePress={setViewer} />}

      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
    </ScrollView>
  );
}

function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewerBackdrop} onPress={onClose} testID="image-viewer-backdrop">
        <Pressable style={styles.viewerClose} onPress={onClose} testID="image-viewer-close">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {!!uri && <Image source={{ uri }} style={styles.viewerImage} contentFit="contain" />}
      </Pressable>
    </Modal>
  );
}

const IMAGE_FIELDS = new Set(["portfolio_images", "aadhar_images", "employment_proof_images"]);

function VersionHistory({ history, onImagePress }: { history: ProfileVersion[]; onImagePress: (uri: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const ordered = [...history].reverse(); // newest archived first

  const labelFor = (field: string): string => {
    const map: Record<string, string> = {
      full_name: t("fullName"),
      dob: t("dob"),
      gender: t("gender"),
      languages: t("languagesSpoken"),
      area: t("area"),
      city: t("city"),
      skills: t("skills"),
      years_experience: t("experience"),
      current_employer: t("currentEmployer"),
      previous_employer: t("prevEmployer"),
      wage_expectation: t("wage"),
      upi_id: t("phonepeGpay"),
      portfolio_images: t("portfolio"),
      aadhar_images: t("aadhaarCard"),
      employment_proof_type: t("employmentProof") + " Type",
      employment_proof_images: t("employmentProof"),
      availability_status: t("availability"),
      available_from: t("avail_from"),
      verification_status: t("statusLabel"),
      location_lat: "Latitude",
      location_lng: "Longitude",
    };
    return map[field] || field;
  };

  const formatValue = (field: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "—";
    switch (field) {
      case "dob":
        return `${value} (${calcAge(value)} ${t("yearsShort")})`;
      case "gender":
        return t(value);
      case "years_experience":
        return `${value} ${t("yearsShort")}`;
      case "wage_expectation":
        return `₹${value} ${t("perMonth")}`;
      case "languages":
      case "skills":
        return Array.isArray(value) && value.length > 0 ? value.join(", ") : "—";
      case "availability_status":
        return t(aKey(value));
      case "verification_status":
        return t(vKey(value));
      default:
        return String(value);
    }
  };

  return (
    <View style={{ marginTop: SPACING.lg }}>
      <Pressable style={styles.histHeader} onPress={() => setOpen((o) => !o)} testID="version-history-toggle">
        <Ionicons name="time-outline" size={18} color={COLORS.brandPrimary} />
        <AppText weight="semibold" style={{ flex: 1 }}>
          {t("versionHistory")} ({history.length})
        </AppText>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={COLORS.muted} />
      </Pressable>
      {open &&
        ordered.map((h, idx) => {
          const hasDiff = !!h.changed_fields;
          const entries = hasDiff ? Object.entries(h.changed_fields as Record<string, any>) : [];
          const fieldEntries = entries.filter(([field]) => !IMAGE_FIELDS.has(field));
          const imageEntries = entries.filter(([field]) => IMAGE_FIELDS.has(field));

          return (
            <View key={idx} style={styles.histCard} testID={`version-${idx}`}>
              <View style={styles.histTop}>
                <AppText size="sm" weight="bold" color={COLORS.onSurface}>
                  {t("version")} {ordered.length - idx}
                </AppText>
                <View style={styles.editedByPill}>
                  <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>
                    {h.edited_by === "admin" ? t("byAdmin") : t("byWorker")}
                  </AppText>
                </View>
                <AppText size="sm" color={COLORS.muted} style={{ marginLeft: "auto" }}>
                  {formatDate(h.archived_at)}
                </AppText>
              </View>

              {hasDiff ? (
                <>
                  {fieldEntries.length === 0 && imageEntries.length === 0 ? (
                    <AppText size="sm" color={COLORS.muted} style={{ paddingVertical: SPACING.sm }}>
                      No field changes recorded
                    </AppText>
                  ) : fieldEntries.length > 0 ? (
                    <DiffTable
                      rows={fieldEntries.map(([field, pair]) => ({
                        field,
                        label: labelFor(field),
                        oldValue: formatValue(field, pair.old),
                        newValue: formatValue(field, pair.new),
                      }))}
                    />
                  ) : null}
                  {imageEntries.map(([field, pair]) => (
                    <DiffImageStrip
                      key={field}
                      label={labelFor(field)}
                      oldImages={pair.old || []}
                      newImages={pair.new || []}
                      onImagePress={onImagePress}
                    />
                  ))}
                </>
              ) : (
                <LegacyVersionRows h={h} t={t} onImagePress={onImagePress} />
              )}
            </View>
          );
        })}
    </View>
  );
}

function DiffTable({ rows }: { rows: { field: string; label: string; oldValue: string; newValue: string }[] }) {
  return (
    <View style={styles.diffTable}>
      <View style={styles.diffTableHeaderRow}>
        <AppText size="sm" weight="bold" color={COLORS.muted} style={styles.diffColField}>Field</AppText>
        <AppText size="sm" weight="bold" color={COLORS.muted} style={styles.diffColValue}>Before</AppText>
        <AppText size="sm" weight="bold" color={COLORS.muted} style={styles.diffColValue}>After</AppText>
      </View>
      {rows.map((r, i) => (
        <View key={r.field} style={[styles.diffTableRow, i !== rows.length - 1 && styles.histBorder]}>
          <AppText size="sm" color={COLORS.onSurface} style={styles.diffColField}>{r.label}</AppText>
          <AppText size="sm" color={COLORS.error} style={[styles.diffColValue, styles.strikethrough]}>{r.oldValue}</AppText>
          <AppText size="sm" weight="semibold" color={COLORS.success} style={styles.diffColValue}>{r.newValue}</AppText>
        </View>
      ))}
    </View>
  );
}

function DiffImageStrip({
  label,
  oldImages,
  newImages,
  onImagePress,
}: {
  label: string;
  oldImages: string[];
  newImages: string[];
  onImagePress: (uri: string) => void;
}) {
  return (
    <View style={{ marginTop: SPACING.md }}>
      <AppText size="sm" weight="semibold" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>
        {label} ({oldImages.length} → {newImages.length})
      </AppText>
      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <View style={{ flex: 1 }}>
          <AppText size="sm" color={COLORS.error} style={{ marginBottom: 4 }}>Before</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
            {oldImages.map((img, i) => (
              <Pressable key={i} onPress={() => onImagePress(img)}>
                <Image source={{ uri: img }} style={styles.histThumbSmall} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View style={{ flex: 1 }}>
          <AppText size="sm" color={COLORS.success} style={{ marginBottom: 4 }}>After</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
            {newImages.map((img, i) => (
              <Pressable key={i} onPress={() => onImagePress(img)}>
                <Image source={{ uri: img }} style={styles.histThumbSmall} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// Renders history entries saved before the diff-based format existed —
// these still store the full profile snapshot, not changed_fields.
function LegacyVersionRows({ h, t, onImagePress }: { h: ProfileVersion; t: (k: string, o?: any) => string; onImagePress: (uri: string) => void }) {
  return (
    <>
      <HistRow label={t("fullName")} value={h.full_name || "—"} />
      {h.dob ? <HistRow label={t("dob")} value={`${h.dob} (${calcAge(h.dob)} ${t("yearsShort")})`} /> : null}
      {h.gender ? <HistRow label={t("gender")} value={t(h.gender)} /> : null}
      {h.area || h.city ? <HistRow label={t("area")} value={`${h.area || "—"}, ${h.city || "—"}`} /> : null}
      {h.years_experience != null ? <HistRow label={t("experience")} value={`${h.years_experience} ${t("yearsShort")}`} /> : null}
      {h.wage_expectation != null ? <HistRow label={t("wage")} value={`₹${h.wage_expectation} ${t("perMonth")}`} /> : null}
      {h.current_employer ? <HistRow label={t("currentEmployer")} value={h.current_employer} /> : null}
      {h.previous_employer ? <HistRow label={t("prevEmployer")} value={h.previous_employer} /> : null}
      {h.languages && h.languages.length > 0 ? <HistRow label={t("languagesSpoken")} value={h.languages.join(", ")} /> : null}
      {h.skills && h.skills.length > 0 ? <HistRow label={t("skills")} value={h.skills.join(", ")} /> : null}
      {h.upi_id ? <HistRow label={t("phonepeGpay")} value={h.upi_id} /> : null}
      {h.availability_status ? (
        <HistRow
          label={t("availability")}
          value={
            h.availability_status === "available_from" && h.available_from
              ? `${t("avail_from")} · ${formatDate(h.available_from)}`
              : t(aKey(h.availability_status))
          }
        />
      ) : null}
      {h.verification_status ? <HistRow label={t("statusLabel")} value={t(vKey(h.verification_status))} last /> : null}

      {h.portfolio_images && h.portfolio_images.length > 0 && (
        <HistImageStrip label={`${t("portfolio")} (${h.portfolio_images.length})`} images={h.portfolio_images} onImagePress={onImagePress} />
      )}
      {h.aadhar_images && h.aadhar_images.length > 0 && (
        <HistImageStrip label={`${t("aadhaarCard")} (${h.aadhar_images.length})`} images={h.aadhar_images} onImagePress={onImagePress} />
      )}
      {h.employment_proof_images && h.employment_proof_images.length > 0 && (
        <HistImageStrip
          label={`${t("employmentProof")}${h.employment_proof_type ? ` · ${t("proof_" + ({ payslip: "payslip", onsite_photo: "onsite", salary_statement: "salary", appointment_letter: "appointment" } as Record<string, string>)[h.employment_proof_type])}` : ""} (${h.employment_proof_images.length})`}
          images={h.employment_proof_images}
          onImagePress={onImagePress}
        />
      )}
    </>
  );
}

function HistImageStrip({ label, images, onImagePress }: { label: string; images: string[]; onImagePress: (uri: string) => void }) {
  return (
    <View style={{ marginTop: SPACING.md }}>
      <AppText size="sm" weight="semibold" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>{label}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
        {images.map((img, i) => (
          <Pressable key={i} onPress={() => onImagePress(img)}>
            <Image source={{ uri: img }} style={styles.histThumb} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HistRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.histRow, !last && styles.histBorder]}>
      <AppText size="sm" color={COLORS.muted}>{label}</AppText>
      <AppText size="sm" weight="semibold" style={{ flex: 1, textAlign: "right", marginLeft: SPACING.md }}>{value}</AppText>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <AppText color={COLORS.muted} size="base">{label}</AppText>
      <AppText weight="semibold" size="base" style={{ flex: 1, textAlign: "right", marginLeft: SPACING.md }}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  card: { marginVertical: SPACING.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill },
  portfolio: { width: 120, height: 120, borderRadius: RADIUS.md },
  docThumb: { width: 130, height: 130, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary },
  histHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  histCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  histTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.xs },
  editedByPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.brandTertiary },
  histRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  diffTable: { marginTop: 4 },
  diffTableHeaderRow: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  diffTableRow: { flexDirection: "row", paddingVertical: 8 },
  diffColField: { flex: 1 },
  diffColValue: { flex: 1, paddingLeft: SPACING.sm },
  strikethrough: { textDecorationLine: "line-through" },
  histBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  histThumb: { width: 110, height: 110, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary },
  histThumbSmall: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary },
  refRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  viewerClose: { position: "absolute", top: 48, right: SPACING.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  viewerImage: { width: "100%", height: "85%" },
});
