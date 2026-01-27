# 🚉 안끼길 (Ankkigil)

> **"퇴근길, 이제는 안 끼고 갑니다."** AI 기반 실시간 지하철 혼잡도 분석 및 덜 붐비는 경로 안내 서비스

---

## ✨ 핵심 기능 (Key Features)

* **덜 붐빔 경로 안내**: 실시간 데이터를 바탕으로 가장 여유로운 지하철 경로 추천
* **AI 혼잡도 예측**: Azure OpenAI를 활용한 구간별 혼잡 레벨 분석
* **사용자 친화적 UI**: Expo 기반의 직관적인 모바일 웹 인터페이스

---

## 🛠 기술 스택 (Tech Stack)

* **Frontend**: React Native, Expo, Axios
* **Backend**: Python, FastAPI (or Flask), Pydantic
* **AI & Data**: Azure OpenAI, ODSAY API
* **Network**: ngrok (Local Tunneling)

---

## 📂 프로젝트 구조 (Structure)

```text
ankkigil-fullstack/
├── frontend/          # React Native (Expo) 앱
│   └── .env           # EXPO_PUBLIC_API_URL 포함
├── backend/           # Python API 서버
│   └── .env           # ODSAY, AZURE 관련 키 포함
└── README.md          # 현재 파일

```

---

## ⚙️ 환경 설정 (Environment Setup)

프로젝트 실행 전, 각 폴더에 `.env` 파일을 생성하고 아래 내용을 입력해야 합니다.

### 1. Frontend (`frontend/.env`)

```text
EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.dev

```

### 2. Backend (`backend/.env`)

```text
ODSAY_API_KEY=your_odsay_key
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint

```

---

## 🚀 실행 가이드 (Execution Guide)

이 프로젝트는 **세 개의 독립적인 터미널**에서 순서대로 실행해야 합니다.

### Step 1. 백엔드 서버 기동

백엔드 폴더에서 API 서버를 실행합니다. (`--host 0.0.0.0` 설정으로 외부 기기 접속을 허용합니다.)

```zsh
cd backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

```

### Step 2. ngrok 터널링

로컬 서버(8000포트)를 외부에서 접속 가능한 공인 주소로 변환합니다.

```zsh
ngrok http 8000

```

* 터미널에 뜬 `Forwarding` 주소를 복사하여 **Frontend의 `.env**` 파일에 업데이트하세요.

### Step 3. 프론트엔드 앱 실행

프론트엔드 폴더에서 Expo를 실행합니다. 주소가 바뀌었다면 캐시 삭제(`-c`)가 필수입니다.

```zsh
cd frontend
npx expo start -c

```

* **Tip**: 네트워크 환경에 따라 외부 사용자가 접속하기 어려운 경우 `npx expo start --tunnel` 옵션을 사용하세요.

---

## ⚠️ 주의 사항 (Troubleshooting)

1. **캐시 이슈**: `.env`의 ngrok 주소를 수정했는데도 앱에서 반영이 안 된다면 반드시 `npx expo start -c`로 다시 켜주세요.
2. **서버 에러**: 백엔드 실행 시 `ValidationError`가 발생하면 `.env` 파일에 불필요한 변수(예: EXPO_PUBLIC_API_URL)가 섞여 있지 않은지 확인하세요.
3. **절대 금지**: 보안을 위해 `.env` 파일은 절대 GitHub에 Push하지 마세요. (이미 `.gitignore`에 추가 완료)

---