import { Tabs } from "expo-router";
import { Home, Star, Settings } from "lucide-react-native";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // 상단 헤더 숨김
        tabBarActiveTintColor: "#2563EB", // 선택된 탭 색상 (파랑)
        tabBarInactiveTintColor: "#9CA3AF", // 선택 안 된 탭 색상 (회색)
        
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 90 : 70, // 아이폰은 하단 바 때문에 더 높게
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 10, // 안드로이드 그림자
          shadowColor: "#000", // iOS 그림자
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 4,
        },
      }}
    >
      {/* 🏠 홈 탭 */}
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      
      {/* ⭐ 즐겨찾기 탭 */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: "즐겨찾기",
          tabBarIcon: ({ color }) => <Star size={24} color={color} />,
        }}
      />
      {/* ⚙️ 설정 (만약 설정 탭이 따로 있다면 추가) */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />

    </Tabs>
  );
}