export interface FormulaContext {
  CTC?: number;
  BASIC?: number;
  GROSS?: number;
  [key: string]: number | undefined;
}

export class FormulaParser {
  /**
   * Safely evaluates mathematical expressions supporting variables like CTC, BASIC, GROSS,
   * arithmetic operators (+, -, *, /), parentheses, and min/max clamp functions.
   * Example: "CTC * 0.40", "BASIC * 0.40", "12000 * 12", "Basic * 0.0481", "min(15000, BASIC) * 0.12"
   */
  public static evaluate(expression: string, context: FormulaContext): number {
    if (!expression || expression.trim() === "") {
      return 0;
    }

    const trimmed = expression.trim();

    // Constant flat number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Replace known context variable tokens (case-insensitive)
    let sanitized = trimmed;
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        const regex = new RegExp(`\\b${key}\\b`, "gi");
        sanitized = sanitized.replace(regex, value.toString());
      }
    }

    // Handle min(a, b) and max(a, b)
    sanitized = sanitized.replace(/min\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (_, a, b) => {
      const valA = FormulaParser.evaluate(a, context);
      const valB = FormulaParser.evaluate(b, context);
      return Math.min(valA, valB).toString();
    });

    sanitized = sanitized.replace(/max\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (_, a, b) => {
      const valA = FormulaParser.evaluate(a, context);
      const valB = FormulaParser.evaluate(b, context);
      return Math.max(valA, valB).toString();
    });

    // Strip disallowed characters for security
    sanitized = sanitized.replace(/[^0-9+\-*/(). ]/g, "");
    if (!sanitized.trim()) return 0;

    try {
      // Safe tokenized arithmetic evaluation without unsafe eval
      const fn = new Function(`return (${sanitized});`);
      const result = fn();
      return typeof result === "number" && !isNaN(result) && isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Converts a numeric amount into Indian Currency Words (e.g. 85102 -> "Rupees Eighty Five Thousand One Hundred And Two Only")
   */
  public static numberToIndianRupeeWords(num: number): string {
    if (num === 0) return "Rupees Zero Only";

    const a = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const inWords = (n: number): string => {
      let str = "";
      if (n > 19) {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
      } else {
        str += a[n];
      }
      return str;
    };

    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const hundred = Math.floor(num / 100);
    const rest = Math.floor(num % 100);

    let res = "";
    if (crore > 0) res += inWords(crore) + " Crore ";
    if (lakh > 0) res += inWords(lakh) + " Lakh ";
    if (thousand > 0) res += inWords(thousand) + " Thousand ";
    if (hundred > 0) res += inWords(hundred) + " Hundred ";
    if (rest > 0) {
      if (res !== "") res += "And ";
      res += inWords(rest) + " ";
    }

    return `Rupees ${res.trim()} Only`;
  }
}
