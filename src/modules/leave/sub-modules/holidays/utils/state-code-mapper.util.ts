import { STATE_CODE_DICTIONARY } from "../config/state-mapper.config";


//  Normalizes state inputs into standard 2-letter state codes.
// e.g., "Tamil Nadu", "TamilNadu", "TN" -> "TN"

export const normalizeStateCode = (
  stateInput?: string | null,
  countryCode: string = "IN"
): string | null => {
  if (!stateInput) return null;

  const countryKey = countryCode.toUpperCase();
  const cleanedInput = stateInput.trim().toUpperCase();

  // If country isn't in dictionary, return sanitized input as fallback
  const mappings = STATE_CODE_DICTIONARY[countryKey];
  if (!mappings) {
    return cleanedInput;
  }

  // 1. Direct Lookup
  if (mappings[cleanedInput]) {
    return mappings[cleanedInput];
  }

  // 2. Whitespace-stripped Lookup (e.g., "TAMILNADU" -> "TN")
  const strippedInput = cleanedInput.replace(/\s+/g, "");
  if (mappings[strippedInput]) {
    return mappings[strippedInput];
  }

  // Fallback to original input if unmapped
  return cleanedInput;
};
