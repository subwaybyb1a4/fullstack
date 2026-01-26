// app/search.tsx
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, Search, Target } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import stationsJson from "../data/stations.json";

type StationRow = {
  id: string | number;
  name: string;
  line: string;
  stationCode?: string | null;
  externalCode?: string | null;
};

type GroupedStation = {
  id: string; // name 기반
  name: string;
  lines: string[]; // 여러 노선 배지
};

const STATIONS = stationsJson as unknown as StationRow[];

// ✅ 자동완성 개선: 공백/대소문자 무시 + "역" 접미사 무시 + startsWith 우선 정렬
const normalize = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, "").replace(/역$/g, "");

const rankAndGroupStations = (query: string): GroupedStation[] => {
  const q = normalize(query);
  if (!q) return [];

  // (1) 이름 기준 점수 산정 + 우선순위 정렬
  const scored = STATIONS
    .map((s) => {
      const nameN = normalize(s.name);
      const idx = nameN.indexOf(q);

      // startsWith(0) 최우선, includes는 뒤로 밀기
      const score = idx === 0 ? 0 : idx > 0 ? 10 + idx : 9999;
      return { s, score };
    })
    .filter((x) => x.score < 9999)
    .sort((a, b) => a.score - b.score || a.s.name.length - b.s.name.length);

  // (2) 동일 역명 groupBy: name -> lines set
  const map = new Map<string, { score: number; lines: Set<string> }>();

  for (const item of scored) {
    const name = item.s.name;
    const line = item.s.line ?? "";
    const prev = map.get(name);

    if (!prev) {
      map.set(name, { score: item.score, lines: new Set([line]) });
    } else {
      // 더 좋은 score(작을수록) 유지
      if (item.score < prev.score) prev.score = item.score;
      prev.lines.add(line);
    }
  }

  // (3) 그룹 결과 정렬 + 라인 정렬 + 최대 개수 제한
  const grouped = Array.from(map.entries())
    .map(([name, v]) => ({
      id: name,
      name,
      score: v.score,
      lines: Array.from(v.lines).filter(Boolean),
    }))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "ko"))
    .slice(0, 20) // ✅ 너무 길면 여기 숫자 줄이면 됨 (예: 12)
    .map((g) => ({
      id: g.id,
      name: g.name,
      lines: g.lines.sort((a, b) => a.localeCompare(b, "ko")),
    }));

  return grouped;
};

export default function SearchScreen() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchMode, setSearchMode] = useState<"from" | "to" | null>(null);

  const queryText = searchMode === "from" ? from : to;

  const suggestions = useMemo(() => {
    if (!searchMode) return [];
    return rankAndGroupStations(queryText);
  }, [searchMode, queryText]);

  const handleStationSelect = (stationName: string) => {
    if (searchMode === "from") {
      setFrom(stationName);
    } else if (searchMode === "to") {
      setTo(stationName);
    }
    setSearchMode(null);
    Keyboard.dismiss();
  };

  const handleSearch = () => {
    if (from && to) {
      router.push({
        pathname: "/results",
        params: { from, to },
      });
    }
  };

  // ✅ 키보드만 내리고, 검색 상태(searchMode)는 유지
  const renderSuggestionItem = ({ item }: { item: GroupedStation }) => (
    <TouchableOpacity
      onPress={() => handleStationSelect(item.name)}
      style={styles.suggestionItem}
      activeOpacity={0.7}
    >
      <Search size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
      <Text style={styles.stationName}>{item.name}</Text>

      <View style={styles.badgeWrap}>
        {item.lines.map((line) => (
          <Text key={`${item.id}-${line}`} style={styles.lineBadge}>
            {line}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 바깥 터치로 키보드만 내리기 */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>경로 검색</Text>
          </View>

          <View style={styles.content}>
            {/* 입력값 카드 */}
            <View style={styles.inputCard}>
              {/* 출발역 */}
              <View style={styles.inputRow}>
                <View style={styles.iconContainer}>
                  <MapPin size={18} color="#3B82F6" />
                </View>
                <TextInput
                  value={from}
                  onChangeText={(text) => {
                    setFrom(text);
                    setSearchMode("from");
                  }}
                  onFocus={() => setSearchMode("from")}
                  returnKeyType="done"
                  placeholder="출발역 입력"
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.divider} />

              {/* 도착역 */}
              <View style={styles.inputRow}>
                <View style={styles.iconContainer}>
                  <Target size={18} color="#EF4444" />
                </View>
                <TextInput
                  value={to}
                  onChangeText={(text) => {
                    setTo(text);
                    setSearchMode("to");
                  }}
                  onFocus={() => setSearchMode("to")}
                  returnKeyType="search"
                  placeholder="도착역 입력"
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                  onSubmitEditing={handleSearch}
                />
              </View>
            </View>

            {/* 자동완성 목록 (FlatList로 스크롤 가능 + 키보드 유지) */}
            {searchMode && queryText.trim().length > 0 && (
              <View style={styles.suggestionList}>
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSuggestionItem}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  style={{ maxHeight: 320 }} // ✅ 키보드 올라와도 적당히 스크롤되게
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>검색 결과가 없어요</Text>
                    </View>
                  }
                />
              </View>
            )}
          </View>

          {/* 하단 검색 버튼 */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={!from || !to}
              style={[styles.searchButton, (!from || !to) && styles.disabledButton]}
            >
              <Text style={styles.searchButtonText}>경로 검색하기</Text>
            </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  content: { flex: 1, padding: 20 },

  inputCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputRow: { flexDirection: "row", alignItems: "center", padding: 8 },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginRight: 12,
  },
  input: { flex: 1, fontSize: 16, color: "#111827", height: 40 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginLeft: 52 },

  suggestionList: {
    marginTop: 16,
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  stationName: { fontSize: 16, color: "#1F2937", flex: 1 },

  // ✅ 여러 배지 감싸기 (공덕: 05호선 06호선 경의선 공항철도)
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
    maxWidth: 160,
  },
  lineBadge: {
    fontSize: 12,
    color: "#15803D",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontWeight: "600",
    overflow: "hidden",
  },

  emptyState: { padding: 18, alignItems: "center" },
  emptyText: { color: "#9CA3AF" },

  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  searchButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { backgroundColor: "#E5E7EB", shadowOpacity: 0 },
  searchButtonText: { color: "white", fontSize: 16, fontWeight: "700" },
});
