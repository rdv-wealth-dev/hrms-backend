// GEOCODING SERVICE
// Converts a postal address → { lat, lng } using OpenStreetMap Nominatim (free).
// No API key required. Nominatim usage policy: max 1 request/second, must set User-Agent.
// Falls back to null gracefully — never throws, never blocks branch creation.

interface AddressInput {
  addressLine1?: string;
  addressLine2?: string;
  landmark?:     string;
  city?:         string;
  state?:        string;
  countryCode?:  string;
  zip?:          string;
}

interface GeoCoords {
  lat: number;
  lng: number;
}

export class GeocodingService {

  // Build a human-readable query string from address parts
  private buildQuery(address: AddressInput): string | null {
    const parts = [
      address.addressLine1,
      address.landmark,
      address.city,
      address.state,
      address.zip,
      address.countryCode,
    ].filter(Boolean);

    if (parts.length === 0) return null;
    return parts.join(", ");
  }

  // Geocode an address to lat/lng using Nominatim (OpenStreetMap)
  // Returns null if geocoding fails or address is not found
  async geocode(address: AddressInput): Promise<GeoCoords | null> {
    const query = this.buildQuery(address);

    if (!query) {
      return null;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q:              query,
          format:         "json",
          limit:          "1",
          addressdetails: "0",
        }).toString();

      const response = await fetch(url, {
        headers: {
          // Nominatim requires a User-Agent identifying your app
          "User-Agent": "HRMS-App/1.0 (hrms@redvisiontech.com)",
          "Accept":     "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5s timeout — don't hang the request
      });

      if (!response.ok) {
        console.warn(`[GeocodingService] Nominatim returned HTTP ${response.status} for query: "${query}"`);
        return null;
      }

      const results = await response.json() as Array<{ lat: string; lon: string }>;

      if (!results || results.length === 0) {
        console.warn(`[GeocodingService] No results found for: "${query}"`);
        return null;
      }

      const { lat, lon } = results[0];
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lon),
      };

    } catch (err: unknown) {
      // Log but never throw — geocoding failure must never block branch creation
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[GeocodingService] Geocoding failed for "${query}": ${message}`);
      return null;
    }
  }
}

export const geocodingService = new GeocodingService();
