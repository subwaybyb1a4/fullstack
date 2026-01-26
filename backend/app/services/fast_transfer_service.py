"""
빠른 환승 서비스
"""
import pandas as pd
from pathlib import Path
from typing import Optional

class FastTransferService:
    """빠른 환승 정보 서비스"""
    
    def __init__(self):
        self.df = self.load_data()
        
    def load_data(self) -> Optional[pd.DataFrame]:
        """CSV 데이터 로드"""
        try:
            # backend/app/services/../../app/data/line_transfer.csv
            csv_path = Path(__file__).parent.parent / "data" / "line_transfer.csv"
            
            if not csv_path.exists():
                print(f"[FastTransfer] 파일이 없습니다: {csv_path}")
                return None
                
            # Encoding is cp949 as seen in verification
            df = pd.read_csv(csv_path, encoding="cp949", dtype=str)
            
            # Clean column names (strip whitespace)
            df.columns = [c.strip() for c in df.columns]
            
            # Pre-process data for faster lookup
            # Create a 'key' column? Or just clean columns.
            # Columns: '지하철역ID', '환승전호선', '환승전열차방면', '환승역', '환승후호선', ...
            
            # Normalize '환승역' (remove '역')
            if "환승역" in df.columns:
                df["환승역_norm"] = df["환승역"].apply(lambda x: str(x).replace("역", "").strip())
                
            print(f"[FastTransfer] 데이터 로드 성공: {len(df)}건")
            return df
        except Exception as e:
            print(f"[FastTransfer] 로드 실패: {e}")
            return None

    def get_fast_transfer(self, station_name: str, station_id: str, from_line: str, to_line: str) -> Optional[str]:
        """
        빠른 환승 위치 조회 (형식: "5-1")
        Args:
            station_name: 환승역 이름 (예: "사당")
            station_id: 역 ID (ODSay ID, but CSV has its own ID)
            from_line: 출발 라인 (예: "4호선" or "4")
            to_line: 도착 라인 (예: "2호선" or "2")
        """
        if self.df is None:
            return None
        
        try:
            # Normalize inputs
            s_name = station_name.replace("역", "").strip()
            
            # Helper to normalize line names for loose matching
            # User CSV might have "4", "4호선". Input might be "4", "4호선".
            def norm_line(l):
                return str(l).replace("호선", "").replace("수도권", "").strip()
            
            f_line_norm = norm_line(from_line)
            t_line_norm = norm_line(to_line)
            
            # Filter
            # Match '환승역_norm' first
            # The CSV likely has duplicate rows for different transfers at same station.
            
            matched = self.df[self.df["환승역_norm"] == s_name]
            
            if matched.empty:
                return None
                
            # Filter by lines
            # Check '환승전호선' and '환승후호선'
            # Note: CSV values might need normalization too.
            
            def check_row(row):
                r_f_line = norm_line(row.get("환승전호선", ""))
                r_t_line = norm_line(row.get("환승후호선", ""))
                
                # Check match
                return (r_f_line == f_line_norm) and (r_t_line == t_line_norm)

            candidates = matched[matched.apply(check_row, axis=1)]
            
            if not candidates.empty:
                best = candidates.iloc[0]
                car = best.get("차량번호", "")
                door = best.get("출입문위치", "")
                
                if car and door:
                    return f"{car}-{door}"
            
            return None
            
        except Exception as e:
            print(f"[FastTransfer] 조회 에러: {e}")
            return None
