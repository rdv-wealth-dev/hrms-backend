import { BaseRepository } from "../../repositories/base.repository";
import { UserDocument, UserModel } from "./user.model";
import { FilterQuery } from "mongoose";

export class UserRepository extends BaseRepository<UserDocument> {
  constructor() {
    super(UserModel);
  }

  // Find by email — used for login 
  // Uses findOneGlobal — no tenant context exists yet at login time
  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel
      .findOne({ email: email.toLowerCase(), isDeleted: false })
      .select("+passwordHash")  // explicitly include passwordHash for comparison
      .lean() as Promise<UserDocument | null>;
  }

  // Find by email within tenant
  // Used during registration to check duplicate email
  async findByEmailAndTenant(
    email:    string,
    tenantId: string
  ): Promise<UserDocument | null> {
    return UserModel
      .findOne({
        email:     email.toLowerCase(),
        tenantId,
        isDeleted: false,
      })
      .lean() as Promise<UserDocument | null>;
  }

  // Update last login timestamp 
  async updateLastLogin(userId: string): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      { lastLoginAt: new Date() }
    );
  }
}