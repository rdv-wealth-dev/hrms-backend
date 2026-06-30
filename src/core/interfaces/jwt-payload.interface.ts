export interface JwtPayload {
  tenantId: string;
  userId: string;
  role: string;
  branchIds: string[];
  jti: string; // Unique token ID, used for replay attack prevention.
  iat?: number; // Issued at, auto added by jwt.sign().
  exp?: number; // Expiry, auto added by jwt.sign().
}
