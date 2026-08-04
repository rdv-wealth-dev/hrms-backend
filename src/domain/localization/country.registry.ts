import { CountryPlugin } from "./country-plugin.interface";
import { LRUCache } from "lru-cache";
import { AppError } from "../../shared/errors/app.error";

const registry = new Map<string, CountryPlugin>();

const moduleCache = new LRUCache<string, CountryPlugin>({
  max: 50, // only a handful of countries will ever exist
  ttl: 1000 * 60 * 60, // 1 hour
});

export class UnsupportedCountryError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = "UnsupportedCountryError";
  }
}

export class CountryRegistry {
  static register(plugin: CountryPlugin): void {
    const code = plugin.countryCode.toUpperCase();
    if (registry.has(code)) {
      throw new Error(`Country plugin "${code}" is already registered.`);
    }
    registry.set(code, plugin);
    moduleCache.set(code, plugin);
  }

  static resolve(countryCode: string): CountryPlugin {
    const code = (countryCode || "IN").toUpperCase();
    const cached = moduleCache.get(code);
    if (cached) return cached;

    const plugin = registry.get(code);
    if (!plugin) {
      throw new UnsupportedCountryError(
        `No country module registered for "${code}". Supported: ${[...registry.keys()].join(", ")}`
      );
    }

    moduleCache.set(code, plugin);
    return plugin;
  }

  static getSupportedCountries(): string[] {
    return Array.from(registry.keys());
  }

  // Exposed for legacy compatibility with getCountryModule resolver
  static getCountryModule(countryCode: string): CountryPlugin {
    return this.resolve(countryCode);
  }
}

// Re-export the compatibility wrapper function
export function getCountryModule(countryCode: string): CountryPlugin {
  return CountryRegistry.resolve(countryCode);
}
