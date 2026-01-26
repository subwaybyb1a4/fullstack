/**
 * 즐겨찾기 화면 (간격 및 크기 최적화 레이아웃)
 */
import { useFocusEffect, useRouter } from "expo-router";
import { Edit, Plus, Star, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getFavorites,
  removeFavorite,
  updateFavoriteName,
} from "../../utils/storage";

export default function FavoritesScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const loadData = async () => {
    try {
      const data = await getFavorites();
      setRoutes(data || []);
    } catch (e) {
      console.error("불러오기 실패:", e);
    }
  };

  const handleEditName = (id: string, currentName: string) => {
    Alert.prompt(
      "별칭 수정",
      "이 경로의 새로운 이름을 입력하세요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "완료",
          onPress: async (newName?: string) => {
            if (newName && newName.trim() !== "") {
              await updateFavoriteName(id, newName);
              await loadData();
            }
          },
        },
      ],
      "plain-text",
      currentName,
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert("삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await removeFavorite(id);
          await loadData();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>즐겨찾기</Text>
        {routes.length > 0 && (
          <TouchableOpacity
            onPress={() => setEditMode(!editMode)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>
              {editMode ? "완료" : "편집"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {routes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Star size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>즐겨찾기가 비어있습니다</Text>
            <TouchableOpacity
              onPress={() => router.push("/search")}
              style={styles.addButtonPrimary}
            >
              <Plus size={20} color="white" />
              <Text style={styles.addButtonPrimaryText}>경로 추가하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {routes.map((route, index) => (
              <View key={route.id || index} style={styles.card}>
                {editMode && (
                  <TouchableOpacity
                    onPress={() => handleDelete(route.id)}
                    style={styles.deleteButton}
                  >
                    <Trash2 size={20} color="#DC2626" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  disabled={editMode}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/results",
                      params: { from: route.from, to: route.to },
                    })
                  }
                >
                  <View style={styles.cardContent}>
                    {/* 별칭 영역: 크고 굵게 강조 */}
                    <View style={styles.titleRow}>
                      <Star
                        size={20}
                        color="#F59E0B"
                        fill="#F59E0B"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.cardTitle}>
                        {route.name || "저장된 경로"}
                      </Text>
                      {editMode && (
                        <TouchableOpacity
                          onPress={() => handleEditName(route.id, route.name)}
                        >
                          <Edit
                            size={16}
                            color="#9CA3AF"
                            style={{ marginLeft: 8 }}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* 경로 영역: 회색이지만 이전보다 조금 더 크게 설정 */}
                    <View style={styles.routeSection}>
                      <Text style={styles.stationText}>{route.from}</Text>
                      <Text style={styles.arrowText}>{">"}</Text>
                      <Text style={styles.stationText}>{route.to}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  editButtonText: { color: "#2563EB", fontWeight: "600", fontSize: 14 },
  content: { flex: 1, padding: 20 },
  emptyContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 24,
  },
  addButtonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addButtonPrimaryText: { color: "white", fontWeight: "700", fontSize: 16 },
  listContainer: { gap: 12 },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  deleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    zIndex: 10,
  },
  cardContent: { alignItems: "flex-start" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10, // 💡 별칭과 경로 사이 간격을 넓힘 (기존 4 -> 10)
  },
  cardTitle: {
    fontSize: 22, // 💡 별칭 크기를 더 키움 (기존 20 -> 22)
    fontWeight: "800",
    color: "#111827",
  },
  routeSection: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 28, // 💡 정렬을 위해 왼쪽 여백 조정
  },
  stationText: {
    fontSize: 16, // 💡 경로 글씨 크기를 키움 (기존 14 -> 16)
    color: "#9CA3AF",
    fontWeight: "400",
  },
  arrowText: {
    fontSize: 14, // 💡 화살표 크기 비례 조정
    color: "#D1D5DB",
    marginHorizontal: 8,
  },
});
