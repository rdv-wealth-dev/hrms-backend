// GEOCODING SERVICE
// Converts a postal address → { lat, lng } using OpenStreetMap Nominatim (free).
// Uses structured query parameters (street, city, state, postalcode, country) with format: "jsonv2".
// Falls back to null gracefully — never throws, never blocks branch creation.

interface AddressInput {
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  countryCode?: string;
  zip?: string;
}

interface GeoCoords {
  lat: number;
  lng: number;
}

export class GeocodingService {

  // Geocode an address to lat/lng using Nominatim (OpenStreetMap)
  // Returns null if geocoding fails or address is not found
  async geocode(address: AddressInput): Promise<GeoCoords | null> {
    // 1. Combine fine-grained details into the street parameter
    const streetParts = [
      address.addressLine1,
      address.addressLine2,
      address.landmark,
    ].filter(Boolean).join(", ");

    // 2. Build structured parameters instead of a generic 'q' string
    const params: Record<string, string> = {
      format: "jsonv2", // jsonv2 is newer and more precise than json
      limit: "1",
      addressdetails: "0",
    };

    if (streetParts) params.street = streetParts;
    if (address.city) params.city = address.city;
    if (address.state) params.state = address.state;
    if (address.zip) params.postalcode = address.zip;
    if (address.countryCode) params.country = address.countryCode;

    // Safety check: Ensure we have at least some data to look up
    if (!streetParts && !address.city && !address.zip) {
      return null;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams(params).toString();

      const response = await fetch(url, {
        headers: {
          "User-Agent": "HRMS-App/1.0 (hrms@redvisiontech.com)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5s timeout — don't hang the request
      });

      if (!response.ok) {
        console.warn(`[GeocodingService] Nominatim returned HTTP ${response.status}`);
        return null;
      }

      const results = await response.json() as Array<{ lat: string; lon: string }>;

      if (!results || results.length === 0) {
        // Fallback: If structured query was too restrictive, try a broad query with city, state, country
        if (address.city || address.zip) {
          return this.fallbackGeocode(address);
        }
        console.warn(`[GeocodingService] No results found for structured query`);
        return null;
      }

      const { lat, lon } = results[0];
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lon),
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[GeocodingService] Geocoding failed: ${message}`);
      return null;
    }
  }

  // Broad fallback geocoding (e.g. city + state + zip) if exact street lookup returns 0 results
  private async fallbackGeocode(address: AddressInput): Promise<GeoCoords | null> {
    try {
      const broadParams: Record<string, string> = {
        format: "jsonv2",
        limit: "1",
        addressdetails: "0",
      };

      if (address.city) broadParams.city = address.city;
      if (address.state) broadParams.state = address.state;
      if (address.zip) broadParams.postalcode = address.zip;
      if (address.countryCode) broadParams.country = address.countryCode;

      const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams(broadParams).toString();

      const response = await fetch(url, {
        headers: {
          "User-Agent": "HRMS-App/1.0 (hrms@redvisiontech.com)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) return null;

      const results = await response.json() as Array<{ lat: string; lon: string }>;
      if (!results || results.length === 0) return null;

      const { lat, lon } = results[0];
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lon),
      };
    } catch {
      return null;
    }
  }
}

export const geocodingService = new GeocodingService();
