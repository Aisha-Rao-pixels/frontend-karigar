import React from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/src/theme";
import AdminTopNav from "@/src/components/AdminTopNav";

export default function AdminTabsLayout() {
  const { t } = useTranslation();
  const isWeb = Platform.OS === "web";

  return (
    <View style={{ flex: 1 }}>
      {isWeb && <AdminTopNav />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.brandPrimary,
          tabBarInactiveTintColor: COLORS.muted,
          tabBarStyle: isWeb
            ? { display: "none" }
            : {
                backgroundColor: COLORS.surfaceSecondary,
                borderTopColor: COLORS.divider,
                height: 64,
                paddingBottom: 8,
                paddingTop: 8,
              },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t("tabHome"),
            tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t("tabSearch"),
            tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="verify"
          options={{
            title: t("tabVerify"),
            tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
