"""
LLM 서비스 (Azure OpenAI를 사용한 경로 설명 생성)
"""
from typing import Optional, Dict, Any, List
from app.core.config import settings
from openai import AzureOpenAI
import json
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document


class LLMService:
    """Azure OpenAI LLM 서비스"""
    
    def __init__(self):
        """
        Azure OpenAI 클라이언트 초기화
        """
        if not settings.AZURE_OPENAI_API_KEY:
            self.client = None
            print("경고: Azure OpenAI API 키가 설정되지 않았습니다.")
        else:
            self.client = AzureOpenAI(
                api_key=settings.AZURE_OPENAI_API_KEY,
                api_version=settings.AZURE_OPENAI_API_VERSION,
                azure_endpoint=settings.AZURE_OPENAI_ENDPOINT
            )
            self.deployment_name = settings.AZURE_OPENAI_DEPLOYMENT_NAME
        
        # RAG 초기화
        self.congestion_chunks = self._load_congestion_rag()
    
    def _load_congestion_rag(self):
        """혼잡 규칙 RAG 로드"""
        rag_path = Path(__file__).parent.parent.parent / "congestion_rules.txt"
        if rag_path.exists():
            with open(rag_path, "r", encoding="utf-8") as f:
                congestion_rules_text = f.read()
            splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            return splitter.create_documents([congestion_rules_text])
        return []
    
    def retrieve_congestion_rules(self, route_data: Dict[str, Any]) -> str:
        """RAG에서 혼잡 참고 데이터 검색 (실제 환승역만 매칭)"""
        if not self.congestion_chunks:
            return ""

        # 실제 환승이 발생하는 역만 수집 (transfers 정보 활용)
        transfers = route_data.get("transfers", [])
        transfer_stations = set()
        for transfer in transfers:
            station_name = transfer.get("station", {}).get("station_name", "")
            if station_name:
                transfer_stations.add(station_name.replace("역", "").strip())
        
        # 환승이 없으면 RAG 불필요
        if not transfer_stations:
            return ""

        # 시간대 확인
        time_str = route_data.get("time_str", "09:00")
        try:
            hour = int(time_str.split(":")[0])
            is_peak = hour in [7, 8, 9, 18, 19]
        except:
            is_peak = False
        
        if not is_peak:
            return ""

        # 실제 환승역이 포함된 청크만 검색
        retrieved_texts = []
        for chunk in self.congestion_chunks:
            chunk_text = chunk.page_content
            # 청크에 환승역 이름이 포함되어 있는지 확인
            for station in transfer_stations:
                if station in chunk_text:
                    retrieved_texts.append(chunk_text)
                    break  # 하나라도 매칭되면 추가하고 다음 청크로
            
            if len(retrieved_texts) >= 3:  # 최대 3개
                break

        return "\n".join(retrieved_texts)
    
    async def generate_route_explanation(
        self,
        route_data: Dict[str, Any],
        congestion_score: float,
        congestion_level: str,
        segment_details: List[Dict[str, Any]]
    ) -> str:
        """
        경로 설명 생성 (Azure OpenAI 사용)
        
        Args:
            route_data: 경로 정보
            congestion_score: 혼잡도 점수
            congestion_level: 혼잡도 레벨
            segment_details: 구간별 상세 정보
        
        Returns:
            경로 설명
        """
        if not self.client:
            return self._generate_rule_based_description(
                route_data, congestion_score, congestion_level, segment_details
            )
        
        try:
            num_transfers = len(route_data.get("transfers", []))
            total_time = route_data.get("total_duration", 0) / 60  # 초 -> 분
            avg_congestion = sum(seg['congestion'] for seg in segment_details) / len(segment_details)
            max_congestion = max(seg['congestion'] for seg in segment_details)

            # RAG에서 혼잡 참고 데이터 검색
            congestion_context = self.retrieve_congestion_rules(route_data)

            # 실제 환승역 목록 생성
            transfer_stations = []
            for transfer in route_data.get("transfers", []):
                station_name = transfer.get("station", {}).get("station_name", "")
                if station_name:
                    transfer_stations.append(station_name)
            
            transfer_info = f"실제 환승역: {', '.join(transfer_stations)}" if transfer_stations else "환승 없음"
            
            prompt = f"""
너는 지하철 경로 안내 전문가이다.
실제 환승역 정보를 확인하고, 사용자가 환승할 때 도움이 되는 실용적인 조언을 제공하라.

**중요 지침**:
1. 반드시 아래 "실제 환승역" 목록에 있는 역만 언급할 것.
2. **"데이터가 없다", "정보가 부족하다"는 식의 표현은 절대 사용하지 말 것.**
3. 모든 정보는 확신 있는 어조로 제공할 것.

[실제 경로 정보]
{transfer_info}

[혼잡 참고 데이터]
{congestion_context if congestion_context else "일반적인 혼잡도 및 환승 편의 정보를 바탕으로 작성하세요."}

[이번 경로 정보]
- 총 소요시간: {total_time:.0f}분
- 환승 횟수: {num_transfers}회
- 혼잡도: {congestion_level}
- 평균 혼잡도: {avg_congestion:.1f}%
- 최대 혼잡도: {max_congestion:.1f}%

조건:
- 2-3문장으로 구성 (최대 150자)
- 첫 문장: 전체적인 혼잡도 체감 표현 (예: "이번 열차는 여유롭네요!", "약간 붐빌 수 있어요")
- 둘째 문장: 구체적인 팁이나 주의사항 (환승역 위치, 빠른 환승 칸, 이동 편의 등)
- **반드시 실제 환승역 목록에 있는 역만 언급, 환승역이 있다면 환승에 대한 내용 꼭 언급**
- 친근하고 실용적인 톤 유지

예시:
- "이번 열차는 여유롭네요! 동대문역사문화공원 환승은 1-1 칸을 이용하면 빠르게 갈아탈 수 있어요."
- "이동 시간이 짧고 쾌적한 경로입니다. 환승 시 앞쪽 칸을 이용하면 더욱 편리하게 이동 가능합니다."
- "전반적으로 쾌적한 경로예요! 환승역은 이동 거리가 있을 수 있으니 미리 여유 있게 준비하세요."

설명:
"""
            
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {"role": "system", "content": "당신은 지하철 경로 안내 전문가입니다. 친근하고 실용적인 조언을 제공합니다."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=250,
                temperature=0.8,
            )
            
            description = response.choices[0].message.content.strip()
            
            if len(description) > 150:
                description = description[:150] + "..."
            
            if not description or len(description) < 10:
                return self._generate_rule_based_description(
                    route_data, congestion_score, congestion_level, segment_details
                )
            
            return description
            
        except Exception as e:
            print(f"LLM 설명 생성 실패: {e}")
            return self._generate_rule_based_description(
                route_data, congestion_score, congestion_level, segment_details
            )
    
    def _generate_rule_based_description(
        self,
        route_data: Dict[str, Any],
        congestion_score: float,
        congestion_level: str,
        segment_details: List[Dict[str, Any]]
    ) -> str:
        """규칙 기반 설명 생성 (백업용)"""
        
        num_transfers = len(route_data.get("transfers", []))
        total_time = route_data.get("total_duration", 0) / 60
        avg_congestion = sum(seg['congestion'] for seg in segment_details) / len(segment_details)
        max_congestion = max(seg['congestion'] for seg in segment_details)
        
        description_parts = []
        
        # 시간 정보
        if total_time < 30:
            description_parts.append("빠른 경로")
        elif total_time < 45:
            description_parts.append("적당한 소요시간")
        else:
            description_parts.append("긴 이동시간")
        
        # 환승 정보
        if num_transfers == 0:
            description_parts.append("직통")
        elif num_transfers == 1:
            description_parts.append("1회 환승")
        else:
            description_parts.append(f"{num_transfers}회 환승")
        
        # 혼잡도 정보
        if max_congestion >= 40:
            description_parts.append("일부 구간 매우 혼잡")
        elif avg_congestion >= 30:
            description_parts.append("전반적으로 혼잡")
        elif avg_congestion >= 20:
            description_parts.append("보통 수준의 혼잡도")
        else:
            description_parts.append("여유로운 구간")
        
        # 추천 문구
        if congestion_score < 1000:
            tip = "추천 경로입니다."
        elif congestion_score < 1300:
            tip = "이용 가능한 경로입니다."
        elif num_transfers >= 2 and max_congestion >= 35:
            tip = "혼잡 시간대에는 피하는 것이 좋습니다."
        else:
            tip = "혼잡할 수 있으니 여유있게 출발하세요."
        
        return f"{', '.join(description_parts)}. {tip}"
    
    async def generate_comfort_explanation(
        self,
        route_info: Dict[str, Any],
        congestion_data: Dict[str, Any],
        fastest_duration: int,
        comfort_duration: int
    ) -> str:
        """
        편안함 근거 설명 생성 (Azure OpenAI 사용)
        
        Args:
            route_info: 경로 정보 (segments, transfers 등)
            congestion_data: 혼잡도 데이터
            fastest_duration: 최단 경로 소요 시간 (초)
            comfort_duration: 시간부자 경로 소요 시간 (초)
        
        Returns:
            편안함 근거 설명
        """
        if not self.client:
            # API 키가 없으면 기본 설명 반환
            time_diff = (comfort_duration - fastest_duration) // 60
            return f"이 경로는 최단 경로 대비 {time_diff}분 추가 소요되지만, 혼잡도가 낮아 편안하게 이동할 수 있습니다."
        
        try:
            # 프롬프트 구성
            time_diff_minutes = (comfort_duration - fastest_duration) // 60
            avg_congestion = congestion_data.get("avg_congestion", 0.5)
            congestion_level = congestion_data.get("congestion_level", "보통")
            
            # 시간 차이 표현
            if time_diff_minutes == 0:
                time_comparison = "최단 경로와 동일한 시간이 소요됩니다"
            else:
                time_comparison = f"최단 경로 대비 {time_diff_minutes}분 추가 소요됩니다"
            
            # 경로 구간 정보 요약
            segments_summary = []
            for segment in route_info.get("segments", []):
                segments_summary.append({
                    "from": segment.get("from_station", {}).get("station_name", ""),
                    "to": segment.get("to_station", {}).get("station_name", ""),
                    "line": segment.get("line_number", ""),
                    "duration_minutes": segment.get("duration", 0) // 60,
                    "congestion": segment.get("congestion_level", "보통")
                })
            
            # 환승 정보
            transfers_count = len(route_info.get("transfers", []))
            
            prompt = f"""당신은 지하철 경로 추천 서비스의 설명 생성 AI입니다. 
사용자에게 시간부자 전용 경로의 편안함을 친근하고 구체적으로 설명해주세요.

**중요 지침**:
1. **"데이터가 없다", "정보가 부족하다"는 식의 표현은 절대 사용하지 말 것.**
2. 모든 정보는 확신 있는 어조로 전문성 있게 제공할 것.

경로 정보:
- 최단 경로 소요 시간: {fastest_duration // 60}분
- 시간부자 경로 소요 시간: {comfort_duration // 60}분
- 시간 비교: {time_comparison}
- 평균 혼잡도: {congestion_level} (점수: {avg_congestion:.2f})
- 경로 구간: {len(segments_summary)}개
- 환승 횟수: {transfers_count}회

요구사항:
1. 2-3문장으로 구성 (최대 150자)
2. 첫 문장: 이 경로의 주요 장점 (혼잡도, 편안함 등)
3. 둘째 문장: 시간 비교와 구체적인 이유
4. 셋째 문장(선택): 환승에 대한 정보가 있다면 꼭 포함할 것
5. 친근하고 자연스러운 톤

예시 스타일:
- "이번 열차는 여유롭네요! 동대문역사문화공원 환승은 1-1 칸을 이용하면 빠르게 갈아탈 수 있어요."
- "이 경로는 평균 혼잡도가 낮아 여유롭게 이동할 수 있습니다. {time_comparison}. 출퇴근 시간대에도 비교적 쾌적해요."
- "주요 구간의 혼잡도가 낮아 편안한 이동이 가능합니다. {time_comparison}. 앉아서 갈 확률도 높아요!"
- "쾌적한 경로예요! {time_comparison}. 환승도 여유롭게 할 수 있어 스트레스가 적습니다."

설명을 생성해주세요:"""

            # Azure OpenAI API 호출
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 지하철 경로 추천 서비스의 설명 생성 전문가입니다. 사용자에게 친근하고 구체적인 조언을 제공합니다."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,
                max_tokens=250
            )
            
            explanation = response.choices[0].message.content.strip()
            return explanation
        
        except Exception as e:
            # API 호출 실패 시 기본 설명 반환
            print(f"Azure OpenAI API 호출 실패: {str(e)}")
            time_diff = (comfort_duration - fastest_duration) // 60
            avg_congestion = congestion_data.get("avg_congestion", 0.5)
            
            # 시간 차이 표현
            if time_diff == 0:
                time_text = "최단 경로와 동일한 시간이 소요됩니다"
            else:
                time_text = f"최단 경로보다 {time_diff}분 정도 더 소요됩니다"
            
            if avg_congestion < 0.4:
                return f"이 경로는 평균 혼잡도가 낮아 여유롭게 이동할 수 있습니다. {time_text}."
            elif avg_congestion < 0.6:
                return f"이 경로는 주요 구간의 혼잡도가 낮아 상대적으로 편안하게 이동할 수 있습니다. {time_text}."
            else:
                return f"이 경로는 일부 구간에서 혼잡도를 피할 수 있습니다. {time_text}."
