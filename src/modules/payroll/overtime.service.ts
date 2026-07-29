import { RequestContext } from "../../core/interfaces/request-context.interface";

export class OvertimeService {
  async listPending(context: RequestContext, year: number, month: number): Promise<any[]> {
    return [];
  }

  async listForEmployee(context: RequestContext, employeeId: string, year: number, month: number): Promise<any[]> {
    return [];
  }

  async approve(context: RequestContext, id: string): Promise<any> {
    return null;
  }

  async reject(context: RequestContext, id: string, reason: string): Promise<any> {
    return null;
  }
}
