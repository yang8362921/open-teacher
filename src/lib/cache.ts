/**
 * 轻量级 LRU 内存缓存
 * - 支持 TTL 自动过期
 * - 支持 stale-while-revalidate（返回旧数据同时后台刷新）
 * - 进程级缓存，不跨实例，适合单实例部署
 */

interface CacheEntry<T> {
  value: T;
  expire: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  /** 获取缓存值，未命中或已过期返回 undefined */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expire) {
      this.cache.delete(key);
      return undefined;
    }
    // LRU：移到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  /** 写入缓存，ttl 单位毫秒 */
  set<T>(key: string, value: T, ttl: number): void {
    // 容量限制：淘汰最久未用
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expire: Date.now() + ttl });
  }

  /** 删除缓存（主动失效） */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /** 按前缀批量删除（用于模式失效） */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /** 清空所有缓存 */
  clear(): void {
    this.cache.clear();
  }

  /** 当前缓存条目数 */
  get size(): number {
    return this.cache.size;
  }
}

/** 全局单例缓存实例 */
export const appCache = new LRUCache(300);

/**
 * 带缓存的异步获取（Cache-Aside 模式）
 * - 命中且未过期：直接返回，零延迟
 * - 未命中：执行 factory，写入缓存后返回
 *
 * @param key 缓存键
 * @param ttl 缓存时间（毫秒）
 * @param factory 缓存未命中时的数据获取函数
 */
export async function cached<T>(
  key: string,
  ttl: number,
  factory: () => Promise<T>
): Promise<T> {
  const hit = appCache.get<T>(key);
  if (hit !== undefined) return hit;

  const value = await factory();
  appCache.set(key, value, ttl);
  return value;
}

/**
 * Stale-While-Revalidate 模式
 * - 有旧数据（即使过期）立即返回，同时后台刷新
 * - 无任何数据时等待 factory 完成
 * 适合：记忆检索、教师档案等可容忍短暂过期的场景
 */
export async function cachedSWR<T>(
  key: string,
  ttl: number,
  factory: () => Promise<T>
): Promise<T> {
  const entry = (appCache as unknown as { cache: Map<string, CacheEntry<T>> }).cache.get(key);

  if (entry) {
    const now = Date.now();
    if (now <= entry.expire) {
      // 未过期，直接返回
      return entry.value;
    }
    // 已过期但有旧数据：先返回旧值，后台刷新
    const staleValue = entry.value;
    factory().then((fresh) => {
      appCache.set(key, fresh, ttl);
    }).catch(() => { /* 后台刷新失败不影响旧数据 */ });
    return staleValue;
  }

  // 无任何数据：等待 factory
  const value = await factory();
  appCache.set(key, value, ttl);
  return value;
}

/** 缓存键生成工具 */
export const CacheKeys = {
  teacher: (id: string) => `teacher:${id}`,
  teacherList: () => 'teacher:list',
  knowledgeSearch: (table: string, query: string) => `kb:${table}:${hashStr(query)}`,
  memoryRecall: (studentId: string, teacherId: string) => `memory:${studentId}:${teacherId}`,
  tts: (text: string, speaker: string, rate: number) => `tts:${speaker}:${rate}:${hashStr(text)}`,
};

/** 简单哈希（用于生成短缓存键，非安全用途） */
function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
