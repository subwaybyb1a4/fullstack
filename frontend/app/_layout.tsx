import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";

export default function RootLayout() {
  return (
    // 1. iOS 튕김 방지용 안전장치 (가장 바깥쪽 필수!)
    <SafeAreaProvider>
      {/* 2. 제스처(스와이프 뒤로가기 등) 처리를 위한 필수 뷰 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        
        <StatusBar barStyle="dark-content" />

        <Stack screenOptions={{ headerShown: false }}>
          {/* 메인 탭 화면 연결 */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* 검색 화면 연결 */}
          <Stack.Screen 
            name="search" 
            options={{ 
              headerShown: false,
              presentation: 'card',
              animation: 'default'
            }} 
          />
          
          {/* 결과 화면 연결 */}
          <Stack.Screen 
            name="results" 
            options={{ 
              headerShown: false,
              presentation: 'card',
              animation: 'default'
            }} 
          />
        </Stack>

      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}