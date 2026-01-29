"""
Rate Limiter for API calls (비동기 충돌 방지 수정 버전)
"""
import asyncio
from collections import deque
from datetime import datetime, timedelta
from typing import Optional


class RateLimiter:
    """
    다중 시간 윈도우 기반 Rate Limiter
    """
    
    def __init__(
        self,
        per_second: int = 2,
        per_minute: int = 30,
        per_5minutes: int = 100
    ):
        self.per_second = per_second
        self.per_minute = per_minute
        self.per_5minutes = per_5minutes
        
        self._second_window = deque()
        self._minute_window = deque()
        self._5minute_window = deque()
        
        # [수정] 여기서 Lock을 미리 만들지 않습니다. (비동기 루프 문제 방지)
        self._lock = None
    
    @property
    def lock(self):
        """Lock을 필요할 때 생성 (Lazy Init)"""
        if self._lock is None:
            # 현재 실행 중인 루프가 있으면 거기서 Lock 생성
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            self._lock = asyncio.Lock()
        return self._lock

    async def acquire(self) -> bool:
        """Rate limit 체크 및 허용"""
        # [수정] self._lock 대신 self.lock 프로퍼티 사용
        async with self.lock:
            now = datetime.now()
            
            self._cleanup_old_timestamps(now)
            
            if len(self._second_window) >= self.per_second:
                print(f"[RateLimiter] 초당 제한 초과: {len(self._second_window)}/{self.per_second}")
                return False
            
            if len(self._minute_window) >= self.per_minute:
                print(f"[RateLimiter] 분당 제한 초과: {len(self._minute_window)}/{self.per_minute}")
                return False
            
            if len(self._5minute_window) >= self.per_5minutes:
                print(f"[RateLimiter] 5분당 제한 초과: {len(self._5minute_window)}/{self.per_5minutes}")
                return False
            
            self._second_window.append(now)
            self._minute_window.append(now)
            self._5minute_window.append(now)
            
            return True
    
    async def wait_if_needed(self):
        """Rate limit에 도달하면 대기"""
        while not await self.acquire():
            wait_time = self._calculate_wait_time()
            if wait_time > 0:
                print(f"[RateLimiter] 대기 중... {wait_time:.2f}초")
                await asyncio.sleep(wait_time)
            else:
                await asyncio.sleep(0.1)
    
    def _cleanup_old_timestamps(self, now: datetime):
        """오래된 타임스탬프 제거"""
        while self._second_window and (now - self._second_window[0]).total_seconds() >= 1.0:
            self._second_window.popleft()
        
        while self._minute_window and (now - self._minute_window[0]).total_seconds() >= 60.0:
            self._minute_window.popleft()
        
        while self._5minute_window and (now - self._5minute_window[0]).total_seconds() >= 300.0:
            self._5minute_window.popleft()
    
    def _calculate_wait_time(self) -> float:
        """대기 시간 계산"""
        now = datetime.now()
        wait_times = []
        
        if len(self._second_window) >= self.per_second:
            oldest = self._second_window[0]
            elapsed = (now - oldest).total_seconds()
            wait_times.append(1.0 - elapsed)
        
        if len(self._minute_window) >= self.per_minute:
            oldest = self._minute_window[0]
            elapsed = (now - oldest).total_seconds()
            wait_times.append(60.0 - elapsed)
        
        if len(self._5minute_window) >= self.per_5minutes:
            oldest = self._5minute_window[0]
            elapsed = (now - oldest).total_seconds()
            wait_times.append(300.0 - elapsed)
        
        return max(wait_times) if wait_times else 0.0