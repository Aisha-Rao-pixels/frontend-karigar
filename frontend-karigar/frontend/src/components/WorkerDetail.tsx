import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, Avatar, StatusBadge, Card } from "@/src/components/ui";
import { Worker, ProfileVersion, availabilityColor, verificationColor, calcAge, formatDate } from "@/src/utils/profile";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

const AnimatedImage = Animated.createAnimatedComponent(Image);

function aKey(s: string) { return s === "available_now" ? "avail_now" : s === "available_from" ? "avail_from" : "avail_no"; }
function vKey(s: string) { return s === "approved" ? "verified" : s === "pending" ? "pending" : "rejected"; }

interface ViewerTarget {
  uri: string;
  field?: "portfolio_images" | "aadhar_images" | "employment_proof_images";
  index?: number;
}

export default function WorkerDetail({
  worker,
  contentBottom = 40,
  onWorkerUpdated,
}: {
  worker: Worker;
  contentBottom?: number;
  onWorkerUpdated?: (w: Worker) => void;
}) {
  const { t } = useTranslation();
  const [viewer, setViewer] = React.useState<ViewerTarget | null>(null);
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
              <Pressable key={i} onPress={() => setViewer({ uri: img, field: "portfolio_images", index: i })} testID={`portfolio-img-${i}`}>
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
                  <Pressable key={i} onPress={() => setViewer({ uri: img, field: "aadhar_images", index: i })} testID={`aadhaar-img-${i}`}>
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
                  <Pressable key={i} onPress={() => setViewer({ uri: img, field: "employment_proof_images", index: i })} testID={`proof-img-${i}`}>
                    <Image source={{ uri: img }} style={styles.docThumb} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {worker.history && worker.history.length > 0 && <VersionHistory history={worker.history} onImagePress={(uri) => setViewer({ uri })} />}

      <ImageViewer target={viewer} workerId={worker.id} onClose={() => setViewer(null)} onSaved={onWorkerUpdated} />
    </ScrollView>
  );
}

function ImageViewer({
  target,
  workerId,
  onClose,
  onSaved,
}: {
  target: ViewerTarget | null;
  workerId?: string;
  onClose: () => void;
  onSaved?: (w: Worker) => void;
}) {
  const { show } = useToast();
  const uri = target?.uri || null;
  const canSave = !!(target?.field && target.index != null && workerId);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = React.useState<{ width: number; height: number } | null>(null);
  const [editedUri, setEditedUri] = React.useState<string | null>(null); // display uri (may be local file://)
  const [editedDataUrl, setEditedDataUrl] = React.useState<string | null>(null); // base64 data-url, ready to save
  const [hasRotated, setHasRotated] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const displaySource = editedUri || uri;
  const hasEdits = !!editedUri || hasRotated;

  const resetTransform = React.useCallback(() => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    rotation.value = withTiming(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  React.useEffect(() => {
    setEditedUri(null);
    setEditedDataUrl(null);
    setHasRotated(false);
    setNaturalSize(null);
    resetTransform();
    // naturalSize is now captured from the <AnimatedImage onLoad> handler below.
  }, [uri]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinchGesture, panGesture));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const rotate = () => {
    rotation.value = withTiming((((rotation.value + 90) % 360) + 360) % 360);
    setHasRotated(true);
  };

  const handleCrop = async () => {
    if (!uri || !naturalSize || !containerSize.width || !containerSize.height) return;
    setBusy(true);
    try {
      const s = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;
      const fitScale = Math.min(containerSize.width / naturalSize.width, containerSize.height / naturalSize.height);
      const displayedWidth = naturalSize.width * fitScale * s;
      const displayedHeight = naturalSize.height * fitScale * s;
      const imgLeft = containerSize.width / 2 - displayedWidth / 2 + tx;
      const imgTop = containerSize.height / 2 - displayedHeight / 2 + ty;

      const visLeft = Math.max(0, -imgLeft);
      const visTop = Math.max(0, -imgTop);
      const visRight = Math.min(displayedWidth, containerSize.width - imgLeft);
      const visBottom = Math.min(displayedHeight, containerSize.height - imgTop);

      const effScale = fitScale * s;
      const cropX = visLeft / effScale;
      const cropY = visTop / effScale;
      const cropW = (visRight - visLeft) / effScale;
      const cropH = (visBottom - visTop) / effScale;
      if (cropW <= 4 || cropH <= 4) return;

      const actions: any[] = [];
      if (rotation.value % 360 !== 0) actions.push({ rotate: rotation.value });
      actions.push({
        crop: {
          originX: Math.round(cropX),
          originY: Math.round(cropY),
          width: Math.round(cropW),
          height: Math.round(cropH),
        },
      });
      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      setEditedUri(result.uri);
      setEditedDataUrl(`data:image/jpeg;base64,${result.base64}`);
      setHasRotated(false);
      resetTransform();
    } catch {
      show("Could not crop that image — try again", "error");
    } finally {
      setBusy(false);
    }
  };

  const restoreOriginal = () => {
    setEditedUri(null);
    setEditedDataUrl(null);
    setHasRotated(false);
    setNaturalSize(null);
    resetTransform();
    if (uri) {
      RNImage.getSize(uri, (w, h) => setNaturalSize({ width: w, height: h }), () => setNaturalSize(null));
    }
  };

  const handleSave = async () => {
    if (!canSave || !target?.field || target.index == null || !workerId || !uri) return;
    setBusy(true);
    try {
      let finalDataUrl = editedDataUrl;
      if (!finalDataUrl && hasRotated) {
        // Rotated but never tapped "Crop to view" — bake the rotation in now.
        const result = await ImageManipulator.manipulateAsync(uri, [{ rotate: rotation.value }], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        finalDataUrl = `data:image/jpeg;base64,${result.base64}`;
      }
      if (!finalDataUrl) return;
      const updated = await apiFetch<Worker>(`/admin/workers/${workerId}/replace-image`, {
        method: "PATCH",
        body: { field: target.field, index: target.index, image: finalDataUrl },
      });
      onSaved?.(updated);
      show("Image updated", "success");
      onClose();
    } catch (e: any) {
      show(e?.message || "Could not save the edited image", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <Pressable style={styles.viewerClose} onPress={onClose} testID="image-viewer-close">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <View
          style={styles.viewerGestureArea}
          onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {!!displaySource && (
            <GestureDetector gesture={composedGesture}>
              <AnimatedImage source={{ uri: displaySource }} style={[styles.viewerImage, animatedStyle]} contentFit="contain" />
            </GestureDetector>
          )}
          {busy && (
            <View style={styles.viewerBusyOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
        </View>

        <AppText size="sm" color="rgba(255,255,255,0.6)" style={{ textAlign: "center", marginBottom: SPACING.sm }}>
          Pinch or double-tap to zoom · drag to pan
        </AppText>

        <View style={styles.viewerToolbar}>
          <Pressable style={styles.viewerToolBtn} onPress={resetTransform} testID="image-viewer-reset" disabled={busy}>
            <Ionicons name="scan-outline" size={20} color="#fff" />
            <AppText size="sm" color="#fff">Reset</AppText>
          </Pressable>
          <Pressable style={styles.viewerToolBtn} onPress={rotate} testID="image-viewer-rotate" disabled={busy}>
            <Ionicons name="reload-outline" size={20} color="#fff" />
            <AppText size="sm" color="#fff">Rotate</AppText>
          </Pressable>
          <Pressable style={styles.viewerToolBtn} onPress={handleCrop} testID="image-viewer-crop" disabled={busy}>
            <Ionicons name="crop-outline" size={20} color="#fff" />
            <AppText size="sm" color="#fff">Crop to view</AppText>
          </Pressable>
          {editedUri && (
            <Pressable style={styles.viewerToolBtn} onPress={restoreOriginal} testID="image-viewer-restore" disabled={busy}>
              <Ionicons name="arrow-undo-outline" size={20} color="#fff" />
              <AppText size="sm" color="#fff">Original</AppText>
            </Pressable>
          )}
        </View>

        {canSave && (
          <Pressable
            style={[styles.viewerSaveBtn, !hasEdits && styles.viewerSaveBtnDisabled]}
            onPress={handleSave}
            disabled={busy || !hasEdits}
            testID="image-viewer-save"
          >
            <Ionicons name="save-outline" size={18} color="#fff" />
            <AppText weight="semibold" color="#fff" style={{ marginLeft: 6 }}>
              {hasEdits ? "Save changes" : "No changes to save"}
            </AppText>
          </Pressable>
        )}
      </View>
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
  viewerGestureArea: { width: "100%", height: "72%", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  viewerImage: { width: "100%", height: "100%" },
  viewerBusyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  viewerToolbar: { flexDirection: "row", gap: SPACING.lg, justifyContent: "center", flexWrap: "wrap" },
  viewerToolBtn: { alignItems: "center", gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  viewerSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  viewerSaveBtnDisabled: { backgroundColor: COLORS.surfaceTertiary },
});
