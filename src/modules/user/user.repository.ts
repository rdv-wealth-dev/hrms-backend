import { BaseRepository } from "../../repositories/base.repository";
import { UserDocument, UserModel } from "./user.model";

export class UserRepository extends BaseRepository<UserDocument> {
  constructor() {
    super(UserModel);
  }

  // Find by email — used for login 
  // Uses findOneGlobal — no tenant context exists yet at login time
  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel
      .findOne({ email: email.toLowerCase(), isDeleted: false })
      .sort({ isActive: -1 })  // prefer active accounts if same email exists in multiple tenants
      .select("+passwordHash")  // explicitly include passwordHash for comparison
      .lean() as Promise<UserDocument | null>;
  }

  // Find by email within tenant
  // Used during registration to check duplicate email
  async findByEmailAndTenant(
    email: string,
    tenantId: string
  ): Promise<UserDocument | null> {
    return UserModel
      .findOne({
        email: email.toLowerCase(),
        tenantId,
        isDeleted: false,
      })
      .lean() as Promise<UserDocument | null>;
  }

  // Update last login — now records IP + device info
  async updateLastLogin(
    userId: string,
    ip?: string,
    device?: string
  ): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? "unknown",
        lastLoginDevice: device ?? "unknown",
        loginAttempts: 0,        // reset on successful login
        lockoutUntil: undefined,
      }
    );
  }

  // Increment failed login attempts — called on wrong password
  // Returns current attempt count after increment
  async incrementLoginAttempts(userId: string): Promise<number> {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

    const user = await UserModel
      .findByIdAndUpdate(
        userId,
        { $inc: { loginAttempts: 1 } },
        { new: true, select: "+loginAttempts +lockoutUntil" }
      )
      .lean();

    if (!user) return 0;

    const attempts = (user as any).loginAttempts ?? 1;

    // Lock account after MAX_ATTEMPTS failures
    if (attempts >= MAX_ATTEMPTS) {
      await UserModel.updateOne(
        { _id: userId },
        { lockoutUntil: new Date(Date.now() + LOCKOUT_MS) }
      );
    }

    return attempts;
  }

  // Check if account is locked out — called before password compare
  async isLockedOut(userId: string): Promise<{ locked: boolean; remainingSecs: number }> {
    const user = await UserModel
      .findById(userId)
      .select("+lockoutUntil")
      .lean();

    if (!user) return { locked: false, remainingSecs: 0 };

    const lockout = (user as any).lockoutUntil as Date | undefined;
    if (!lockout) return { locked: false, remainingSecs: 0 };

    const remainingMs = lockout.getTime() - Date.now();
    if (remainingMs <= 0) {
      // Lockout expired — clear it
      await UserModel.updateOne(
        { _id: userId },
        { $unset: { lockoutUntil: 1 }, loginAttempts: 0 }
      );
      return { locked: false, remainingSecs: 0 };
    }

    return {
      locked: true,
      remainingSecs: Math.ceil(remainingMs / 1000),
    };
  }

  // Save a remember-device token hash
  async addRememberDeviceToken(
    userId: string,
    tokenHash: string,
    deviceInfo: string
  ): Promise<void> {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    // Remove expired tokens first, then push new one
    await UserModel.updateOne(
      { _id: userId },
      {
        $pull: { rememberDeviceTokens: { expiresAt: { $lt: new Date() } } },
      }
    );
    await UserModel.updateOne(
      { _id: userId },
      {
        $push: {
          rememberDeviceTokens: {
            tokenHash,
            deviceInfo,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + THIRTY_DAYS),
          },
        },
      }
    );
  }

  // Validate a remember-device token
  async validateRememberDeviceToken(
    userId: string,
    tokenHash: string
  ): Promise<boolean> {
    const user = await UserModel
      .findOne({
        _id: userId,
        "rememberDeviceTokens.tokenHash": tokenHash,
        "rememberDeviceTokens.expiresAt": { $gt: new Date() },
      })
      .select("_id")
      .lean();

    return user !== null;
  }
}