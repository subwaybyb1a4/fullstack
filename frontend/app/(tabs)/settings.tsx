/**
 * 설정 화면
 */
import Slider from "@react-native-community/slider";
import {
  Footprints,
  Repeat,
  RotateCcw,
  Save,
  Users,
} from "lucide-react-native";
import React, { useState } from "react";
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

// 설정 화면 (순정 모드)
export default function SettingsScreen() {
  const [congestionWeight, setCongestionWeight] = useState(70);
  const [transferWeight, setTransferWeight] = useState(50);
  const [walkingWeight, setWalkingWeight] = useState(60);

  const handleReset = () => {
    setCongestionWeight(50);
    setTransferWeight(50);
    setWalkingWeight(50);
    Alert.alert("알림", "설정이 초기화되었습니다.");
  };

  const handleSave = () => {
    Alert.alert("성공", "나만의 쾌적 기준이 저장되었습니다!");
  };

  // 슬라이더 컴포넌트
  const CustomSlider = ({
    label,
    subLabel,
    value,
    setValue,
    icon: Icon,
    color,
    descFunc,
  }: any) => (
    <View style={styles.sliderCard}>
      <View style={styles.sliderHeader}>
        <View style={[styles.iconBox, { backgroundColor: color.bg }]}>
          <Icon size={24} color={color.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sliderLabel}>{label}</Text>
          <Text style={styles.sliderSubLabel}>{subLabel}</Text>
        </View>
        <Text style={[styles.sliderValue, { color: color.text }]}>{value}</Text>
      </View>

      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={setValue}
        minimumTrackTintColor={color.text}
        maximumTrackTintColor="#E5E7EB"
        thumbTintColor={color.text}
      />

      <View style={styles.sliderRangeLabels}>
        <Text style={styles.rangeText}>중요하지 않음</Text>
        <Text style={styles.rangeText}>매우 중요함</Text>
      </View>

      <View style={styles.descBox}>
        <Text style={styles.descText}>{descFunc(value)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>쾌적 기준 설정</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 안내 카드 */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconBox}>
            <Users size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>나만의 쾌적 기준</Text>
            <Text style={styles.infoDesc}>
              각 요소의 중요도를 조절하세요. 높을수록 해당 요소를 더 중요하게
              고려합니다.
            </Text>
          </View>
        </View>

        {/* 1. 혼잡도 */}
        <CustomSlider
          label="혼잡도"
          subLabel="사람 많은 것이 싫어요"
          value={congestionWeight}
          setValue={setCongestionWeight}
          icon={Users}
          color={{ bg: "#FEE2E2", text: "#DC2626" }}
          descFunc={(val: number) =>
            val < 30
              ? "혼잡도를 크게 신경쓰지 않습니다"
              : val < 70
                ? "적당한 수준의 혼잡도를 선호합니다"
                : "여유로운 공간을 매우 중요하게 생각합니다."
          }
        />

        {/* 2. 환승 */}
        <CustomSlider
          label="환승"
          subLabel="환승이 제일 싫어요"
          value={transferWeight}
          setValue={setTransferWeight}
          icon={Repeat}
          color={{ bg: "#FEF9C3", text: "#CA8A04" }}
          descFunc={(val: number) =>
            val < 30
              ? "환승 횟수를 크게 신경쓰지 않습니다"
              : val < 70
                ? "적절한 수준의 환승을 선호합니다"
                : "직통 또는 최소 환승을 매우 선호합니다."
          }
        />

        {/* 3. 도보 */}
        <CustomSlider
          label="도보 거리"
          subLabel="많이 걷기 싫어요"
          value={walkingWeight}
          setValue={setWalkingWeight}
          icon={Footprints}
          color={{ bg: "#F3E8FF", text: "#9333EA" }}
          descFunc={(val: number) =>
            val < 30
              ? "도보 거리를 크게 신경쓰지 않습니다"
              : val < 70
                ? "적당한 도보 거리를 선호합니다"
                : "걷는 거리가 짧은 경로를 우선 추천합니다."
          }
        />

        {/* 버튼 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <RotateCcw size={20} color="#374151" />
            <Text style={styles.resetButtonText}>초기화</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Save size={20} color="white" />
            <Text style={styles.saveButtonText}>저장하기</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  content: { flex: 1, padding: 20 },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoIconBox: {
    width: 40,
    height: 40,
    backgroundColor: "#2563EB",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { fontWeight: "700", color: "#1E3A8A", marginBottom: 4 },
  infoDesc: { fontSize: 14, color: "#1D4ED8", lineHeight: 20 },
  sliderCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderLabel: { fontSize: 18, fontWeight: "600", color: "#111827" },
  sliderSubLabel: { fontSize: 14, color: "#6B7280" },
  sliderValue: { fontSize: 24, fontWeight: "700" },
  sliderRangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 12,
  },
  rangeText: { fontSize: 12, color: "#9CA3AF" },
  descBox: { backgroundColor: "#F9FAFB", padding: 12, borderRadius: 8 },
  descText: { fontSize: 14, color: "#374151" },
  buttonContainer: { flexDirection: "row", gap: 12, marginTop: 12 },
  resetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  resetButtonText: { fontWeight: "700", color: "#374151", fontSize: 16 },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: { fontWeight: "700", color: "white", fontSize: 16 },
});
