import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, Search, Target, Clock } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// ✅ [수정] react-native의 SafeAreaView 대신 safe-area-context 사용 (튕김 방지)
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import stationsJson from "../data/stations.json";

// --- 데이터 타입 정의 ---
type StationRow = {
  id: string | number;
  name: string;
  line: string;
  stationCode?: string | null;
  externalCode?: string | null;
};

type GroupedStation = {
  id: string; 
  name: string;
  lines: string[];
};

const STATIONS = stationsJson as unknown as StationRow[];

// ✅ [자동완성 로직]
const normalize = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, "").replace(/역$/g, "");

const rankAndGroupStations = (query: string): GroupedStation[] => {
  const q = normalize(query);
  if (!q) return [];

  const scored = STATIONS
    .map((s) => {
      const nameN = normalize(s.name);
      const idx = nameN.indexOf(q);
      if (idx === -1) return null;
      let score = 100;
      if (nameN === q) score = 0;
      else if (nameN.startsWith(q)) score = 10 + idx;
      else score = 50 + idx;
      return { ...s, score };
    })
    .filter((s): s is StationRow & { score: number } => s !== null)
    .sort((a, b) => a.score - b.score);

  const map = new Map<string, Set<string>>();
  scored.forEach((s) => {
    let name = s.name;
    if (name === "서울역") name = "서울";
    if (!map.has(name)) map.set(name, new Set());
    map.get(name)?.add(s.line);
  });

  const results: GroupedStation[] = [];
  for (const [name, lineSet] of map.entries()) {
    if (results.length >= 20) break;
    const sortedLines = Array.from(lineSet).sort();
    results.push({ id: name, name, lines: sortedLines });
  }
  return results;
};

// 🎨 [호선별 색상]
const getLineStyle = (line: string) => {
  const styles: any = {
    "01호선": { bg: "#E5F0F9", color: "#0052A4" },
    "02호선": { bg: "#ECF7ED", color: "#3CB44A" },
    "03호선": { bg: "#FDF2E8", color: "#EF7C1C" },
    "04호선": { bg: "#E5F6FC", color: "#00A5DE" },
    "05호선": { bg: "#F5F0F7", color: "#996CAC" },
    "06호선": { bg: "#FAF2EB", color: "#CD7C2F" },
    "07호선": { bg: "#F1F2E5", color: "#747F00" },
    "08호선": { bg: "#FCE8F0", color: "#E6186C" },
    "09호선": { bg: "#F8F7F4", color: "#BDB092" },
    "수인분당선": { bg: "#FDF4E5", color: "#F5A200" },
    "신분당선": { bg: "#FDE8EE", color: "#D4003B" },
    "경의선": { bg: "#E9F6F1", color: "#77C4A3" },
    "공항철도": { bg: "#E5F4FB", color: "#0090D2" },
    "GTX-A": { bg: "#F4EFFF", color: "#9A62F7" },
  };
  return styles[line] || { bg: "#F3F4F6", color: "#6B7280" };
};

export default function SearchScreen() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  
  // ✅ [수정] 초기값을 확실한 Date 객체로 고정 (Invalid Date 방지)
  const [commuteTime, setCommuteTime] = useState<Date>(new Date());
  
  const [isTimeEnabled, setIsTimeEnabled] = useState(false);
  const [focusField, setFocusField] = useState<"from" | "to" | null>(null);
  
  const query = focusField === "from" ? from : focusField === "to" ? to : "";
  const suggestions = useMemo(() => rankAndGroupStations(query), [query]);

  const onSelectStation = (stName: string) => {
    if (focusField === "from") setFrom(stName);
    else if (focusField === "to") setTo(stName);
    setFocusField(null);
    Keyboard.dismiss();
  };

  const handleSearch = () => {
    if (from && to) {
      // ✅ [수정] 날짜가 유효한지 한 번 더 확인 후 전송
      const validTime = commuteTime instanceof Date && !isNaN(commuteTime.getTime()) 
        ? commuteTime 
        : new Date();
        
      router.push({
        pathname: "/results",
        params: { 
          from, 
          to,
          searchTime: isTimeEnabled ? validTime.toISOString() : new Date().toISOString()
        },
      });
    }
  };

  const onChangeTime = (event: any, selectedDate?: Date) => {
    // ✅ [수정] 취소했거나 날짜가 없으면 무시
    if (event.type === 'dismissed') {
        return;
    }
    if (selectedDate) {
      setCommuteTime(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>경로 검색</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <MapPin size={20} color="#2563EB" />
              <TextInput
                style={styles.textInput}
                placeholder="출발역 입력"
                value={from}
                onChangeText={setFrom}
                onFocus={() => setFocusField("from")}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Target size={20} color="#EF4444" />
              <TextInput
                style={styles.textInput}
                placeholder="도착역 입력"
                value={to}
                onChangeText={setTo}
                onFocus={() => setFocusField("to")}
              />
            </View>
          </View>

          {/* 자동완성 목록 */}
          {focusField && query.trim().length > 0 && (
            <View style={styles.suggestionList}>
              <FlatList
                data={suggestions}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => onSelectStation(item.name)}
                  >
                    <Search size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
                    <Text style={styles.stationName}>{item.name}</Text>
                    <View style={styles.badgeWrap}>
                      {item.lines.map((line) => {
                        const s = getLineStyle(line);
                        return (
                          <Text 
                            key={line} 
                            style={[styles.lineBadge, { backgroundColor: s.bg, color: s.color }]}
                          >
                            {line.replace("수도권", "").replace("호선", "").trim().replace(/^0+/, "")}
                          </Text>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* ⏰ 시간 설정 버튼 */}
          <TouchableOpacity 
            style={[styles.timeToggle, isTimeEnabled && styles.timeToggleActive]} 
            onPress={() => setIsTimeEnabled(!isTimeEnabled)}
          >
            <Clock size={20} color={isTimeEnabled ? "#2563EB" : "#9CA3AF"} />
            <Text style={[styles.timeToggleText, { color: isTimeEnabled ? "#2563EB" : "#9CA3AF" }]}>
              고정 시간 설정하기
            </Text>
          </TouchableOpacity>

          {/* ✅ 시간 선택기 (안전한 버전) */}
          {isTimeEnabled && (
            <View style={styles.pickerContainer}>
              {Platform.OS === 'web' ? (
                /* 웹 환경 */
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <input
                    type="time"
                    style={{ fontSize: '18px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px' }}
                    value={commuteTime.toTimeString().slice(0, 5)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':');
                      const newDate = new Date();
                      newDate.setHours(Number(h), Number(m));
                      setCommuteTime(newDate);
                    }}
                  />
                </View>
              ) : (
                /* 모바일 환경 */
                <DateTimePicker
                  value={commuteTime instanceof Date ? commuteTime : new Date()} // ✅ 날짜 객체 보장
                  mode="time"
                  display="spinner"
                  onChange={onChangeTime}
                  textColor="black"
                  themeVariant="light"
                />
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.searchButton, (!from || !to) && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!from || !to}
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
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  content: { flex: 1, padding: 20 },
  inputCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    elevation: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1F2937",
  },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginLeft: 52 },
  suggestionList: {
    marginTop: 16,
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 4,
    maxHeight: 300, 
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
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
    maxWidth: 160,
  },
  lineBadge: {
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: "700",
    overflow: "hidden",
  },
  emptyState: { padding: 18, alignItems: "center" },
  emptyText: { color: "#9CA3AF" },
  timeToggle: { flexDirection: "row", alignItems: "center", backgroundColor: "white", marginTop: 20, padding: 16, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  timeToggleActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  timeToggleText: { fontSize: 15, fontWeight: "600" },
  pickerContainer: { marginTop: 10, backgroundColor: "white", borderRadius: 16, overflow: "hidden" },
  footer: { padding: 20, backgroundColor: "transparent" },
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
  searchButtonDisabled: { backgroundColor: "#D1D5DB", shadowOpacity: 0, elevation: 0 },
  searchButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
});