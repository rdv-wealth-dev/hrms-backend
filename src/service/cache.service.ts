import { LRUCache } from "lru-cache";

// Initialize a metadata cache for rarely changing resources
// (Holiday lists, Company Policies, Branch lists, etc.)
// Capped at 1,000 unique org/branch keys to keep RAM predictable.
const lookupCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 30 * 60 * 1000, // Cache results for 30 minutes
  ttlAutopurge: true,
});


// Executes a database or heavy query only if the result is not already cached.
// Otherwise, resolves instantly with the cached copy.
 
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  customTtlMs?: number
): Promise<T> {
  if (lookupCache.has(key)) {
    return lookupCache.get(key) as T;
  }

  const result = await fetchFn();

  if (result !== undefined && result !== null) {
    if (customTtlMs) {
      lookupCache.set(key, result, { ttl: customTtlMs });
    } else {
      lookupCache.set(key, result);
    }
  }

  return result;
}


// Invalidates a specific key in the lookup cache (e.g. when holidays or policies are updated).

export function invalidateCacheKey(key: string): void {
  lookupCache.delete(key);
}

//Clears the entire lookup cache.

export function clearLookupCache(): void {
  lookupCache.clear();
}
