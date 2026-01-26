// scripts/fetch-seoul-stations.mjs
import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.SEOUL_API_KEY; // 서울 열린데이터광장 인증키
if (!API_KEY) {
  console.error("SEOUL_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

// 서울열린데이터광장 표준 포맷:
// http://openapi.seoul.go.kr:8088/{KEY}/json/{SERVICE}/{START}/{END}/
const SERVICE = "SearchSTNBySubwayLineInfo";
const START = 1;
const END = 1000; // 역 전체가 1000 안에 들어오는 편이라 보통 한 번에 끝납니다.

const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/${SERVICE}/${START}/${END}/`;

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 응답 필드명이 데이터셋에 따라 살짝 달라질 수 있어서, 흔한 케이스들을 흡수합니다.
const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
};

const normalizeLine = (lineRaw) => {
  if (!lineRaw) return null;
  // 예: "2호선", "2", "02" 등 들어와도 통일
  const s = String(lineRaw).trim();
  const m = s.match(/\d+/);
  if (m) return `${m[0]}호선`;
  return s;
};

async function main() {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const root = data?.[SERVICE];
  if (!root) {
    throw new Error(`응답에서 ${SERVICE}를 찾지 못했습니다. (키/트래픽/URL 확인)`);
  }

  const rows = root?.row ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("row 데이터가 비어 있습니다. (키 권한/호출 제한/서비스 상태 확인)");
  }

  // 역명/노선/코드 추출 (필드명은 실제 응답에 따라 매칭)
  const stations = rows
    .map((r, idx) => {
      const name = pick(r, ["STATION_NM", "STN_NM", "STATION_NAME", "STATN_NM", "역명"]);
      const lineRaw = pick(r, ["LINE_NUM", "SUBWAY_LINE", "LINE", "호선", "LINE_NM"]);
      const stationCode = pick(r, ["STATION_CD", "STN_CD", "STATION_CODE", "STATN_ID", "역코드"]);
      const extCode = pick(r, ["FR_CODE", "EXTERNAL_CODE", "외부코드", "STATION_NUM"]);

      if (!name) return null;

      return {
        id: stationCode ?? String(idx + 1),
        name: String(name).trim(),
        line: normalizeLine(lineRaw) ?? "",
        stationCode: stationCode ? String(stationCode) : null,
        externalCode: extCode ? String(extCode) : null,
      };
    })
    .filter(Boolean);

  // (중복 제거) 같은 역명이 여러 호선에 뜰 수 있으니 (name+line) 기준으로 유니크 처리
  const map = new Map();
  for (const s of stations) {
    const key = `${s.name}__${s.line}`;
    if (!map.has(key)) map.set(key, s);
  }

  const output = Array.from(map.values()).sort((a, b) => {
    if (a.line !== b.line) return a.line.localeCompare(b.line, "ko");
    return a.name.localeCompare(b.name, "ko");
  });

  const outPath = path.join(process.cwd(), "mobile", "src", "data", "stations.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

  console.log(`OK: ${output.length} stations -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
