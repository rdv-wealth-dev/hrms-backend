import { RequestContext } from "../../../core/interfaces/request-context.interface";

export class AttendanceLockService {
  async lockPeriod(context: RequestContext, year: number, month: number): Promise<any> {
    return null;
  }

  async unlockPeriod(context: RequestContext, year: number, month: number, reason: string): Promise<any> {
    return null;
  }

  async getLockStatus(context: RequestContext, year: number, month: number): Promise<any> {
    return null;
  }

  async listYearLocks(context: RequestContext, year: number): Promise<any> {
    return [];
  }
}
