import { RequestContext } from "../../core/interfaces/request-context.interface";

export class ProfessionalTaxService {
  async listConfigs(context: RequestContext, financialYear?: string): Promise<any[]> {
    return [];
  }

  async upsertConfig(context: RequestContext, body: any): Promise<any> {
    return null;
  }

  async deleteConfig(context: RequestContext, id: string): Promise<any> {
    return null;
  }
}

export class LWFConfigService {
  async listConfigs(context: RequestContext, financialYear?: string): Promise<any[]> {
    return [];
  }

  async upsertConfig(context: RequestContext, body: any): Promise<any> {
    return null;
  }
}

export class OvertimeConfigService {
  async getConfig(context: RequestContext): Promise<any> {
    return null;
  }

  async upsertConfig(context: RequestContext, body: any): Promise<any> {
    return null;
  }
}

export class TaxDeclarationService {
  async submitOrRevise(context: RequestContext, employeeId: string, body: any): Promise<any> {
    return null;
  }

  async getDeclaration(context: RequestContext, employeeId: string, financialYear: string): Promise<any> {
    return null;
  }

  async markProofSubmitted(context: RequestContext, employeeId: string, financialYear: string): Promise<any> {
    return null;
  }
}
