import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Star, Clock } from "lucide-react-native";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addFavorite, getFavorites, removeFavorite } from "../utils/storage";

export default function RouteResults() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [isFavorite, setIsFavorite] = useState(false);
  const [routeList, setRouteList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 즐겨찾기 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [alias, setAlias] = useState("");

  const fromStation = String(params.from || "");
  const toStation = String(params.to || "");
  const favoriteId = `search:${fromStation}:${toStation}`;

  // ✅ 시간 고정 (무한 루프 방지)
  const searchTime = useMemo(() => {
    return params.searchTime ? String(params.searchTime) : new Date().toISOString();
  }, [params.searchTime]);

  // ✅ 도착 시간 계산기
  const calculateArrivalTime = (totalMinutes: number) => {
    if (!totalMinutes) return "--:--";
    const departure = new Date(searchTime);
    const arrival = new Date(departure.getTime() + totalMinutes * 60000);
    const timeStr = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return arrival.getDate() !== departure.getDate() ? `${timeStr} (익일)` : timeStr;
  };

  /**
   * 🎨 [수정] 호선 색상 판별 로직 강화
   * "02호선", "2", "2호선", "수도권 2호선" 모두 초록색으로 인식하게 수정했습니다.
   */
  const getLineColor = (label: string) => {
    if (!label) return "#E5E7EB"; // 기본 회색
    
    const str = String(label).trim(); // 문자열로 변환 후 공백 제거

    // 1호선 ~ 9호선 (숫자 포함 여부로 체크)
    if (str.includes("1호선") || str === "1") return "#0052A4";
    if (str.includes("2호선") || str === "2") return "#3CB44A";
    if (str.includes("3호선") || str === "3") return "#EF7C1C";
    if (str.includes("4호선") || str === "4") return "#00A5DE";
    if (str.includes("5호선") || str === "5") return "#996CAC";
    if (str.includes("6호선") || str === "6") return "#CD7C2F";
    if (str.includes("7호선") || str === "7") return "#747F00";
    if (str.includes("8호선") || str === "8") return "#E6186C";
    if (str.includes("9호선") || str === "9") return "#BDB092";
    if (str.includes("9호선") || str === "9(급행)") return "#BDB092";

    // 기타 노선
    if (str.includes("신분당")) return "#D4003B";
    if (str.includes("수인분당")) return "#F5A200";
    if (str.includes("경의") || str.includes("중앙")) return "#77C4A3";
    if (str.includes("공항")) return "#0090D2";
    if (str.includes("경춘")) return "#0C8E72";
    if (str.includes("우이신설")) return "#B0CE18";
    if (str.includes("신림")) return "#6789CA";
    
    return "#9CA3AF"; // 매칭 안되면 진한 회색
  };

  const getTagStyle = (key: string) => {
    switch (key) {
      case "min_time": return { bg: "#FEE2E2", text: "#B91C1C", label: "⚡️ 최단 시간" };
      case "min_walking": return { bg: "#DCFCE7", text: "#15803D", label: "🚶 최소 도보" };
      case "min_crowding": return { bg: "#EFF6FF", text: "#2563EB", label: "😌 덜 붐빔" };
      default: return { bg: "#F3F4F6", text: "#374151", label: "추천" };
    }
  };

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/api/routes/search`,
          {
            from_station: fromStation,
            to_station: toStation,
            searched_time: searchTime,
          },
          { headers: { "ngrok-skip-browser-warning": "69420" } }
        );

        const data = response.data;
        let rawRoutes: any[] = [];

        // 데이터 파싱
        if (data.path && Array.isArray(data.path)) {
           rawRoutes = data.path.map((r: any, i: number) => ({
             ...r, 
             route_key: i === 0 ? "min_time" : "min_crowding"
           }));
        } else if (data.min_time || data.min_crowding) {
           rawRoutes = [
            { ...data.min_crowding, route_key: "min_crowding" },
            { ...data.min_time, route_key: "min_time" },
            { ...data.min_walking, route_key: "min_walking" },
          ];
        }

        const merged = rawRoutes.reduce((acc: any[], current) => {
          if (!current || !current.route_id) return acc;
          const existing = acc.find((item) => item.route_id === current.route_id);
          if (existing) {
            if (!existing.allKeys.includes(current.route_key)) {
              existing.allKeys.push(current.route_key);
            }
            return acc;
          }
          return [...acc, { ...current, allKeys: [current.route_key] }];
        }, []);

        setRouteList(merged);
        
        const favs = await getFavorites();
        setIsFavorite(favs.some((f: any) => f.id === favoriteId));

      } catch (error) {
        console.error("API Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (fromStation && toStation) {
      fetchResults();
    }
  }, [fromStation, toStation, searchTime]);

  const handleSaveFavorite = async () => {
    const firstRoute = routeList[0];
    await addFavorite({
      id: favoriteId,
      name: alias || `${fromStation} → ${toStation}`,
      from: fromStation,
      to: toStation,
      time: firstRoute?.total_time,
      congestion: firstRoute?.congestion_status,
      savedSearchTime: searchTime, 
    });
    setIsFavorite(true);
    setModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 12, color: "#6B7280", fontWeight: "600" }}>최적의 안끼길을 찾는 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.stationText}>{fromStation} → {toStation}</Text>
        <TouchableOpacity onPress={() => isFavorite ? removeFavorite(favoriteId).then(()=>setIsFavorite(false)) : setModalVisible(true)} style={styles.starButton}>
          <Star size={24} color={isFavorite ? "#F59E0B" : "#D1D5DB"} fill={isFavorite ? "#F59E0B" : "transparent"} />
        </TouchableOpacity>
      </View>

      <View style={styles.timeInfo}>
        <Clock size={14} color="#2563EB" />
        <Text style={styles.timeInfoText}>
          {new Date(searchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 기준 검색 결과
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {routeList.map((route, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            style={styles.card}
            onPress={() => router.push({
              pathname: "/detail/[id]",
              params: {
                id: route.route_id || index,
                from: fromStation,
                to: toStation,
                routeData: encodeURIComponent(JSON.stringify(route)),
              },
            })}
          >
            {/* 카드 상단 */}
            <View style={styles.cardTop}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {route.allKeys?.map((k: string) => (
                  <View key={k} style={[styles.typeBadge, { backgroundColor: getTagStyle(k).bg }]}>
                    <Text style={[styles.typeBadgeText, { color: getTagStyle(k).text }]}>{getTagStyle(k).label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.congestionBadge}>
                <Text style={styles.congestionText}>{route.congestion_status || "정보 없음"}</Text>
              </View>
            </View>
            
            {/* 메인 정보 */}
            <View style={styles.mainInfo}>
              <Text style={styles.totalTime}>{route.total_time}<Text style={styles.timeUnit}>분</Text></Text>
              <Text style={styles.arrivalTime}>
                {calculateArrivalTime(route.total_time)} 도착 예정
              </Text>
            </View>

            {/* ✅ [막대바] 호선 텍스트도 표시하여 더 명확하게! */}
            <View style={styles.visualBarContainer}>
              {route.segments?.map((seg: any, idx: number) => {
                const isSubway = seg.type === "subway" || seg.type === "SUBWAY";
                return (
                  <View 
                    key={idx} 
                    style={[
                      styles.visualSegment, 
                      { 
                        backgroundColor: isSubway ? getLineColor(seg.label) : "#E5E7EB", 
                        flex: seg.minutes || 1 
                      }
                    ]}
                  >
                    {/* 막대가 길면 호선 번호도 표시 */}
                    {isSubway && seg.minutes > 2 && (
                      <Text style={styles.visualText}>{String(seg.label).replace(/호선|수도권|^0+/g, "")}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.divider} />
            
            <View style={styles.cardFooter}>
              <Text style={styles.footerLabel}>도보 <Text style={styles.footerValue}>{route.total_walk_time}분</Text></Text>
              <View style={styles.footerDivider} />
              <Text style={styles.footerLabel}>환승 <Text style={styles.footerValue}>{route.transfer_count}회</Text></Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 모달 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>즐겨찾기 추가</Text>
            <TextInput style={styles.modalInput} placeholder="별칭 (예: 출근길)" value={alias} onChangeText={setAlias} />
            <Text style={styles.modalSub}>
              저장될 시간: {new Date(searchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveFavorite} style={styles.saveBtn}><Text style={styles.saveBtnText}>저장</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  backButton: { padding: 8 },
  stationText: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center" },
  starButton: { padding: 8 },
  timeInfo: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10, backgroundColor: "#EFF6FF", gap: 6 },
  timeInfoText: { fontSize: 13, color: "#2563EB", fontWeight: "600" },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 20, marginBottom: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: "700" },
  congestionBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  congestionText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  mainInfo: { marginBottom: 16 },
  totalTime: { fontSize: 32, fontWeight: "900", color: "#111827" },
  timeUnit: { fontSize: 18, fontWeight: "700" },
  arrivalTime: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  
  // ✅ 막대바 스타일
  visualBarContainer: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 16, width: "100%" },
  visualSegment: { height: "100%", justifyContent: "center", alignItems: "center", marginRight: 1 },
  visualText: { fontSize: 9, color: "white", fontWeight: "700" }, // 막대 안에 호선 번호 표시 (ex: 2)

  divider: { height: 1, backgroundColor: "#F3F4F6", marginBottom: 16 },
  cardFooter: { flexDirection: "row", alignItems: "center" },
  footerLabel: { fontSize: 14, color: "#9CA3AF" },
  footerValue: { color: "#374151", fontWeight: "700" },
  footerDivider: { width: 1, height: 12, backgroundColor: "#E5E7EB", marginHorizontal: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, color: '#111827' },
  modalInput: { backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 16 },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20 },
  cancelText: { color: '#9CA3AF', fontWeight: '600' },
  saveBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  saveBtnText: { color: 'white', fontWeight: '700' },
});