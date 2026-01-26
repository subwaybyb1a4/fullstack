import { useRouter } from "expo-router";
import { MapPin, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { WebView } from "react-native-webview";

// 💡 1. JSON 데이터에서 좌표 추출 (임포트 경로는 실제 환경에 맞춰 수정하세요)
import routeData from "../../data/clean_paths.json";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PANEL_HIDDEN_HEIGHT = SCREEN_HEIGHT * 0.4;
const SNAP_POINTS = { MIN: 0, MAX: -PANEL_HIDDEN_HEIGHT };

// 상세 경로 좌표 평탄화 (Flatten)
const pathPoints = routeData[0].구간.flatMap((seg) => seg.좌표);

// 운행 경로 역 리스트 (JSON 기반으로 동적 생성 가능)
const FULL_ROUTE = [
  routeData[0].출발역,
  ...routeData[0].구간
    .filter((s) => s.구간유형 === "지하철")
    .map((s) => s.종료역),
];

export default function TrackingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < FULL_ROUTE.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentStation = FULL_ROUTE[currentIndex];
  const nextStation = FULL_ROUTE[currentIndex + 1] || "목적지";
  const progress = (currentIndex / (FULL_ROUTE.length - 1)) * 100;

  // 바텀시트 애니메이션 로직
  const translateY = useSharedValue(0);
  const context = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextY = context.value + event.translationY;
      translateY.value = Math.max(
        Math.min(nextY, SNAP_POINTS.MIN),
        SNAP_POINTS.MAX
      );
    })
    .onEnd((event) => {
      if (event.velocityY < -500 || translateY.value < SNAP_POINTS.MAX / 2) {
        translateY.value = withSpring(SNAP_POINTS.MAX);
      } else {
        translateY.value = withSpring(SNAP_POINTS.MIN);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // 💡 2. 지도 HTML 수정: 추출한 좌표 데이터를 polyline으로 그리기
  const mapHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>body { margin: 0; } #map { height: 100vh; width: 100vw; }</style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

          // JSON에서 추출한 좌표 데이터 주입
          var pathData = ${JSON.stringify(pathPoints)};
          
          // 경로 선 그리기
          var polyline = L.polyline(pathData, {
            color: '#3B82F6', 
            weight: 6,
            opacity: 0.8
          }).addTo(map);

          // 전체 경로가 보이도록 줌 조절
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

          // 출발지 및 도착지 마커 표시
          L.marker(pathData[0]).addTo(map);
          L.marker(pathData[pathData.length - 1]).addTo(map);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.mapContainer}>
        <WebView
          source={{ html: mapHtml }}
          style={StyleSheet.absoluteFillObject}
          scrollEnabled={true}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}>
          <X size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.infoPanel, animatedSheetStyle]}>
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>
          <View style={styles.currentStatusBox}>
            <Text style={styles.statusLabel}>현재 실시간 위치</Text>
            <View style={styles.stationRow}>
              <Text style={styles.stationNameBig}>{currentStation}</Text>
              <Text style={styles.stationSuffix}>
                {currentIndex === FULL_ROUTE.length - 1 ? "도착" : "역 진입 중"}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
            <View style={styles.nextInfoRow}>
              <Text style={styles.nextInfoText}>다음역: {nextStation}</Text>
              <Text style={styles.timeText}>약 2분 남음</Text>
            </View>
          </View>

          <View style={styles.routeListContainer}>
            <Text style={styles.listTitle}>운행 경로</Text>
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}>
              {FULL_ROUTE.map((station, index) => {
                const isCurrent = index === currentIndex;
                const isPassed = index < currentIndex;
                const isLast = index === FULL_ROUTE.length - 1;
                return (
                  <View key={index} style={styles.stepItem}>
                    <View style={styles.stepLineContainer}>
                      {isLast ? (
                        <MapPin
                          size={20}
                          color={isCurrent ? "#DC2626" : "#D1D5DB"}
                          fill={isCurrent ? "#DC2626" : "transparent"}
                        />
                      ) : (
                        <View
                          style={[
                            styles.stepDot,
                            isCurrent && styles.stepDotActive,
                            isPassed && styles.stepDotPassed,
                          ]}
                        />
                      )}
                      {!isLast && (
                        <View
                          style={[
                            styles.stepLine,
                            isPassed && styles.stepLinePassed,
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepText,
                        isCurrent && styles.stepTextActive,
                        isPassed && styles.stepTextPassed,
                      ]}>
                      {station}
                    </Text>
                  </View>
                );
              })}
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  mapContainer: { flex: 1 },
  closeButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    zIndex: 10,
  },
  infoPanel: {
    position: "absolute",
    bottom: -PANEL_HIDDEN_HEIGHT,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: "white",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    elevation: 25,
  },
  handleBarContainer: { alignItems: "center", paddingVertical: 12 },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  currentStatusBox: { marginBottom: 30 },
  statusLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 6,
  },
  stationRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 15,
  },
  stationNameBig: { fontSize: 36, fontWeight: "900", color: "#111827" },
  stationSuffix: { fontSize: 18, color: "#3B82F6", fontWeight: "700" },
  progressBar: {
    height: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 5,
    marginBottom: 10,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#3B82F6" },
  nextInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextInfoText: { fontSize: 15, color: "#4B5563", fontWeight: "600" },
  timeText: { fontSize: 15, color: "#3B82F6", fontWeight: "700" },
  routeListContainer: { flex: 1 },
  listTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 20,
  },
  stepItem: { flexDirection: "row", alignItems: "flex-start", height: 60 },
  stepLineContainer: { width: 30, alignItems: "center", marginRight: 15 },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    zIndex: 2,
    marginTop: 4,
  },
  stepDotActive: {
    backgroundColor: "#3B82F6",
    borderWidth: 3,
    borderColor: "#DBEAFE",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 2,
  },
  stepDotPassed: { backgroundColor: "#93C5FD" },
  stepLine: {
    width: 2,
    backgroundColor: "#F3F4F6",
    height: "100%",
    position: "absolute",
    top: 15,
  },
  stepLinePassed: { backgroundColor: "#DBEAFE" },
  stepText: { fontSize: 16, color: "#9CA3AF", fontWeight: "500" },
  stepTextActive: { fontSize: 18, color: "#1D4ED8", fontWeight: "800" },
  stepTextPassed: { color: "#4B5563", fontWeight: "600" },
});
