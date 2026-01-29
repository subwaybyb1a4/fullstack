import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, TrainFront, Clock, CheckCircle2 } from "lucide-react-native";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Animated as RNAnimated
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import stationsJson from "../../data/stations.json";

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🚆 실시간 추적 상태 관리
  const [isTracking, setIsTracking] = useState(false); // 추적 중인지 여부
  const [departureTime, setDepartureTime] = useState<Date | null>(null); // 사용자가 선택한 출발 시간
  const [currentStatus, setCurrentStatus] = useState("열차 탑승 대기 중"); // 현재 상태 텍스트
  const [progress, setProgress] = useState(0); // 진행률 (0~1)
  
  // 가상 열차 시간표 (현재 시간 기준 앞뒤 열차 생성)
  const [trainCandidates, setTrainCandidates] = useState<Date[]>([]);

  // 애니메이션 값
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  // 1. 역 정보 매핑
  const stationMap = useMemo(() => {
    const map = new Map();
    (stationsJson as any[]).forEach((station) => {
      const normalizedName = station.name.replace(/역$/, "").trim();
      map.set(normalizedName, { 
        lat: station.lat || station.y, 
        lng: station.lng || station.x 
      });
    });
    return map;
  }, []);

  // 2. 데이터 파싱 및 가상 시간표 생성
  useEffect(() => {
    if (params.routeData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(String(params.routeData)));
        setRouteData(parsed);

        // 현재 시간 기준으로 -5분, 0분, +5분 간격의 가상 열차 시간 생성
        const now = new Date();
        const candidates = [
            new Date(now.getTime() - 5 * 60000), // 5분 전 차
            new Date(now.getTime()),             // 지금 바로 출발
            new Date(now.getTime() + 5 * 60000), // 5분 뒤 차
        ];
        setTrainCandidates(candidates);

      } catch (e) {
        console.error("데이터 파싱 실패:", e);
      } finally {
        setLoading(false);
      }
    } else {
        setLoading(false);
    }
  }, [params.routeData]);

  // 3. ⏱️ 실시간 추적 로직 (1초마다 갱신)
  useEffect(() => {
    let interval: any; // NodeJS.Timeout;

    if (isTracking && departureTime && routeData) {
      interval = setInterval(() => {
        const now = new Date();
        // 경과 시간 (분 단위)
        const elapsedMinutes = (now.getTime() - departureTime.getTime()) / 60000;
        const totalDuration = routeData.total_time || 30; // 기본값 30분 방어 코드

        // 진행률 계산 (0 ~ 100%)
        let currentProgress = elapsedMinutes / totalDuration;
        if (currentProgress < 0) currentProgress = 0;
        if (currentProgress > 1) currentProgress = 1;

        setProgress(currentProgress);
        
        // 프로그레스바 애니메이션
        RNAnimated.timing(progressAnim, {
            toValue: currentProgress,
            duration: 500,
            useNativeDriver: false
        }).start();

        // 현재 위치 판별 로직
        updateCurrentLocation(elapsedMinutes);

      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTracking, departureTime, routeData]);

  // 현재 위치 텍스트 업데이트
  const updateCurrentLocation = (elapsed: number) => {
    if (elapsed < 0) {
        setCurrentStatus(`출발까지 ${Math.abs(Math.ceil(elapsed))}분 남음`);
        return;
    }
    
    let accumulatedTime = 0;
    let found = false;

    // 세부 구간(segments)을 순회하며 현재 어디인지 찾음
    for (const seg of (routeData.segments || [])) {
        accumulatedTime += (seg.minutes || 0);
        if (elapsed <= accumulatedTime) {
            setCurrentStatus(`${seg.label || "이동 중"} 건너는 중...`);
            found = true;
            break;
        }
    }

    if (!found && elapsed > 0) {
        setCurrentStatus("도착 완료!");
        setIsTracking(false); // 추적 종료
    }
  };

  // 4. 열차 선택 핸들러
  const handleSelectTrain = (time: Date) => {
    setDepartureTime(time);
    setIsTracking(true);
    Alert.alert("안내 시작", `${time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 열차 기준으로 안내를 시작합니다!`);
  };

  // 🗺️ 카카오맵 HTML
  const getMapHtml = () => {
    if (!routeData) return "";
    const pathCoordinates: { lat: number; lng: number }[] = [];
    const fromName = String(params.from).replace(/역$/, "");
    const fromCoord = stationMap.get(fromName);
    if (fromCoord) pathCoordinates.push(fromCoord);

    routeData.segments?.forEach((seg: any) => {
      if (seg.end_station_name) {
        const name = seg.end_station_name.replace(/역$/, "");
        const coord = stationMap.get(name);
        if (coord) pathCoordinates.push(coord);
      }
    });

    if (pathCoordinates.length === 0) pathCoordinates.push({ lat: 37.5665, lng: 126.9780 });
    const pathJson = JSON.stringify(pathCoordinates);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KAKAO_JAVASCRIPT_KEY"></script>
        <style>body { margin: 0; padding: 0; } #map { width: 100%; height: 100vh; }</style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const container = document.getElementById('map');
          const pathData = ${pathJson};
          const centerLat = pathData[0].lat;
          const centerLng = pathData[0].lng;
          const map = new kakao.maps.Map(container, { center: new kakao.maps.LatLng(centerLat, centerLng), level: 8 });
          
          if (pathData.length > 1) {
            const linePath = pathData.map(p => new kakao.maps.LatLng(p.lat, p.lng));
            const polyline = new kakao.maps.Polyline({
              path: linePath, strokeWeight: 6, strokeColor: '#2563EB', strokeOpacity: 0.9, strokeStyle: 'solid'
            });
            polyline.setMap(map);
            const bounds = new kakao.maps.LatLngBounds();
            linePath.forEach(p => bounds.extend(p));
            map.setBounds(bounds);
            new kakao.maps.Marker({ position: linePath[0], map: map }); 
            new kakao.maps.Marker({ position: linePath[linePath.length - 1], map: map });
          }
        </script>
      </body>
      </html>
    `;
  };

  if (loading || !routeData) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 맵 영역 */}
      <View style={styles.mapContainer}>
        <WebView originWhitelist={['*']} source={{ html: getMapHtml() }} style={styles.webview} />
        <SafeAreaView style={styles.overlayHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                <ArrowLeft size={24} color="#1F2937" />
            </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* 하단 시트 */}
      <View style={[styles.bottomSheet, isTracking ? styles.bottomSheetTracking : null]}>
        <View style={styles.handleBar} />
        
        {/* 상태 1: 열차 선택 모드 (아직 출발 전) */}
        {!isTracking ? (
            <View>
                <Text style={styles.sheetTitle}>어떤 열차를 타셨나요?</Text>
                <Text style={styles.sheetSubTitle}>선택한 시간표에 맞춰 실시간 위치를 알려드려요.</Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trainList}>
                    {trainCandidates.map((time, idx) => (
                        <TouchableOpacity key={idx} style={styles.trainCard} onPress={() => handleSelectTrain(time)}>
                            <TrainFront size={24} color="#2563EB" style={{marginBottom: 8}} />
                            <Text style={styles.trainTimeText}>
                                {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </Text>
                            <Text style={styles.trainSubText}>
                                {idx === 1 ? "지금 출발" : idx === 0 ? "이전 열차" : "다음 열차"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        ) : (
            /* 상태 2: 실시간 추적 모드 */
            <View>
                <View style={styles.trackingHeader}>
                    <View>
                        <Text style={styles.trackingStatus}>현재 위치</Text>
                        <Text style={styles.trackingStation}>{currentStatus}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsTracking(false)} style={styles.resetButton}>
                        <Text style={styles.resetText}>재설정</Text>
                    </TouchableOpacity>
                </View>

                {/* 프로그레스 바 */}
                <View style={styles.progressBarContainer}>
                    <RNAnimated.View 
                        style={[
                            styles.progressBarFill, 
                            { 
                                width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ["0%", "100%"]
                                }) 
                            }
                        ]} 
                    />
                </View>
                <View style={styles.progressLabels}>
                    <Text style={styles.stationLabel}>{params.from}</Text>
                    <TrainFront size={20} color="#2563EB" style={{ transform: [{translateX: (progress * 200) - 100}] }} /> 
                    <Text style={styles.stationLabel}>{params.to}</Text>
                </View>

                {/* 남은 시간 정보 */}
                <View style={styles.infoCard}>
                    <Clock size={20} color="#6B7280" />
                    <Text style={styles.infoText}>
                        도착 예정: {new Date(departureTime!.getTime() + routeData.total_time * 60000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </Text>
                </View>
            </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  mapContainer: { flex: 1 }, 
  webview: { flex: 1 },
  overlayHeader: { position: 'absolute', top: 0, left: 0, right: 0, padding: 16 },
  iconButton: { backgroundColor: 'white', padding: 10, borderRadius: 20, elevation: 5, alignSelf: 'flex-start' },
  
  bottomSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
    paddingBottom: 40,
  },
  bottomSheetTracking: {
    height: 320, // 추적 모드일 때 높이 고정
  },
  handleBar: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  sheetSubTitle: { fontSize: 14, color: "#6B7280", marginBottom: 20 },
  
  trainList: { gap: 12, paddingBottom: 10 },
  trainCard: {
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    width: 100,
  },
  trainTimeText: { fontSize: 18, fontWeight: "700", color: "#1E40AF" },
  trainSubText: { fontSize: 12, color: "#3B82F6", marginTop: 4 },

  // 추적 모드 스타일
  trackingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  trackingStatus: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  trackingStation: { fontSize: 22, color: "#2563EB", fontWeight: "800", marginTop: 4 },
  resetButton: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  resetText: { fontSize: 12, color: "#4B5563", fontWeight: "600" },

  progressBarContainer: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  progressBarFill: { height: "100%", backgroundColor: "#2563EB" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  stationLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  
  infoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, gap: 10 },
  infoText: { fontSize: 15, color: "#374151", fontWeight: "600" },
});