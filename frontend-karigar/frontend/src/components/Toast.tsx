import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { Animated, StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, FONT, FONT_FAMILY, shadow } from "@/src/theme";
import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";

type ToastType = "success" | "error" | "info";
interface ToastCtx {
  show: (message: string, type?: ToastType) => void;
}
const Ctx = createContext<ToastCtx | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<ToastType>("info");
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, t: ToastType = "info") => {
      setMsg(message);
      setType(t);
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setVisible(false));
      }, 2600);
    },
    [opacity]
  );

  const color = type === "success" ? COLORS.success : type === "error" ? COLORS.error : COLORS.surfaceInverse;
  const icon = type === "success" ? "checkmark-circle" : type === "error" ? "alert-circle" : "information-circle";

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
  }, [opacity]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { opacity }]} testID="toast">
          <Pressable onPress={dismiss} style={[styles.toast, shadow, { borderLeftColor: color }]}>
            <Ionicons name={icon as any} size={22} color={color} />
            <Text style={styles.text}>{msg}</Text>
          </Pressable>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast within ToastProvider");
  return c;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 60, left: 0, right: 0, alignItems: "center", zIndex: 9999, paddingHorizontal: SPACING.lg },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderLeftWidth: 4,
    gap: SPACING.sm,
    maxWidth: 460,
  },
  text: { flex: 1, fontSize: FONT.base, color: COLORS.onSurface, fontWeight: "500", fontFamily: FONT_FAMILY },
});
