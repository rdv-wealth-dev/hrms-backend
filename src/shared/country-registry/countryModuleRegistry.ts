import { CountryModule } from "./countryModule.interface";
import { IndiaModule } from "../../country-modules/IN";
import { LRUCache } from "lru-cache";

const registry = new Map<string, CountryModule>();
registry.set("IN", IndiaModule);

const moduleCache = new LRUCache<string, CountryModule>({
  max: 50,              // only a handful of countries will ever exist
  ttl: 1000 * 60 * 60,  // 1 hour
});

// Seed India module into cache
moduleCache.set("IN", IndiaModule);

export function getCountryModule(countryCode: string): CountryModule {
  const code = (countryCode || "IN").toUpperCase();
  const cached = moduleCache.get(code);
  if (cached) return cached;

  const module = registry.get(code);
  if (!module) {
    // Fallback to IN to ensure backwards compatibility
    const defaultModule = registry.get("IN")!;
    moduleCache.set(code, defaultModule);
    return defaultModule;
  }

  moduleCache.set(code, module);
  return module;
}
