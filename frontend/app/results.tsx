import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Star } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addFavorite, getFavorites, removeFavorite } from "../utils/storage";

/**
 * [RouteResults 컴포넌트]
 * 경로 검색 결과를 보여주는 화면입니다.
 * 백엔드로부터 최단시간, 최소도보, 덜붐빔 경로 정보를 받아와 리스트 형태로 출력합니다.
 */
export default function RouteResults() {
  const router = useRouter();
  const params = useLocalSearchParams(); // 이전 화면(Search)에서 넘어온 검색어(from, to)를 받아옵니다.

  // --- 상태 관리 ---
  const [isFavorite, setIsFavorite] = useState(false); // 현재 검색 경로의 즐겨찾기 등록 여부
  const [routeList, setRouteList] = useState<any[]>([]); // 서버에서 받아와 가공한 경로 리스트
  const [loading, setLoading] = useState(true); // 데이터 로딩 상태 (Spinner 표시용)

  // 검색 데이터 변수화
  const fromStation = String(params.from || "");
  const toStation = String(params.to || "");
  const favoriteId = `search:${fromStation}:${toStation}`; // 즐겨찾기 저장을 위한 고유 ID 생성

  /**
   * [getTagStyle]
   * API에서 내려주는 경로 타입(Key)에 따라 UI에 표시할 뱃지(Badge) 스타일과 문구를 결정합니다.
   */
  const getTagStyle = (key: string) => {
    switch (key) {
      case "min_time":
        return { bg: "#FEE2E2", text: "#B91C1C", label: "⚡️ 최단 시간" };
      case "min_walking":
        return { bg: "#DCFCE7", text: "#15803D", label: "🚶 최소 도보" };
      case "min_crowding":
        return { bg: "#EFF6FF", text: "#2563EB", label: "😌 덜 붐빔" };
      default:
        return { bg: "#F3F4F6", text: "#374151", label: "추천" };
    }
  };

  /**
   * [fetchResults]
   * 백엔드 API와 통신하여 실시간 경로 데이터를 가져오고 가공합니다.
   */
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);

        // 1. 서버에 경로 검색 요청 (POST 방식)
        const response = await axios.post(
          "http://172.16.30.230:8000/api/routes/search",
          {
            from_station: fromStation,
            to_station: toStation,
            searched_time: new Date().toISOString(), // 서버 분석용 현재 시간 전송
          },
        );

        const data = response.data;

        // 2. API 응답(Object)을 처리하기 쉬운 배열(Array) 형태로 변환
        const rawRoutes = [
          { ...data.min_crowding, route_key: "min_crowding" },
          { ...data.min_time, route_key: "min_time" },
          { ...data.min_walking, route_key: "min_walking" },
        ];

        /**
         * 3. [중요] 경로 중복 제거 및 태그 합치기 로직
         * 최단시간과 최소도보 경로가 물리적으로 같을 경우(동일한 route_id),
         * 카드를 두 개 띄우지 않고 하나의 카드에 두 개의 뱃지를 모두 표시합니다.
         */
        const merged = rawRoutes.reduce((acc: any[], current) => {
          // 이미 누적된 배열(acc)에 동일한 route_id가 있는지 확인
          const existing = acc.find(
            (item) => item.route_id === current.route_id,
          );

          if (existing) {
            // 이미 존재한다면 해당 객체의 allKeys 배열에 새로운 타입만 추가
            if (!existing.allKeys.includes(current.route_key)) {
              existing.allKeys.push(current.route_key);
            }
            return acc;
          }
          // 새로운 경로라면 allKeys 배열을 초기화하여 추가
          return [...acc, { ...current, allKeys: [current.route_key] }];
        }, []);

        setRouteList(merged); // 가공 완료된 리스트를 상태에 저장
      } catch (error) {
        console.error("API 호출 실패:", error);
        Alert.alert("오류", "경로 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false); // 로딩 종료
      }
    };

    if (fromStation && toStation) {
      fetchResults();
      checkFavoriteStatus(); // 즐겨찾기 상태 동기화
    }
  }, [fromStation, toStation]);

  /**
   * [checkFavoriteStatus]
   * 로컬 스토리지에 현재 검색한 경로가 이미 저장되어 있는지 확인합니다.
   */
  const checkFavoriteStatus = async () => {
    const favorites = await getFavorites();
    const exists = favorites.find((r: any) => r.id === favoriteId);
    setIsFavorite(!!exists);
  };

  /**
   * [toggleFavorite]
   * 즐겨찾기 버튼 클릭 시 저장하거나 삭제합니다.
   */
  const toggleFavorite = async () => {
    if (isFavorite) {
      await removeFavorite(favoriteId);
      setIsFavorite(false);
    } else {
      // 별칭 입력을 위한 시스템 팝업 노출
      Alert.prompt(
        "즐겨찾기 추가",
        "별칭을 입력해주세요.",
        [
          { text: "취소" },
          {
            text: "저장",
            onPress: async (alias?: string) => {
              const firstRoute = routeList[0];
              await addFavorite({
                id: favoriteId,
                name: alias || `${fromStation} → ${toStation}`,
                from: fromStation,
                to: toStation,
                time: firstRoute?.total_time,
                congestion: firstRoute?.congestion_status,
              });
              setIsFavorite(true);
            },
          },
        ],
        "plain-text",
        `${fromStation} → ${toStation}`,
      );
    }
  };

  // --- 로딩 중 화면 ---
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 12, color: "#6B7280", fontWeight: "600" }}>
          최적의 안끼길을 찾는 중...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더 영역 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.stationText}>
          {fromStation} → {toStation}
        </Text>
        <TouchableOpacity onPress={toggleFavorite} style={styles.starButton}>
          <Star
            size={24}
            color={isFavorite ? "#F59E0B" : "#D1D5DB"}
            fill={isFavorite ? "#F59E0B" : "transparent"}
          />
        </TouchableOpacity>
      </View>

      {/* 결과 리스트 영역 */}
      <ScrollView style={styles.content}>
        {routeList.map((route) => (
          <TouchableOpacity
            key={route.route_id}
            activeOpacity={0.9}
            onPress={() =>
              // 상세 페이지 이동 시 전체 데이터를 문자열로 변환하여 전달 (추가 API 호출 방지)
              router.push({
                pathname: "/detail/[id]",
                params: {
                  id: route.route_id,
                  from: fromStation,
                  to: toStation,
                  routeData: JSON.stringify(route),
                },
              })
            }
            style={styles.card}
          >
            {/* 상단: 경로 타입 뱃지들 및 혼잡도 정보 */}
            <View style={styles.cardTop}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {route.allKeys.map((k: string) => (
                  <View
                    key={k}
                    style={[
                      styles.typeBadge,
                      { backgroundColor: getTagStyle(k).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: getTagStyle(k).text },
                      ]}
                    >
                      {getTagStyle(k).label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.congestionBadge}>
                <Text style={styles.congestionText}>
                  {route.congestion_status}
                </Text>
              </View>
            </View>

            {/* 중단: 총 소요 시간 및 도착 예정 시각 */}
            <View style={styles.mainInfo}>
              <Text style={styles.totalTime}>
                {route.total_time}
                <Text style={styles.timeUnit}>분</Text>
              </Text>
              <Text style={styles.arrivalTime}>
                {route.arrival_time} 도착 예정
              </Text>
            </View>

            <View style={styles.divider} />

            {/* 하단: 도보 시간 및 환승 횟수 요약 */}
            <View style={styles.cardFooter}>
              <Text style={styles.footerLabel}>
                도보{" "}
                <Text style={styles.footerValue}>
                  {route.total_walk_time}분
                </Text>
              </Text>
              <View style={styles.footerDivider} />
              <Text style={styles.footerLabel}>
                환승{" "}
                <Text style={styles.footerValue}>{route.transfer_count}회</Text>
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- 스타일 정의 ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: { padding: 8 },
  stationText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  starButton: { padding: 8 },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: "700" },
  congestionBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  congestionText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  mainInfo: { marginBottom: 12 },
  totalTime: { fontSize: 32, fontWeight: "900", color: "#111827" },
  timeUnit: { fontSize: 18, fontWeight: "700" },
  arrivalTime: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginBottom: 16 },
  cardFooter: { flexDirection: "row", alignItems: "center" },
  footerLabel: { fontSize: 14, color: "#9CA3AF" },
  footerValue: { color: "#374151", fontWeight: "700" },
  footerDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },
});
