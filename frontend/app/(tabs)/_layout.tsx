import { Tabs } from "expo-router";
import { Home, Settings, Star } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // ✅ 탭 아이콘/글자 색상 설정
        tabBarActiveTintColor: "#2563EB", // 현재 선택된 탭 색상 (진한 파랑)
        tabBarInactiveTintColor: "#9CA3AF", // 선택되지 않은 탭 색상 (회색)
        headerShown: false, // 상단 헤더 숨김 (탭바만 보이게 함)

        // ✅ 탭바(하단 박스) 전체 스타일 설정
        tabBarStyle: {
          height: 80, // 탭바 높이를 80으로 늘려 시각적으로 여유를 줌
          paddingBottom: 30, // 아이폰 하단 바(Home Indicator)가 가리지 않도록 아래 여백 확보 (중요!)
          paddingTop: 10, // 아이콘 위쪽에도 약간의 여백을 줌
          backgroundColor: "#FFFFFF", // 배경색은 깔끔한 흰색
          borderTopWidth: 0, // 탭바 위쪽에 생기는 기본 회색 선 제거

          // 🎨 그림자 효과 (입체감)
          elevation: 10, // 안드로이드에서 그림자를 주는 속성
          shadowColor: "#000", // iOS 그림자 색상
          shadowOffset: { width: 0, height: -2 }, // 그림자 위치 (위쪽으로 살짝 올라오게)
          shadowOpacity: 0.05, // 그림자 투명도 (너무 진하지 않게 은은하게)
          shadowRadius: 10, // 그림자가 퍼지는 정도
        },

        // ✅ 탭바 아래 글씨(라벨) 스타일
        tabBarLabelStyle: {
          fontSize: 12, // 글씨 크기
          fontWeight: "600", // 글씨 굵기 (Semi-Bold)
          marginTop: 4, // 아이콘과 글씨 사이 간격을 4만큼 벌림
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

      {/* ⚙️ 설정 탭 */}
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
