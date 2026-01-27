import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Footprints, Repeat } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
* [RouteDetailScreen 컴포넌트]
* 선택한 경로의 상세 타임라인을 보여주는 화면입니다. 
* 마지막 세그먼트의 도착 정보를 활용해 최종 목적지 노드를 수동으로 추가했습니다. 
*/
export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const routeData = params.routeData
    ? JSON.parse(String(params.routeData))
    : null;

  const getLineColor = (label: string) => {
    if (label.includes("1")) return "#0052A4";
    if (label.includes("2")) return "#3CB44A";
    if (label.includes("3")) return "#EF7C1C";
    if (label.includes("4")) return "#00A5DE";
    if (label.includes("5")) return "#996CAC";
    if (label.includes("6")) return "#CD7C2F";
    if (label.includes("7")) return "#747F00";
    if (label.includes("8")) return "#E6186C";
    if (label.includes("9")) return "#BDB092";
    return "#9CA3AF";
  };

  if (!routeData) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더: 출발지와 목적지 요약 표시 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {params.from} → {params.to}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 1. 상단 요약 카드: 총 시간 및 혼잡도  */}
        <View style={styles.miniSummary}>
          <Text style={styles.highlightTime}>{routeData.total_time}분 소요</Text>
          <Text style={styles.summarySubText}>
            {routeData.congestion_status} | 도보 {routeData.total_walk_time}분
          </Text>
        </View>

        {/* 2. 상세 타임라인 카드  */}
        <View style={styles.mainRouteCard}>
          {routeData.segments.map((seg: any, index: number) => (
            <View key={index} style={styles.node}>
              <View style={styles.nodeLeft}>
                {seg.type === "subway" ? (
                  <View style={[styles.circle, { backgroundColor: getLineColor(seg.label) }]}>
                    <Text style={styles.circleText}>
                      {seg.label.replace(/[^0-9]/g, "") || "역"}
                    </Text>
                  </View>
                ) : seg.type === "transfer" ? (
                  <View style={styles.iconContainer}><Repeat size={18} color="#9CA3AF" /></View>
                ) : (
                  <View style={styles.iconContainer}><Footprints size={18} color="#9CA3AF" /></View>
                )}

                {/* 마지막 노드까지 자연스럽게 연결되도록 수직선 유지  */}
                <View
                  style={[
                    styles.verticalLine,
                    seg.type === "subway" && { backgroundColor: getLineColor(seg.label) },
                  ]}
                />
              </View>

              <View style={styles.nodeRight}>
                <View style={styles.stationRow}>
                  <Text style={styles.mainStationName}>
                    {seg.start_station_name || seg.label}
                  </Text>
                  {seg.type === "subway" && <Text style={styles.lineBadge}>{seg.label}</Text>}
                </View>
                <Text style={styles.moveDetail}>{seg.minutes}분 이동</Text>
                {seg.end_station_name && (
                  <Text style={styles.endStationText}>{seg.end_station_name} 방면</Text>
                )}
              </View>
            </View>
          ))}

          {/* ⭐ 도착역 노드: 마지막 세그먼트의 end_station_name을 사용하여 최종 목적지 표시  */}
          {routeData.segments.length > 0 && (
            <View style={styles.node}>
              <View style={styles.nodeLeft}>
                <View style={[styles.circle, { backgroundColor: "#111827" }]}>
                  <Text style={styles.circleText}>도착</Text>
                </View>
              </View>
              <View style={styles.nodeRight}>
                <View style={styles.stationRow}>
                  <Text style={[styles.mainStationName, { color: "#111827" }]}>
                    {routeData.segments[routeData.segments.length - 1].end_station_name}
                  </Text>
                </View>
                <Text style={[styles.moveDetail, { color: "#6B7280" }]}>목적지에 도착했습니다</Text>
              </View>
            </View>
          )}
        </View>

        {/* 3. AI 기반 쾌적 꿀팁  */}
        <View style={styles.llmBox}>
          <View style={styles.llmIcon}><Text style={{ fontSize: 20 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.llmTitle}>AI의 쾌적 꿀팁</Text>
            <Text style={styles.llmText}>{routeData.summary}</Text>
          </View>
        </View>
      </ScrollView>

      {/* 4. 하단 실시간 추적 시작 버튼  */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push({ pathname: "/tracking/[id]", params: { id: routeData.route_id } })}
        >
          <Text style={styles.startButtonText}>실시간 경로 추적 시작</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "white" },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827", flex: 1, textAlign: "center" },
  content: { padding: 16 },
  miniSummary: { backgroundColor: "white", padding: 24, borderRadius: 28, marginBottom: 16, elevation: 2 },
  highlightTime: { fontSize: 32, fontWeight: "900", color: "#2563EB", marginBottom: 4 },
  summarySubText: { fontSize: 16, color: "#6B7280", fontWeight: "600" },
  mainRouteCard: { backgroundColor: "white", padding: 24, borderRadius: 32, marginBottom: 16 },
  node: { flexDirection: "row", minHeight: 90 },
  nodeLeft: { width: 40, alignItems: "center" },
  circle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", zIndex: 2 },
  circleText: { color: "white", fontWeight: "900", fontSize: 13 },
  iconContainer: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  verticalLine: { width: 4, flex: 1, marginVertical: -5, backgroundColor: "#E5E7EB", borderRadius: 2 },
  nodeRight: { flex: 1, marginLeft: 20, paddingBottom: 25 },
  stationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  mainStationName: { fontSize: 20, fontWeight: "800", color: "#111827" },
  lineBadge: { fontSize: 12, color: "#6B7280", backgroundColor: "#F3F4F6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: "600" },
  moveDetail: { fontSize: 15, color: "#3B82F6", fontWeight: "700" },
  endStationText: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },
  llmBox: { flexDirection: "row", backgroundColor: "#EFF6FF", padding: 20, borderRadius: 24, gap: 15 },
  llmIcon: { width: 44, height: 44, backgroundColor: "white", borderRadius: 22, alignItems: "center", justifyContent: "center" },
  llmTitle: { fontSize: 16, fontWeight: "700", color: "#1E3A8A", marginBottom: 4 },
  llmText: { fontSize: 15, color: "#1E40AF", lineHeight: 22 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", padding: 20, paddingBottom: 40 },
  startButton: { backgroundColor: "#2563EB", paddingVertical: 18, borderRadius: 24, alignItems: "center" },
  startButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
});