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
 * 선택한 경로의 상세 타임라인(구간별 정보)을 보여주는 화면입니다.
 * Results 화면에서 전달받은 routeData를 파싱하여 동적으로 경로를 생성합니다.
 */
export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); // Results 페이지에서 넘겨준 파라미터(from, to, routeData)를 수신합니다.

  /**
   * [데이터 복구]
   * Results 페이지에서 JSON 문자열로 압축해서 보낸 데이터를 다시 객체 형태로 변환합니다.
   * 이렇게 하면 상세 페이지에서 서버에 다시 요청을 보낼 필요가 없어 속도가 빠릅니다.
   */
  const routeData = params.routeData
    ? JSON.parse(String(params.routeData))
    : null;

  /**
   * [getLineColor]
   * 지하철 노선 번호에 맞는 공식 색상을 반환합니다.
   * 타임라인의 원(Circle)과 수직선(Vertical Line)의 색상을 결정하는 데 사용됩니다.
   */
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
    return "#9CA3AF"; // 기본 회색
  };

  // 데이터가 정상적으로 전달되지 않았을 경우 화면을 표시하지 않습니다.
  if (!routeData) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더: 출발역과 도착역 정보를 표시 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {params.from} → {params.to}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* 1. 상단 요약 카드: 총 소요 시간과 혼잡도 정보를 한눈에 보여줌 */}
        <View style={styles.miniSummary}>
          <Text style={styles.highlightTime}>
            {routeData.total_time}분 소요
          </Text>
          <Text style={styles.summarySubText}>
            {routeData.congestion_status} | 도보 {routeData.total_walk_time}분
          </Text>
        </View>

        {/* 2. 상세 타임라인 카드: API의 segments 배열을 기반으로 경로의 단계별 상세 정보를 출력 */}
        <View style={styles.mainRouteCard}>
          {routeData.segments.map((seg: any, index: number) => (
            <View key={index} style={styles.node}>
              {/* 왼쪽 영역: 아이콘(지하철/환승/도보) 및 연결선 */}
              <View style={styles.nodeLeft}>
                {seg.type === "subway" ? (
                  // 지하철일 경우 해당 노선 색상의 원과 노선 번호 표시
                  <View
                    style={[
                      styles.circle,
                      { backgroundColor: getLineColor(seg.label) },
                    ]}
                  >
                    <Text style={styles.circleText}>
                      {seg.label.replace(/[^0-9]/g, "") || "역"}
                    </Text>
                  </View>
                ) : seg.type === "transfer" ? (
                  // 환승 아이콘
                  <View style={styles.iconContainer}>
                    <Repeat size={18} color="#9CA3AF" />
                  </View>
                ) : (
                  // 도보 아이콘
                  <View style={styles.iconContainer}>
                    <Footprints size={18} color="#9CA3AF" />
                  </View>
                )}

                {/* 마지막 노드가 아니면 다음 단계까지 이어지는 수직선을 그림 */}
                {index < routeData.segments.length - 1 && (
                  <View
                    style={[
                      styles.verticalLine,
                      // 지하철 구간일 경우 노선 색상으로 선을 칠함
                      seg.type === "subway" && {
                        backgroundColor: getLineColor(seg.label),
                      },
                    ]}
                  />
                )}
              </View>

              {/* 오른쪽 영역: 텍스트 정보 (역 이름, 소요 시간, 꿀팁 등) */}
              <View style={styles.nodeRight}>
                <View style={styles.stationRow}>
                  <Text style={styles.mainStationName}>
                    {seg.start_station_name || seg.label}
                  </Text>
                  {seg.type === "subway" && (
                    <Text style={styles.lineBadge}>{seg.label}</Text>
                  )}
                </View>

                <Text style={styles.moveDetail}>{seg.minutes}분 이동</Text>

                {/* 빠른 환승 정보(fast_transfer_door)가 있는 경우 강조 표시 */}
                {seg.fast_transfer_door && (
                  <View style={styles.fastTransferBox}>
                    <Text style={styles.fastTransferText}>
                      빠른 환승 {seg.fast_transfer_door}
                    </Text>
                  </View>
                )}

                {/* 하차 정보가 있는 경우 표시 */}
                {seg.end_station_name && (
                  <Text style={styles.endStationText}>
                    {seg.end_station_name} 방면
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 3. AI 요약 꿀팁: 백엔드에서 생성한 AI 분석 결과(summary)를 하단에 배치 */}
        <View style={styles.llmBox}>
          <View style={styles.llmIcon}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.llmTitle}>AI의 쾌적 꿀팁</Text>
            <Text style={styles.llmText}>{routeData.summary}</Text>
          </View>
        </View>
      </ScrollView>

      {/* 4. 하단 고정 버튼: 실제 이동을 위한 트래킹 화면으로 진입 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() =>
            router.push({
              pathname: "/tracking/[id]",
              params: { id: routeData.route_id }, // 경로 ID를 넘겨 추적 시작
            })
          }
        >
          <Text style={styles.startButtonText}>실시간 경로 추적 시작</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- 스타일 정의 ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  content: { padding: 16 },
  miniSummary: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 28,
    marginBottom: 16,
    elevation: 2,
  },
  highlightTime: {
    fontSize: 32,
    fontWeight: "900",
    color: "#2563EB",
    marginBottom: 4,
  },
  summarySubText: { fontSize: 16, color: "#6B7280", fontWeight: "600" },
  mainRouteCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 32,
    marginBottom: 16,
  },
  node: { flexDirection: "row", minHeight: 90 },
  nodeLeft: { width: 40, alignItems: "center" },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  circleText: { color: "white", fontWeight: "900", fontSize: 13 },
  iconContainer: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  verticalLine: {
    width: 4,
    flex: 1,
    marginVertical: -5,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
  },
  nodeRight: { flex: 1, marginLeft: 20, paddingBottom: 25 },
  stationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  mainStationName: { fontSize: 20, fontWeight: "800", color: "#111827" },
  lineBadge: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "600",
  },
  moveDetail: { fontSize: 15, color: "#3B82F6", fontWeight: "700" },
  fastTransferBox: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  fastTransferText: { color: "#B91C1C", fontSize: 12, fontWeight: "700" },
  endStationText: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },
  llmBox: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    padding: 20,
    borderRadius: 24,
    gap: 15,
  },
  llmIcon: {
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  llmTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E3A8A",
    marginBottom: 4,
  },
  llmText: { fontSize: 15, color: "#1E40AF", lineHeight: 22 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    padding: 20,
    paddingBottom: 40,
  },
  startButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: "center",
  },
  startButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
});
