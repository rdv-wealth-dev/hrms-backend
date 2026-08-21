import { BaseRepository } from "../../../shared/database/base.repository";
import {
  BankPayoutConfigDocument,
  BankPayoutConfigModel,
} from "../models/bank-payout-config.model";

export class BankPayoutConfigRepository extends BaseRepository<BankPayoutConfigDocument> {
  constructor() {
    super(BankPayoutConfigModel);
  }

  async findByBankCode(
    tenantId: string,
    bankCode: string,
    branchId?: string
  ): Promise<BankPayoutConfigDocument | null> {
    const filter: any = { tenantId, bankCode: bankCode.toUpperCase(), isActive: true };
    if (branchId) {
      filter.branchId = branchId;
    }
    const config = await this.model.findOne(filter);
    if (!config && branchId) {
      return this.model.findOne({ tenantId, bankCode: bankCode.toUpperCase(), branchId: null, isActive: true });
    }
    return config;
  }
}
