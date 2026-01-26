/**
 * 루트 레이아웃
 */
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // 👈 임포트 확인

export default function RootLayout() {
  return (
    // 👈 반드시 GestureHandlerRootView로 전체를 감싸야 합니다!
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* (tabs) 폴더를 메인 화면으로 지정 */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* 검색 화면 등 다른 화면들은 Stack으로 쌓임 */}
        <Stack.Screen name="search" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
