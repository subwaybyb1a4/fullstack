import { useFocusEffect, useRouter } from "expo-router";
import { Edit, Plus, Star, Trash2, Clock } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput, // 👈 입력창 컴포넌트 추가
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getFavorites,
  removeFavorite,
  updateFavorite,
} from "../../utils/storage";

export default function FavoritesScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);

  // 📝 [추가] 이름 수정용 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

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

  // 1. 수정 버튼 클릭 시 모달 열기 (Alert.prompt 대신 사용)
  const openEditModal = (id: string, currentName: string) => {
    setEditingId(id);
    setNewName(currentName);
    setModalVisible(true);
  };

  // 2. 모달에서 저장 버튼 클릭 시
  const handleSaveEdit = async () => {
    if (editingId && newName.trim()) {
      const updated = await updateFavorite(editingId, { name: newName.trim() });
      setRoutes(updated);
    }
    setModalVisible(false);
    setEditingId(null);
  };

// 3. 삭제 기능 (웹 호환성 수정 완료)
  const handleDelete = async (id: string) => {
    // 🌐 웹 환경인 경우: 브라우저 기본 confirm 창 사용
    if (Platform.OS === 'web') {
      const ok = window.confirm("정말 이 경로를 삭제하시겠습니까?");
      if (ok) {
        const updated = await removeFavorite(id);
        setRoutes(updated);
      }
      return; 
    }

    // 📱 앱 환경(iOS/Android): 기존 Alert 사용
    Alert.alert("삭제 확인", "정말 이 경로를 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const updated = await removeFavorite(id);
          setRoutes(updated);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>즐겨찾기 관리</Text>
        <TouchableOpacity
          onPress={() => setEditMode(!editMode)}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>
            {editMode ? "완료" : "편집"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {routes.length === 0 ? (
          <View style={styles.emptyState}>
            <Star size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>즐겨찾기가 비어있어요</Text>
            <Text style={styles.emptyText}>자주 가는 경로를 등록해보세요!</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {routes.map((route, index) => (
              <View key={route.id || index} style={styles.card}>
                {editMode && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(route.id)}
                  >
                    <Trash2 size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!editMode) {
                      router.push({
                        pathname: "/results",
                        params: {
                          from: route.from,
                          to: route.to,
                          searchTime: route.savedSearchTime,
                        },
                      });
                    }
                  }}
                  style={styles.cardContent}
                >
                  <View style={styles.titleRow}>
                    <Star size={18} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.routeName}>{route.name}</Text>
                    {/* ✏️ 수정 아이콘 누르면 모달 열기 */}
                    {editMode && (
                      <TouchableOpacity
                        onPress={() => openEditModal(route.id, route.name)}
                        style={{ marginLeft: 8, padding: 4 }}
                      >
                        <Edit size={16} color="#2563EB" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.routeRow}>
                    <Text style={styles.routeText}>
                      {route.from} → {route.to}
                    </Text>
                  </View>

                  {route.savedSearchTime && (
                    <View style={styles.timeBadgeRow}>
                      <Clock size={12} color="#2563EB" />
                      <Text style={styles.timeBadgeText}>
                        매일 {new Date(route.savedSearchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 기준
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/search")}
        >
          <Plus size={20} color="#9CA3AF" />
          <Text style={styles.addButtonText}>새 경로 추가하기</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 🛠️ [추가] 이름 수정용 모달 (안드로이드 호환) */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>별칭 수정</Text>
            <Text style={styles.modalSubtitle}>새로운 이름을 입력해주세요.</Text>
            
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="예: 퇴근길"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  editButton: { padding: 8 },
  editButtonText: { fontSize: 16, fontWeight: "600", color: "#2563EB" },
  scrollContent: { padding: 20 },
  listContainer: { gap: 16, marginBottom: 20 },
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
    flexDirection: "row",
    alignItems: "center",
  },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 }, // gap 조정
  routeName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  routeRow: { marginBottom: 8, marginLeft: 26 },
  routeText: { fontSize: 15, color: "#6B7280" },
  deleteButton: { padding: 10, marginRight: 10 },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 60, marginBottom: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 16 },
  emptyText: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },
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
  addButtonText: { color: "#9CA3AF", fontWeight: "600", fontSize: 16 },
  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginLeft: 26,
  },
  timeBadgeText: {
    fontSize: 13,
    color: '#2563EB',
    marginLeft: 4,
    fontWeight: '600',
  },
  
  // 🎨 모달 스타일 추가
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  modalInput: { backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, marginBottom: 24, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20 },
  cancelText: { color: '#9CA3AF', fontWeight: '600', fontSize: 15 },
  saveBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
});