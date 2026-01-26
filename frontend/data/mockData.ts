// 1. 타입 정의
export interface Station {
  id: string;
  name: string;
  line: string;
}

export interface Route {
  id: string;
  segments: any[];
  transfers: any[];
  totalTime: number;
  totalDistance: number;
  fare: number;
  comfortScore: number;
  comfortFactors: {
    congestionScore: number;
    transferScore: number;
    walkingScore: number;
    seatProbability: number;
  };
}

export interface FavoriteRoute {
  id: string;
  name: string;
  from: Station;
  to: Station;
  currentCongestion: "low" | "medium" | "high";
}

// 2. 역 데이터
export const stations: Station[] = [
  { id: "1", name: "강남역", line: "2호선" },
  { id: "2", name: "역삼역", line: "2호선" },
  { id: "3", name: "삼성역", line: "2호선" },
  { id: "4", name: "선릉역", line: "2호선, 분당선" },
  { id: "5", name: "홍대입구역", line: "2호선, 경의중앙선" },
  { id: "6", name: "신촌역", line: "2호선" },
  { id: "8", name: "시청역", line: "1호선, 2호선" },
  { id: "11", name: "광화문역", line: "5호선" },
  { id: "14", name: "잠실역", line: "2호선, 8호선" },
  { id: "15", name: "성수역", line: "2호선" },
  { id: "16", name: "건대입구역", line: "2호선, 7호선" },
];

// 3. 즐겨찾기 데이터
export const favoriteRoutes: FavoriteRoute[] = [
  {
    id: "f1",
    name: "집으로",
    from: stations[0], // 강남
    to: stations[8], // 잠실
    currentCongestion: "medium",
  },
  {
    id: "f2",
    name: "회사로",
    from: stations[4], // 홍대
    to: stations[0], // 강남
    currentCongestion: "high",
  },
];

// 4. [중요!] 검색 결과용 경로 데이터 (이게 없어서 에러가 났습니다)
export const sampleRoutes: Route[] = [
  {
    id: "r1",
    totalTime: 42,
    totalDistance: 12.5,
    fare: 1450,
    comfortScore: 88,
    transfers: ["잠실"],
    comfortFactors: {
      congestionScore: 85, // 점수가 높을수록 좋음 (여유로움)
      transferScore: 90,
      walkingScore: 80,
      seatProbability: 85,
    },
    segments: [
      {
        line: "2호선",
        from: { name: "강남" },
        to: { name: "잠실" },
        duration: 12,
        distance: 5,
        congestion: "low",
      },
      {
        line: "8호선",
        from: { name: "잠실" },
        to: { name: "목적지" },
        duration: 30,
        distance: 7.5,
        congestion: "medium",
      },
    ],
  },
  {
    id: "r2",
    totalTime: 35, // 시간은 더 짧음
    totalDistance: 10.2,
    fare: 1350,
    comfortScore: 45, // 쾌적도는 낮음
    transfers: ["건대입구"],
    comfortFactors: {
      congestionScore: 30,
      transferScore: 40,
      walkingScore: 60,
      seatProbability: 20,
    },
    segments: [
      {
        line: "2호선",
        from: { name: "강남" },
        to: { name: "건대입구" },
        duration: 20,
        distance: 8,
        congestion: "high",
      },
      {
        line: "7호선",
        from: { name: "건대입구" },
        to: { name: "목적지" },
        duration: 15,
        distance: 2.2,
        congestion: "high",
      },
    ],
  },
];

// 5. 상세 화면용 추천 칸 데이터
export const carRecommendations = [
  {
    carNumber: "3-1",
    position: "계단 앞",
    reason: "환승 통로와 가장 가까워요",
  },
  {
    carNumber: "5-2",
    position: "엘리베이터",
    reason: "노약자석이 여유로워요",
  },
  {
    carNumber: "7-4",
    position: "중앙",
    reason: "현재 가장 덜 붐비는 칸이에요",
  },
];
