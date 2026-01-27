import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin } from "lucide-react-native";
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

export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // 데이터 파싱
  let routeData = null;
  try {
    if (params.routeData) {
      const decodedString = decodeURIComponent(String(params.routeData));
      routeData = JSON.parse(decodedString);
    }
  } catch (e) {
    try {
      routeData = params.routeData ? JSON.parse(String(params.routeData)) : null;
    } catch (e2) {
      routeData = null;
    }
  }

  // 호선별 색상
  const getLineColor = (label: string) => {
    if (!label) return "#9CA3AF";
    if (label.includes("1")) return "#0052A4";
    if (label.includes("2")) return "#3CB44A";
    if (label.includes("3")) return "#EF7C1C";
    if (label.includes("4")) return "#00A5DE";
    if (label.includes("5")) return "#996CAC";
    if (label.includes("6")) return "#CD7C2F";
    if (label.includes("7")) return "#747F00";
    if (label.includes("8")) return "#E6186C";
    if (label.includes("9")) return "#BDB092";
    if (label.includes("신분당")) return "#D4003B";
    if (label.includes("수인분당")) return "#F5A200";
    if (label.includes("경의중앙")) return "#77C4A3";
    if (label.includes("공항")) return "#0090D2";
    return "#9CA3AF";
  };

  if (!routeData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>경로 정보를 불러올 수 없습니다.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: "#2563EB" }}>뒤로 가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {params.from} → {params.to}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 요약 카드 */}
        <View style={styles.summaryCard}>
          <Text style={styles.totalTime}>{routeData.total_time}분 소요</Text>
          <Text style={styles.summaryDetail}>
            {routeData.congestion_status} | 도보 {routeData.total_walk_time}분
          </Text>
        </View>

        {/* 🚀 세로 타임라인 */}
        <View style={styles.timelineContainer}>
          
          {/* 1. 시작점 */}
          {/* 해결: 선이 점 중앙(top: 24)에서 시작해 아래로만 내려감 */}
          <View style={styles.nodeItem}>
            <View style={styles.nodeLeft}>
              <View style={[styles.line, { top: 24, bottom: -2, backgroundColor: "#E5E7EB" }]} />
              <View style={[styles.dot, { backgroundColor: "#111827" }]} />
            </View>
            <View style={styles.nodeRight}>
              <Text style={styles.stationName}>{params.from}역 <Text style={styles.actionText}>출발</Text></Text>
            </View>
          </View>

          {/* 2. 구간별 루프 */}
          {routeData.segments.map((seg: any, index: number) => {
            const isSubway = seg.type === "subway" || seg.type === "SUBWAY";
            const lineColor = isSubway ? getLineColor(seg.label) : "#E5E7EB";

            // 도보 구간
            if (!isSubway) {
              return (
                <View key={index} style={styles.nodeItem}>
                  <View style={styles.nodeLeft}>
                    {/* 위아래 꽉 채우는 회색 선 */}
                    <View style={[styles.line, { top: -2, bottom: -2, backgroundColor: "#E5E7EB" }]} />
                  </View>
                  <View style={styles.nodeRightContent}>
                    <Text style={styles.walkText}> 도보 {seg.minutes}분 이동</Text>
                  </View>
                </View>
              );
            }

            // 지하철 구간
            return (
              <React.Fragment key={index}>
                {/* (1) 승차 */}
                {/* 해결: 위에서 오는 회색 선(top: -2 ~ 24) + 아래로 가는 파란 선(top: 24 ~ bottom) */}
                <View style={styles.nodeItem}>
                  <View style={styles.nodeLeft}>
                     {/* 1. 위에서 오는 연결선 (보통 도보니까 회색) */}
                    <View style={[styles.line, { top: -2, height: 26, backgroundColor: "#E5E7EB" }]} />
                     {/* 2. 아래로 가는 출발선 (노선색) - 여기가 핵심! 점 중앙에서 시작 */}
                    <View style={[styles.line, { top: 24, bottom: -2, backgroundColor: lineColor }]} />
                    <View style={[styles.dot, { backgroundColor: lineColor, width: 16, height: 16 }]} />
                  </View>
                  <View style={styles.nodeRight}>
                    <Text style={[styles.stationName, { color: lineColor }]}>
                      {seg.start_station_name}역 <Text style={styles.actionText}>승차</Text>
                    </Text>
                    <View style={[styles.badge, { backgroundColor: lineColor + "20" }]}>
                      <Text style={[styles.badgeText, { color: lineColor }]}>{seg.label}</Text>
                    </View>
                  </View>
                </View>

                {/* (2) 이동 중 */}
                <View style={styles.nodeItem}>
                  <View style={styles.nodeLeft}>
                    <View style={[styles.line, { top: -2, bottom: -2, backgroundColor: lineColor }]} />
                  </View>
                  <View style={styles.nodeRightContent}>
                    <Text style={styles.moveTimeText}> {seg.minutes}분 이동</Text>
                    {seg.end_station_name && (
                      <Text style={styles.directionText}> {seg.end_station_name}역 방향</Text>
                    )}
                  </View>
                </View>

                {/* (3) 하차 */}
                {/* 해결: 위에서 오는 파란 선(top: -2 ~ 24) + 아래로 가는 회색 선(top: 24 ~ bottom) */}
                <View style={styles.nodeItem}>
                  <View style={styles.nodeLeft}>
                    {/* 1. 도착하는 선 (노선색) */}
                    <View style={[styles.line, { top: -2, height: 26, backgroundColor: lineColor }]} />
                    {/* 2. 다음으로 이어지는 선 (회색) - 여기가 핵심! 끊김 방지 */}
                    <View style={[styles.line, { top: 24, bottom: -2, backgroundColor: "#E5E7EB" }]} />
                    <View style={[styles.dot, { backgroundColor: lineColor, width: 16, height: 16 }]} />
                  </View>
                  <View style={styles.nodeRight}>
                    <Text style={[styles.stationName, { color: "#374151" }]}>
                      {seg.end_station_name}역 <Text style={styles.actionText}>하차</Text>
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}

          {/* 3. 도착점 */}
          {/* 해결: 선이 핀 중앙(top: 26)까지만 오고 멈춤 */}
          <View style={styles.nodeItem}>
            <View style={styles.nodeLeft}>
              <View style={[styles.line, { top: -2, height: 28, backgroundColor: "#E5E7EB" }]} />
              <MapPin size={26} color="#DC2626" fill="#DC2626" style={{ marginTop: 12, zIndex: 2 }} />
            </View>
            <View style={[styles.nodeRight, { paddingTop: 2 }]}>
              <Text style={styles.stationName}>
                {routeData.segments.length > 0 && routeData.segments[routeData.segments.length - 1].end_station_name 
                  ? routeData.segments[routeData.segments.length - 1].end_station_name + "역"
                  : params.to + "역"} 
                <Text style={[styles.actionText, {color: "#DC2626"}]}> 도착</Text>
              </Text>
            </View>
          </View>

        </View>

        {/* AI 꿀팁 */}
        <View style={styles.llmBox}>
          <Text style={{ fontSize: 24 }}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.llmTitle}>AI의 쾌적 꿀팁</Text>
            <Text style={styles.llmText}>{routeData.summary}</Text>
          </View>
        </View>
      </ScrollView>

      {/* 추적 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => {
            router.push({
              pathname: "/tracking/[id]",
              params: { 
                id: routeData.route_id,
                routeData: params.routeData, 
                from: params.from,           
                to: params.to                
              } 
            });
          }}
        >
          <Text style={styles.startButtonText}>실시간 경로 추적 시작</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "white" },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827", flex: 1, textAlign: "center" },
  
  content: { padding: 20 },
  
  summaryCard: { backgroundColor: "white", padding: 24, borderRadius: 24, marginBottom: 28, elevation: 2 },
  totalTime: { fontSize: 32, fontWeight: "900", color: "#2563EB", marginBottom: 6 },
  summaryDetail: { fontSize: 18, color: "#6B7280", fontWeight: "600" },

  timelineContainer: { paddingLeft: 10 },
  
  // ✅ [확인] 왼쪽 영역 중앙 정렬
  nodeItem: { flexDirection: "row", minHeight: 50 }, 
  nodeLeft: { 
    width: 40,             
    alignItems: "center",  // 가로 중앙 정렬
    justifyContent: "flex-start", 
    marginRight: 12,       
    position: "relative"
  },
  
  // ✅ [확인] 선 스타일 (top, bottom은 JSX에서 직접 제어)
  line: {
    position: "absolute",
    width: 4,        
    backgroundColor: "#E5E7EB",
    zIndex: 0,
  },
  
  // ✅ [확인] 점 스타일 (위에서 16px 떨어짐 -> 중심점은 16+8 = 24px)
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 16, 
    zIndex: 1,
  },

  nodeRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 20 },
  nodeRightContent: { flex: 1, paddingBottom: 20, justifyContent: "center" },
  
  stationName: { fontSize: 22, fontWeight: "800", color: "#111827" }, 
  actionText: { fontSize: 18, fontWeight: "600", color: "#6B7280" }, 
  
  walkText: { fontSize: 17, color: "#6B7280", fontWeight: "500", marginLeft: 4 },
  moveTimeText: { fontSize: 17, color: "#4B5563", fontWeight: "700", marginLeft: 4 },
  directionText: { fontSize: 15, color: "#9CA3AF", marginTop: 4, marginLeft: 4 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 13, fontWeight: "700" },

  llmBox: { flexDirection: "row", backgroundColor: "#EFF6FF", padding: 24, borderRadius: 24, gap: 15, marginTop: 10 },
  llmTitle: { fontSize: 18, fontWeight: "700", color: "#1E3A8A", marginBottom: 6 },
  llmText: { fontSize: 16, color: "#1E40AF", lineHeight: 24 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", padding: 20, paddingBottom: 40 },
  startButton: { backgroundColor: "#2563EB", paddingVertical: 18, borderRadius: 24, alignItems: "center" },
  startButtonText: { color: "white", fontSize: 19, fontWeight: "800" },
});