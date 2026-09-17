"""
Cache service — abstract interface with InMemory (MVP) and Redis (future) implementations.
"""
from abc import ABC, abstractmethod
import time
from app.config import get_settings


class CacheService(ABC):
    @abstractmethod
    async def get(self, key: str) -> str | None: ...

    @abstractmethod
    async def set(self, key: str, value: str, ttl: int | None = None) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    async def clear_pattern(self, pattern: str) -> None: ...


class InMemoryCache(CacheService):
    def __init__(self):
        self._store: dict[str, tuple[str, float]] = {}

    async def get(self, key: str) -> str | None:
        entry = self._store.get(key)
        if not entry:
            return None
        value, expires = entry
        if expires and time.time() > expires:
            del self._store[key]
            return None
        return value

    async def set(self, key: str, value: str, ttl: int | None = None) -> None:
        settings = get_settings()
        ttl = ttl or settings.CACHE_DEFAULT_TTL
        expires = time.time() + ttl if ttl > 0 else 0
        self._store[key] = (value, expires)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def clear_pattern(self, pattern: str) -> None:
        prefix = pattern.rstrip("*")
        to_del = [k for k in self._store if k.startswith(prefix)]
        for k in to_del:
            del self._store[k]


# Future Redis implementation:
# class RedisCache(CacheService):
#     def __init__(self, redis_url: str):
#         import redis.asyncio as aioredis
#         self._redis = aioredis.from_url(redis_url)
#     async def get(self, key): return await self._redis.get(key)
#     async def set(self, key, value, ttl=300): await self._redis.setex(key, ttl, value)
#     async def delete(self, key): await self._redis.delete(key)
#     async def clear_pattern(self, pattern): ...


_cache_instance: CacheService | None = None


def get_cache() -> CacheService:
    global _cache_instance
    if _cache_instance is None:
        settings = get_settings()
        if settings.CACHE_BACKEND == "redis":
            raise NotImplementedError("Redis cache — uncomment RedisCache and install redis package")
        _cache_instance = InMemoryCache()
    return _cache_instance
