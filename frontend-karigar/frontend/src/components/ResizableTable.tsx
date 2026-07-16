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
//           filter row (sticky, sits just below header)
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
//       { key: "name", label: "Name", width: 160, sortable: true, filterable: true,
//         render: (w) => <AppText>{w.full_name}</AppText>,
//         sortValue: (w) => w.full_name },
//       ...
//     ]}
//     data={items}
//     keyExtractor={(w) => w.id}
//     onRowPress={(w) => router.push(`/admin/worker/${w.id}`)}
//   />
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, RefreshControl, TextInput } from "react-native";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";
import { AppText, Tooltip } from "@/src/components/ui";
import { Ionicons } from "@expo/vector-icons";
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
  /** If true, clicking this column header cycles sort asc → desc → off */
  sortable?: boolean;
  /** Returns the primitive value used for sorting. Required when sortable=true. */
  sortValue?: (item: T) => string | number | null | undefined;
  /** If true, shows a text filter input below the header for this column. */
  filterable?: boolean;
  /** Called to check if an item matches the column's filter string. */
  filterMatch?: (item: T, filter: string) => boolean;
};

type SortDir = "asc" | "desc" | null;

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
  /** When provided, hovering anywhere on a row (web) shows a single tooltip
   *  with this text, instead of any per-column tooltips. */
  getRowTooltip?: (item: T) => string | null | undefined;
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

function TableRow<T>({
  item,
  index,
  columns,
  colWidths,
  totalWidth,
  baseBackground,
  onPress,
  testID,
  tooltipText,
}: {
  item: T;
  index: number;
  columns: ResizableTableColumn<T>[];
  colWidths: Record<string, number>;
  totalWidth: number;
  baseBackground?: string;
  onPress?: () => void;
  testID?: string;
  tooltipText?: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const row = (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.row,
        { minWidth: totalWidth, backgroundColor: baseBackground },
        onPress ? {
          transform: [{ scale: hovered ? 1.012 : 1 }],
          zIndex: hovered ? 1 : 0,
          shadowColor: "#1A1817",
          shadowOpacity: hovered ? 0.12 : 0,
          shadowRadius: hovered ? 6 : 0,
          shadowOffset: { width: 0, height: 2 },
          elevation: hovered ? 3 : 0,
        } : null,
      ]}
      testID={testID}
    >
      {columns.map((col) => (
        <View key={col.key} style={[styles.cell, { width: colWidths[col.key] ?? col.width }]}>
          {col.render(item, index)}
        </View>
      ))}
    </Pressable>
  );

  if (tooltipText) {
    return <Tooltip text={tooltipText}>{row}</Tooltip>;
  }
  return row;
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
  getRowTooltip,
}: Props<T>) {
  const defaultWidths = React.useMemo(() => {
    const w: Record<string, number> = {};
    columns.forEach((c) => { w[c.key] = c.width; });
    return w;
  }, [columns]);

  const [colWidths, setColWidths] = useState<Record<string, number>>(defaultWidths);

  // Sort state: which column + direction
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Per-column filter strings
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

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

  // Cycle sort: none → asc → desc → none
  const handleSortPress = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev !== key) { setSortDir("asc"); return key; }
      setSortDir((d) => {
        if (d === "asc") return "desc";
        // was desc → clear sort
        setSortKey(null);
        return null;
      });
      return key;
    });
  }, []);

  // Apply column filters then sort
  const processedData = useMemo(() => {
    let result = [...data];

    // Filter
    for (const col of columns) {
      if (!col.filterable || !col.filterMatch) continue;
      const filterVal = colFilters[col.key]?.trim();
      if (!filterVal) continue;
      result = result.filter((item) => col.filterMatch!(item, filterVal));
    }

    // Sort
    if (sortKey && sortDir) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        result.sort((a, b) => {
          const av = col.sortValue!(a) ?? "";
          const bv = col.sortValue!(b) ?? "";
          if (av < bv) return sortDir === "asc" ? -1 : 1;
          if (av > bv) return sortDir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    return result;
  }, [data, columns, colFilters, sortKey, sortDir]);

  const totalWidth = columns.reduce((sum, c) => sum + (colWidths[c.key] ?? c.width), 0);
  const hasFilters = columns.some((c) => c.filterable);
  const activeFilterCount = Object.values(colFilters).filter(Boolean).length;

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Outer horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.hScroll}
        contentContainerStyle={{ minWidth: "100%", flexGrow: 1 }}
      >
        <View style={{ flex: 1, minWidth: totalWidth }}>
          {/* Inner vertical scroll — stickyHeaderIndices pins header + filter row */}
          <ScrollView
            style={styles.vScroll}
            stickyHeaderIndices={hasFilters ? [0, 1] : [0]}
            showsVerticalScrollIndicator
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />
              ) : undefined
            }
          >
            {/* ── Header row (sticky index 0) ── */}
            <View style={[styles.headerRow, { minWidth: totalWidth }]}>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const sortIcon = isSorted
                  ? sortDir === "asc" ? "arrow-up" : "arrow-down"
                  : "swap-vertical";
                return (
                  <View key={col.key} style={[styles.headerCell, { width: colWidths[col.key] ?? col.width }]}>
                    {col.sortable ? (
                      <Pressable
                        style={styles.headerCellInner}
                        onPress={() => handleSortPress(col.key)}
                        testID={`${testIDPrefix}-sort-${col.key}`}
                      >
                        <AppText weight="bold" size="sm" numberOfLines={1} color={COLORS.onBrandPrimary} style={{ flex: 1 }}>
                          {col.label}
                        </AppText>
                        <Ionicons
                          name={sortIcon as any}
                          size={13}
                          color={isSorted ? "#fff" : "rgba(255,255,255,0.5)"}
                          style={{ marginLeft: 3 }}
                        />
                      </Pressable>
                    ) : (
                      <View style={styles.headerCellInner}>
                        <AppText weight="bold" size="sm" numberOfLines={1} color={COLORS.onBrandPrimary}>
                          {col.label}
                        </AppText>
                      </View>
                    )}
                    {col.resizable !== false && (
                      <ResizeHandle
                        onResize={(delta) => resizeColumn(col.key, delta, col.minWidth ?? DEFAULT_MIN_WIDTH)}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            {/* ── Filter row (sticky index 1, only when filterable cols exist) ── */}
            {hasFilters && (
              <View style={[styles.filterRow, { minWidth: totalWidth }]}>
                {columns.map((col) => (
                  <View key={col.key} style={[styles.filterCell, { width: colWidths[col.key] ?? col.width }]}>
                    {col.filterable ? (
                      <TextInput
                        value={colFilters[col.key] ?? ""}
                        onChangeText={(v) => setColFilters((prev) => ({ ...prev, [col.key]: v }))}
                        placeholder="Filter…"
                        placeholderTextColor={COLORS.muted}
                        style={styles.filterInput}
                        testID={`${testIDPrefix}-filter-${col.key}`}
                        clearButtonMode="while-editing"
                      />
                    ) : (
                      // Empty spacer for non-filterable columns (like S.No)
                      <View />
                    )}
                  </View>
                ))}
                {/* Clear-all button if any filter is active */}
                {activeFilterCount > 0 && (
                  <Pressable
                    onPress={() => setColFilters({})}
                    style={styles.clearFiltersBtn}
                    testID={`${testIDPrefix}-clear-col-filters`}
                  >
                    <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
                    <AppText size="sm" color={COLORS.brandPrimary} weight="semibold"> Clear ({activeFilterCount})</AppText>
                  </Pressable>
                )}
              </View>
            )}

            {/* ── Rows ── */}
            {processedData.length === 0 ? (
              <View style={{ padding: SPACING.xl, minWidth: totalWidth }}>
                <AppText color={COLORS.muted}>
                  {activeFilterCount > 0 ? "No results match your column filters." : emptyText}
                </AppText>
              </View>
            ) : (
              processedData.map((item, index) => (
                <TableRow
                  key={keyExtractor(item)}
                  item={item}
                  index={index}
                  columns={columns}
                  colWidths={colWidths}
                  totalWidth={totalWidth}
                  baseBackground={rowBackground?.(item, index) ?? (index % 2 === 0 ? COLORS.surfaceSecondary : COLORS.surface)}
                  onPress={onRowPress ? () => onRowPress(item) : undefined}
                  testID={`${testIDPrefix}-row-${keyExtractor(item)}`}
                  tooltipText={getRowTooltip?.(item)}
                />
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
  headerCellInner: { flexDirection: "row", alignItems: "center", flex: 1 },
  resizeHandle: { position: "absolute", right: -4, top: 0, bottom: 0, width: 8, zIndex: 2 },
  filterRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterCell: { paddingHorizontal: 4, justifyContent: "center" },
  filterInput: {
    height: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    fontSize: FONT.sm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surface,
  },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    alignSelf: "center",
  },
  row: { flexDirection: "row", paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cell: { paddingHorizontal: 6, justifyContent: "center" },
});
