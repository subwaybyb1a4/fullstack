import { ChevronRight, Map, Info, X, Mail, Phone } from "lucide-react-native";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Platform,
  Alert,   // 👈 알림창용
  Linking, // 👈 외부 앱(메일, 브라우저) 연결용
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ImageViewer from "react-native-image-zoom-viewer";

export default function SettingsScreen() {
  const [isMapVisible, setMapVisible] = useState(false);

  const images = [
    {
      url: "",
      props: {
        source: require("../../assets/images/subway_map.png"),
      },
    },
  ];

  // ✅ [기능 1] 앱 버전 확인
  const handleVersionCheck = () => {
    Alert.alert("앱 버전 정보", "현재 최신 버전 (v1.0.0 Beta)을 사용 중입니다.");
  };

  // ✅ [기능 2] 문의하기 (이메일 앱 연동)
  const handleContact = async () => {
    const email = "support@ankkigil.com"; // 💡 가은 님의 실제 이메일로 바꾸세요!
    const subject = "[안끼길] 문의사항";
    const url = `mailto:${email}?subject=${subject}`;

    // 이메일 앱 열기 시도
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // 이메일 앱이 없거나 웹일 경우 알림으로 대체
      Alert.alert("문의하기", `문의사항은 ${email} 로 메일을 보내주세요.`);
    }
  };

  const SettingItem = ({ icon: Icon, title, onPress, color, subTitle }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconBox, { backgroundColor: color }]}>
        <Icon size={20} color="white" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuText}>{title}</Text>
        {subTitle && <Text style={styles.menuSubText}>{subTitle}</Text>}
      </View>
      <ChevronRight size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 서비스 정보 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>서비스 정보</Text>
          <View style={styles.menuGroup}>
            <SettingItem
              icon={Map}
              title="지하철 노선도 보기"
              subTitle="전체 노선도를 크게 확인하세요"
              color="#3B82F6"
              onPress={() => setMapVisible(true)}
            />
            {/* 🔥 onPress에 함수 연결됨 */}
            <SettingItem
              icon={Info}
              title="앱 버전"
              subTitle="v1.0.0 (Beta)"
              color="#10B981"
              onPress={handleVersionCheck} 
            />
          </View>
        </View>

        {/* 지원 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>지원</Text>
          <View style={styles.menuGroup}>
            {/* 🔥 문의하기 버튼도 연결됨 */}
            <SettingItem
              icon={Mail}
              title="문의하기"
              subTitle="개발자에게 의견 보내기"
              color="#F59E0B"
              onPress={handleContact}
            />
          </View>
        </View>
      </ScrollView>

      {/* 🗺️ 노선도 모달 (웹/앱 호환 유지) */}
      <Modal 
        visible={isMapVisible} 
        transparent={true} 
        animationType="fade"
        onRequestClose={() => setMapVisible(false)}
      >
        {Platform.OS === 'web' ? (
          <View style={styles.webMapContainer}>
            <TouchableOpacity 
              style={styles.closeButtonWeb} 
              onPress={() => setMapVisible(false)}
            >
              <X size={30} color="white" />
            </TouchableOpacity>
            <Image
              source={require("../../assets/images/subway_map.png")}
              style={{ width: '100%', height: '90%' }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <ImageViewer
            imageUrls={images}
            enableSwipeDown={true}
            onSwipeDown={() => setMapVisible(false)}
            renderHeader={() => (
              <TouchableOpacity style={styles.closeButton} onPress={() => setMapVisible(false)}>
                <X size={30} color="white" />
              </TouchableOpacity>
            )}
            renderImage={(props) => (
              <Image 
                {...props} 
                style={{ width: '100%', height: '100%' }} 
                resizeMode="contain" 
              />
            )}
            backgroundColor="black"
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { padding: 20, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#6B7280", marginBottom: 8, marginLeft: 4 },
  menuGroup: { backgroundColor: "white", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F3F4F6" },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 14 },
  menuText: { fontSize: 16, fontWeight: "600", color: "#1F2937" },
  menuSubText: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  
  closeButton: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  webMapContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  closeButtonWeb: { position: "absolute", top: 20, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer' },
});