# 🚀 안끼길 (ankkigil-fullstack) 개발 가이드 - 지하철 내비게이션 앱

퇴근길에 5분 단축보다 '사람에 끼지 않고 편하게' 가는 경로를 추천하는 지하철 내비게이션

이 프로젝트는 **AI 기반 지하철 혼잡도 회피 경로 안내 서비스**입니다. 로컬 환경에서 백엔드 서버와 모바일 앱(Expo)을 연결하여 개발 및 테스트를 진행하기 위한 가이드입니다.

---

## 🛠️ 사전 준비 (Prerequisites)

1. **Backend**: Python 3.9 이상 설치
2. **Frontend**: Node.js 및 npm 설치
3. **Mobile**: 스마트폰에 **Expo Go** 앱 설치 (iOS/Android)

---

## 1. 백엔드(Backend) 실행 방법

서버는 외부 기기(스마트폰)의 접속을 허용하기 위해 반드시 `0.0.0.0` 호스트로 실행해야 합니다.

```bash
# 1. backend 폴더로 이동
cd backend

# 2. 가상환경 활성화 (필요 시)
# source venv/bin/activate (Mac) 또는 venv\Scripts\activate (Windows)

# 3. 필요한 라이브러리 설치
pip install -r requirements.txt

# 4. 서버 실행 (반드시 아래 옵션으로 실행하세요)
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

```

---

## 2. 프론트엔드(Frontend) 실행 방법

```bash
# 1. frontend 폴더로 이동
cd frontend

# 2. 의존성 패키지 설치
npm install

# 3. Expo 서버 실행
npx expo start -c

# 💡 와이파이 환경이 불안정하거나 보안망(학교/카페)인 경우:
npx expo start --tunnel

```

---

## 3. ⚠️ [필독] 모바일 API 연결 설정 (중요!)

실제 스마트폰에서 API가 호출되려면, 소스코드 내의 주소를 **본인 컴퓨터의 로컬 IP**로 수정해야 합니다.

### 📍 수정할 파일

`frontend/src/app/route-results.tsx` (약 63번 라인)

### 📍 수정 방법

1. **본인 IPv4 주소 확인**
* **Windows**: 터미널에 `ipconfig` 입력 후 `IPv4 주소` 확인
* **Mac**: 터미널에 `ifconfig` 입력 후 `en0` 항목의 `inet` 주소 확인 (예: `192.168.0.15`)


2. **코드 업데이트**

```javascript
// 기존 "http://본인 PC의 IP 주소/..." 부분을 아래와 같이 수정
const response = await axios.post(
  "http://[본인_IPv4_주소]:8000/api/routes/search",
  { ... }
);

```

---

## ✅ 체크리스트 (연결이 안 될 때)

* [ ] **동일한 네트워크**: 스마트폰과 PC가 **반드시 같은 Wi-Fi**에 연결되어 있나요?
* [ ] **서버 호스트**: 백엔드 서버 실행 시 `--host 0.0.0.0` 옵션을 넣었나요?
* [ ] **방화벽**: PC의 방화벽이 8000번 포트의 인바운드 요청을 허용하고 있나요?
* [ ] **IP 확인**: 코드에 `localhost` 대신 실제 숫자 IP 주소를 적었나요?

---

---

# backend

## 프로젝트 구조

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 메인 애플리케이션
│   ├── api/                    # API 라우터 (기능별 분리)
│   │   ├── __init__.py
│   │   ├── routes.py          # 경로 조회 API
│   │   ├── crowding.py        # 혼잡도 관련 API
│   │   ├── explain.py         # 설명 관련 API
│   │   └── favorites.py       # 즐겨찾기 API
│   ├── core/                   # 코어 모듈
│   │   ├── __init__.py
│   │   └── config.py          # 설정 관리
│   ├── schemas/                # Pydantic 스키마
│   │   ├── __init__.py
│   │   └── route.py          # 경로 관련 스키마
│   └── services/               # 비즈니스 로직 서비스
│       ├── __init__.py
│       ├── odsay_service.py   # ODSay API 서비스
│       ├── route_service.py   # 경로 서비스
│       ├── congestion_service.py  # 혼잡도 서비스
│       ├── llm_service.py     # LLM 서비스 (향후)
│       └── realtime_service.py    # 실시간 정보 서비스
├── .env                        # 환경변수 (gitignore)
└── .env.example               # 환경변수 예시
```

## 프로젝트 개요

- **타겟**: 퇴근 직장인 "시간부자형"
- **핵심 가치**: 같은 도착 시간대 안에서 편안함(혼잡)을 최적화하는 경로 추천

## MVP 기능

### 필수 기능
1. 출발역/도착역 입력
2. 3가지 경로 제공:
   - 최단 경로 (ODSay API 연동)
   - 최소 걸음 경로 (ODSay API 연동)
   - 시간부자 전용 경로 (혼잡도 최적화, +15분 이내 제약)

## API 엔드포인트

### 경로 조회
- `GET /api/v1/routes?departure={station}&arrival={station}`

### 혼잡도 조회
- `GET /api/v1/crowding/train?line_number={line}&station_id={id}&direction={dir}`

### 설명 생성
- `GET /api/v1/explain/comfort?route_id={id}`

### 즐겨찾기
- `GET /api/v1/favorites` - 목록 조회
- `POST /api/v1/favorites` - 생성
- `DELETE /api/v1/favorites/{id}` - 삭제

## 실행 방법

### 1. 환경 설정

```bash
# backend 디렉토리로 이동
cd backend

# .env 파일 생성 (.env.example 참고)
cp .env.example .env

# .env 파일 편집하여 ODSay API 키 설정
# ODSAY_API_KEY=your_odsay_api_key_here
```

ODSay API 키는 [ODSay 개발자 콘솔](https://lab.odsay.com/)에서 발급받을 수 있습니다.

### 2. 의존성 설치

```bash
# 프로젝트 루트에서
pip install -r requirements.txt
```

### 3. 서버 실행

```bash
# backend 디렉토리에서
cd backend
uvicorn app.main:app --reload

# 또는 프로젝트 루트에서
uvicorn backend.app.main:app --reload
```

### 4. API 문서 확인

브라우저에서 `http://localhost:8000/docs` 접속하여 API 문서를 확인할 수 있습니다.

## ODSay API 연동

이 프로젝트는 [ODSay 대중교통 API](https://lab.odsay.com/guide/releaseReference#searchPubTransPathT)를 사용합니다:

- **최단 경로**: `searchPubTransPath` API의 `SearchType=0` (최단시간)
- **최소 걸음 경로**: `searchPubTransPath` API의 `SearchType=3` (최소도보)

ODSay API는 다음 기능을 제공합니다:
- 대중교통 정류장 검색 (`searchStation`)
- 대중교통 길찾기 (`searchPubTransPath`)

## 개발 가이드

### 새로운 API 추가

1. `app/api/` 디렉토리에 새로운 라우터 파일 생성
2. `app/main.py`에서 라우터 등록

### 새로운 서비스 추가

1. `app/services/` 디렉토리에 서비스 파일 생성
2. `app/services/__init__.py`에서 export

### 스키마 추가

1. `app/schemas/` 디렉토리에 스키마 파일 생성
2. `app/schemas/__init__.py`에서 export

## 환경변수

- `ODSAY_API_KEY`: ODSay API 키 (필수)
- `LLM_API_KEY`: LLM API 키 (선택, 향후 사용)
- `DEBUG`: 디버그 모드 (기본값: False)
