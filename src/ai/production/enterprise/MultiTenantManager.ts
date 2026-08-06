export interface TenantPolicy {
  tenantId: string;
  organizationName: string;
  customBranding: string;
  dedicatedProvider?: string;
  enabledSubjects: string[];
}

export class MultiTenantManager {
  private static instance: MultiTenantManager;
  private tenants: Map<string, TenantPolicy> = new Map();

  public static getInstance(): MultiTenantManager {
    if (!MultiTenantManager.instance) {
      MultiTenantManager.instance = new MultiTenantManager();
    }
    return MultiTenantManager.instance;
  }

  public registerTenant(policy: TenantPolicy): void {
    this.tenants.set(policy.tenantId, policy);
  }

  public getTenantPolicy(tenantId: string): TenantPolicy | undefined {
    return this.tenants.get(tenantId);
  }
}
