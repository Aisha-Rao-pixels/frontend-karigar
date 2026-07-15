// ── Generic resizable data table ────────────────────────────────────────────
// The ONE table component for the whole app. Any new table should use this,
// not a one-off ScrollView/FlatList — that's how we guarantee every table
// gets full-space layout + both scrollbars + resizable columns for free.
//
// Layout (important — this is why both scrollbars are reliable):
//   <View flex:1>                                  full available space
//     <ScrollView horizontal flex:1>                 <- horizontal scrollbar
//       <View minWidth:{totalColumnWidth} flex:1>     stretches to fill OR
//                                                      overflows to scroll
//         <ScrollView flex:1 stickyHeaderIndices=[0]> <- vertical scrollbar
//           header row (sticky)
//           data rows
//
// We deliberately do NOT nest a FlatList inside a horizontal ScrollView —
// that combo (VirtualizedList inside a plain ScrollView) is unreliable for
// width measurement on web and is the reason horizontal scrolling/full-width
// filling was flaky before. Plain ScrollView + map() is fine for admin
// tables (hundreds of rows, not tens of thousands).
//
// Usage:
//   <ResizableTable
//     storageKey="admin_search_table"
//     columns={[
//       { key: "name", label: "Name", width: 160, render: (w) => <AppText>{w.full_name}</AppText> },
//       ...
//     ]}
//     data={items}
//     keyExtractor={(w) => w.id}
//     onRowPress={(w) => router.push(`/admin/worker/${w.id}`)}
//   />
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, RefreshControl } from "react-native";
import { COLORS, SPACING } from "@/src/theme";
import { AppText } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";

export type ResizableTableColumn<T> = {
  key: string;
  label: string;
  /** Default/initial width in px. */
  width: number;
  minWidth?: number;
  /** Set false for narrow index-style columns that shouldn't be draggable. */
  resizable?: boolean;
  render: (item: T, index: number) => React.ReactNode;
};

type Props<T> = {
  columns: ResizableTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowPress?: (item: T) => void;
  testIDPrefix?: string;
  /** Persists column widths under this key (per-table). Omit to skip persistence. */
  storageKey?: string;
  emptyText?: string;
  /** Optional zebra-striping / custom row background. */
  rowBackground?: (item: T, index: number) => string | undefined;
  /** Optional pull-to-refresh support. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

const DEFAULT_MIN_WIDTH = 56;

function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  const dragging = useRef(false);

  // Touch-drag resize isn't worth the complexity on a phone screen —
  // native tables keep default/persisted widths, web gets the drag handle.
  if (Platform.OS !== "web") return null;

  const onMouseDown = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    let lastX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
      onResize(delta);
    };
    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <View
      // @ts-ignore - web-only pointer handler + cursor style
      onMouseDown={onMouseDown}
      // @ts-ignore
      style={[styles.resizeHandle, Platform.OS === "web" ? { cursor: "col-resize" } : null]}
    />
  );
}

export function ResizableTable<T>({
  columns,
  data,
  keyExtractor,
  onRowPress,
  testIDPrefix = "table",
  storageKey,
  emptyText = "No data",
  rowBackground,
  refreshing,
  onRefresh,
}: Props<T>) {
  const defaultWidths = React.useMemo(() => {
    const w: Record<string, number> = {};
    columns.forEach((c) => { w[c.key] = c.width; });
    return w;
  }, [columns]);

  const [colWidths, setColWidths] = useState<Record<string, number>>(defaultWidths);

  // Restore persisted widths on mount.
  useEffect(() => {
    if (!storageKey) return;
    storage.getItem<string | null>(`${storageKey}_col_widths`, null).then((v) => {
      if (!v) return;
      try {
        const parsed = JSON.parse(v);
        setColWidths((w) => ({ ...w, ...parsed }));
      } catch {
        // ignore corrupt/old value
      }
    });
  }, [storageKey]);

  const resizeColumn = useCallback(
    (key: string, delta: number, minWidth: number) => {
      setColWidths((w) => {
        const next = { ...w, [key]: Math.max(minWidth, (w[key] ?? minWidth) + delta) };
        if (storageKey) storage.setItem(`${storageKey}_col_widths`, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const totalWidth = columns.reduce((sum, c) => sum + (colWidths[c.key] ?? c.width), 0);

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Outer horizontal scroll — this is what gives the horizontal scrollbar.
          minWidth:"100%" on contentContainerStyle lets the inner column fill
          the full screen width when the table is narrower than the viewport,
          and overflow (triggering the scrollbar) when it's wider. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.hScroll}
        contentContainerStyle={{ minWidth: "100%", flexGrow: 1 }}
      >
        <View style={{ flex: 1, minWidth: totalWidth }}>
          {/* Inner vertical scroll — native stickyHeaderIndices keeps the
              header pinned while rows scroll underneath it. */}
          <ScrollView
            style={styles.vScroll}
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />
              ) : undefined
            }
          >
            {/* Header (sticky, index 0) */}
            <View style={[styles.headerRow, { minWidth: totalWidth }]}>
              {columns.map((col) => (
                <View key={col.key} style={[styles.headerCell, { width: colWidths[col.key] ?? col.width }]}>
                  <AppText weight="bold" size="sm" numberOfLines={1} color={COLORS.onBrandPrimary}>
                    {col.label}
                  </AppText>
                  {col.resizable !== false && (
                    <ResizeHandle
                      onResize={(delta) => resizeColumn(col.key, delta, col.minWidth ?? DEFAULT_MIN_WIDTH)}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* Rows */}
            {data.length === 0 ? (
              <View style={{ padding: SPACING.xl, minWidth: totalWidth }}>
                <AppText color={COLORS.muted}>{emptyText}</AppText>
              </View>
            ) : (
              data.map((item, index) => (
                <Pressable
                  key={keyExtractor(item)}
                  onPress={() => onRowPress?.(item)}
                  style={[
                    styles.row,
                    { minWidth: totalWidth },
                    { backgroundColor: rowBackground?.(item, index) ?? (index % 2 === 0 ? COLORS.surfaceSecondary : COLORS.surface) },
                  ]}
                  testID={`${testIDPrefix}-row-${keyExtractor(item)}`}
                >
                  {columns.map((col) => (
                    <View key={col.key} style={[styles.cell, { width: colWidths[col.key] ?? col.width }]}>
                      {col.render(item, index)}
                    </View>
                  ))}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", alignSelf: "stretch" },
  hScroll: { flex: 1, width: "100%" },
  vScroll: { flex: 1, width: "100%" },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.brandPrimary, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  headerCell: { position: "relative", paddingHorizontal: 6, justifyContent: "center" },
  resizeHandle: { position: "absolute", right: -4, top: 0, bottom: 0, width: 8, zIndex: 2 },
  row: { flexDirection: "row", paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cell: { paddingHorizontal: 6, justifyContent: "center" },
});
