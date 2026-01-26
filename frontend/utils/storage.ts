import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "favorites_routes";

// 즐겨찾기 목록 불러오기
export const getFavorites = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
};

// 즐겨찾기 추가하기
export const addFavorite = async (route: any) => {
  try {
    const current = await getFavorites();
    // 이미 있는지 확인 (중복 방지)
    const exists = current.find((r: any) => r.id === route.id);
    if (exists) return current; // 이미 있으면 그대로 리턴

    const updated = [...current, route];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error(e);
    return [];
  }
};

// 즐겨찾기 이름 수정하기
export const updateFavoriteName = async (id: string, newName: string) => {
  try {
    const current = await getFavorites(); // 1. 전체 목록 가져오기
    const updated = current.map(
      (r: any) => (r.id === id ? { ...r, name: newName } : r), // 2. ID가 일치하는 항목의 이름만 변경
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); // 3. 갱신된 목록 저장
    return updated;
  } catch (e) {
    console.error("이름 수정 실패:", e);
    return [];
  }
};

// 즐겨찾기 삭제하기
export const removeFavorite = async (routeId: string) => {
  try {
    const current = await getFavorites();
    const updated = current.filter((r: any) => r.id !== routeId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error(e);
    return [];
  }
};
