/**
 * 홈 화면 (즐겨찾기 디자인 통일 버전)
 */
import { useFocusEffect, useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  Navigation,
  Search,
  Star
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// 저장소 함수 가져오기
import { getFavorites } from "../../utils/storage";

export default function Home() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<any[]>([]);

  // 화면이 포커스될 때마다 데이터 리로드
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const data = await getFavorites();
          setFavorites(data || []);
        } catch (e) {
          console.error("즐겨찾기 로드 실패:", e);
        }
      };
      loadData();
    }, []),
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 히어로 섹션 */}
      <View style={styles.heroSection}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.topBar}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Navigation size={20} color="white" fill="white" />
              </View>
              <Text style={styles.logoText}>안끼길</Text>
            </View>
            <TouchableOpacity style={styles.bellButton}>
              <Bell size={24} color="#1F2937" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          <View style={styles.greetingContainer}>
            <Text style={styles.greetingSub}>오늘도 쾌적한 이동!</Text>
            <Text style={styles.greetingMain}>어디로 떠나시나요?</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push("/search")}
            style={styles.bigSearchBar}
          >
            <Search size={28} color="#2563EB" />
            <View style={styles.searchTextContainer}>
              <Text style={styles.searchPlaceholder}>역 이름 검색</Text>
              <Text style={styles.searchSubPlaceholder}>
                출발역 또는 도착역 입력
              </Text>
            </View>
            <View style={styles.searchButtonCircle}>
              <ChevronRight size={24} color="white" />
            </View>
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 즐겨찾기 섹션 헤더 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Star size={20} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.sectionTitle}>즐겨찾는 경로</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/favorites")}>
            <Text style={styles.viewAll}>전체보기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardList}>
          {favorites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                즐겨찾는 경로가 없습니다 텅..
              </Text>
            </View>
          ) : (
            favorites.map((route, index) => (
              <TouchableOpacity
                key={route.id || index}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/results",
                    params: {
                      from: route.from,
                      to: route.to,
                    },
                  })
                }
                style={styles.card}
              >
                <View style={styles.cardContent}>
                  {/* 별칭: 크고 볼드하게 */}
                  <View style={styles.titleRow}>
                    <Star
                      size={18}
                      color="#F59E0B"
                      fill="#F59E0B"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.routeName}>
                      {route.name || "저장된 경로"}
                    </Text>
                  </View>

                  {/* 경로 정보: 작고 회색으로 아래에 배치 */}
                  <View style={styles.routeSection}>
                    <Text style={styles.routeStation}>{route.from}</Text>
                    <Text style={styles.arrowText}>{">"}</Text>
                    <Text style={styles.routeStation}>{route.to}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            onPress={() => router.push("/search")}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ 새 경로 추가하기</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  heroSection: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  logoContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoIcon: { backgroundColor: "#2563EB", padding: 6, borderRadius: 8 },
  logoText: { fontSize: 20, fontWeight: "800", color: "#111827" },
  bellButton: { padding: 8, backgroundColor: "#F3F4F6", borderRadius: 999 },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    backgroundColor: "#EF4444",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  greetingContainer: { marginBottom: 24 },
  greetingSub: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 4,
  },
  greetingMain: { fontSize: 28, color: "#111827", fontWeight: "800" },
  bigSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#EFF6FF",
  },
  searchTextContainer: { flex: 1, marginLeft: 16 },
  searchPlaceholder: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  searchSubPlaceholder: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  searchButtonCircle: {
    backgroundColor: "#2563EB",
    padding: 10,
    borderRadius: 99,
  },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  viewAll: { fontSize: 14, fontWeight: "600", color: "#2563EB" },
  cardList: { gap: 16 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    marginBottom: 10,
  },
  emptyText: { color: "#9CA3AF", fontSize: 14 },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: { alignItems: "flex-start" },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  routeName: { fontSize: 22, fontWeight: "800", color: "#111827" },
  routeSection: { flexDirection: "row", alignItems: "center", marginLeft: 28 },
  routeStation: { fontSize: 16, color: "#9CA3AF", fontWeight: "400" },
  arrowText: { fontSize: 14, color: "#D1D5DB", marginHorizontal: 8 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    backgroundColor: "rgba(249, 250, 251, 0.5)",
  },
  addButtonText: { color: "#9CA3AF", fontWeight: "600", fontSize: 15 },
});
