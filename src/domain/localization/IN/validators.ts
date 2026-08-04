export function validatePAN(pan: string): boolean {
  const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return regex.test(pan);
}

export function validateAadhaar(aadhaar: string): boolean {
  const regex = /^\d{12}$/;
  return regex.test(aadhaar);
}

export function maskPAN(pan: string): string {
  if (!pan || pan.length < 4) return pan;
  return pan.substring(0, 4) + "****" + pan.substring(pan.length - 1);
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return aadhaar;
  return "****" + aadhaar.substring(aadhaar.length - 4);
}
