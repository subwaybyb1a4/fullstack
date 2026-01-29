
---

# 🚇 편안한 지하철 내비게이션 (ankkigil-subway)

덜붐빔 지하철 내비게이션 프로젝트의 프론트엔드 저장소입니다. 소요 시간 단축보다 '사람에 끼지 않고 편하게' 가는 **덜붐빔 경로**를 추천하는 서비스를 목표로 합니다.

## 🎨 Design Resources

* **UI/UX Design:** [Figma Design Link](https://www.notion.so/1-2e9e2b51de4c80e9954bde26b7edd12c?source=copy_link#2f6e2b51de4c80b99f0ee68bc7b62ad8)

## 📂 프로젝트 폴더 구조 (Project Structure)

이 프로젝트는 **FastAPI 기반의 백엔드**와 **Expo(React Native) 기반의 프론트엔드**로 구성되어 있습니다.

### 📱 Frontend (Expo / React Native)

`frontend/` 폴더는 사용자 인터페이스와 앱 기능을 담당합니다. Expo Router의 파일 기반 라우팅을 사용합니다.

```text
frontend/
├── 📂 app/                      # 화면(Page) 및 라우팅
│   ├── _layout.tsx              # 앱 전체 레이아웃
│   ├── (tabs)/                  # 하단 탭 화면 그룹
│   ├── detail/                  # 경로 상세 정보
│   └── tracking/                # 실시간 추적 및 지도
├── 📂 assets/                   # 이미지, 아이콘 리소스
├── 📂 data/                     # 프론트엔드용 정적 데이터
└── 📂 utils/                    # 유틸리티 함수 (storage.ts 등)

```

---

## 🚀 시작하기 (Getting Started)

### 1. Backend 실행 (FastAPI)

```bash
# 백엔드 폴더로 이동
cd backend

# 필요한 패키지 설치
pip install -r requirements.txt

# 서버 실행
uvicorn app.main:app --reload

```

### 2. Frontend 실행 (Expo)

```bash
# 프론트엔드 폴더로 이동
cd frontend

# 의존성 패키지 설치
npm install

# 앱 실행
npx expo start

```

---

### 💡 팁

* **npm install**: 프로젝트에 필요한 라이브러리들을 한 번에 설치해 줍니다. 처음 프로젝트를 다운받았을 때 딱 한 번만 실행하면 돼요.
* **npx expo start**: 개발 서버를 여는 명령어입니다. 실행 후 뜨는 QR 코드를 핸드폰으로 찍으면 앱을 바로 확인할 수 있어요!
