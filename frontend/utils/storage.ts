// utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "favorites_routes";

/**
 * [getFavorites] 저장된 모든 즐겨찾기 목록을 불러옵니다.
 */
export const getFavorites = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("로드 실패:", e);
    return [];
  }
};

/**
 * [addFavorite] 새로운 경로를 추가합니다.
 * @param route { id, name, from, to, savedSearchTime } 객체
 */
export const addFavorite = async (route: any) => {
  try {
    const current = await getFavorites();
    const exists = current.find((r: any) => r.id === route.id);
    if (exists) return current;

    const updated = [...current, route];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("추가 실패:", e);
    return [];
  }
};

/**
 * [updateFavorite] 별칭이나 시간 정보를 수정할 때 사용합니다.
 * { ...r, ...updates } 방식을 사용해 어떤 데이터든 유연하게 덮어씁니다.
 */
export const updateFavorite = async (id: string, updates: any) => {
  try {
    const current = await getFavorites();
    const updated = current.map(
      (r: any) => (r.id === id ? { ...r, ...updates } : r)
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("업데이트 실패:", e);
    return [];
  }
};

/**
 * [removeFavorite] 즐겨찾기에서 경로를 삭제합니다.
 */
export const removeFavorite = async (routeId: string) => {
  try {
    const current = await getFavorites();
    const updated = current.filter((r: any) => r.id !== routeId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("삭제 실패:", e);
    return [];
  }
};