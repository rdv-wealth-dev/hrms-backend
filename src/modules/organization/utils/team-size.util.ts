/**
 * Parses any employeeCountRange / teamSize string into:
 * 1. normalizedRange: cleanly formatted string (e.g. "10-50", "51-200", "500+")
 * 2. maxEmployees: numerical user/employee limit cap for the tier
 */
export function parseEmployeeCountRange(range?: string): {
  normalizedRange: string;
  maxEmployees: number;
} {
  if (!range || !range.trim()) {
    return { normalizedRange: "1-10", maxEmployees: 10 };
  }

  const trimmed = range.trim();

  // Known standard ranges
  const directMap: Record<string, number> = {
    "1-10": 10,
    "10-50": 50,
    "11-50": 50,
    "50-100": 100,
    "51-200": 200,
    "100-250": 250,
    "201-500": 500,
    "500+": 1000,
    "1000+": 5000,
  };

  if (directMap[trimmed]) {
    return { normalizedRange: trimmed, maxEmployees: directMap[trimmed] };
  }

  // Range with dash, e.g. "20-80", "100-300"
  const matchRange = trimmed.match(/\d+\s*[-–]\s*(\d+)/);
  if (matchRange && matchRange[1]) {
    const upper = parseInt(matchRange[1], 10);
    if (!isNaN(upper) && upper > 0) {
      return { normalizedRange: trimmed, maxEmployees: upper };
    }
  }

  // Range with plus, e.g. "250+", "1000+"
  const matchPlus = trimmed.match(/(\d+)\s*\+/);
  if (matchPlus && matchPlus[1]) {
    const num = parseInt(matchPlus[1], 10);
    if (!isNaN(num) && num > 0) {
      return { normalizedRange: trimmed, maxEmployees: Math.max(num * 2, 1000) };
    }
  }

  // Single number, e.g. "75"
  const singleNum = parseInt(trimmed, 10);
  if (!isNaN(singleNum) && singleNum > 0) {
    return { normalizedRange: trimmed, maxEmployees: singleNum };
  }

  return { normalizedRange: trimmed, maxEmployees: 50 };
}
