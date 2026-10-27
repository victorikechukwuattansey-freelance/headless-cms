import type { MarketplaceServiceKind } from "../marketplace/types.ts";
import type {
  ProviderAdapter,
  ProviderRequestContext,
  ProviderResult,
} from "../marketplace/providers/contracts.ts";
import type { VtpassClient } from "./client.ts";
import { VtpassUnsupportedServiceError } from "./errors.ts";
import { resolveVtpassServiceId } from "./service-map.ts";
import { mapVtpassResponseToProviderResult } from "./response-mapper.ts";

export interface VtpassServiceStrategy<Request> {
  readonly kind: MarketplaceServiceKind;
  extractBillersCode(request: Request): string;
  extractVariationCode?(request: Request): string | undefined;
  extractPhone?(request: Request): string | undefined;
}

export class VtpassServiceAdapter<
  Request extends { readonly amountMinor: number; readonly currency: string },
> implements ProviderAdapter<Request> {
  readonly id: string;
  readonly providerId = "vtpass";
  readonly providerName = "VTPass";
  readonly mode = "REAL" as const;
  readonly serviceKinds: readonly MarketplaceServiceKind[];

  private readonly client: VtpassClient;
  private readonly strategy: VtpassServiceStrategy<Request>;

  constructor(client: VtpassClient, strategy: VtpassServiceStrategy<Request>) {
    this.client = client;
    this.strategy = strategy;
    this.id = `vtpass_${strategy.kind.toLowerCase()}_adapter`;
    this.serviceKinds = [strategy.kind];
  }

  async execute(
    context: ProviderRequestContext,
    request: Request,
  ): Promise<ProviderResult> {
    const serviceID = resolveVtpassServiceId(context.serviceId);
    if (serviceID === null) {
      throw new VtpassUnsupportedServiceError(
        this.strategy.kind,
        context.serviceId,
      );
    }
    const response = await this.client.pay({
      request_id: context.requestId,
      serviceID,
      billersCode: this.strategy.extractBillersCode(request),
      variation_code: this.strategy.extractVariationCode?.(request),
      amount: request.amountMinor / 100,
      phone: this.strategy.extractPhone?.(request),
    });
    return mapVtpassResponseToProviderResult(
      response,
      context,
      this.strategy.kind,
    );
  }

  async queryStatus(context: ProviderRequestContext): Promise<ProviderResult> {
    const serviceID = resolveVtpassServiceId(context.serviceId);
    if (serviceID === null) {
      throw new VtpassUnsupportedServiceError(
        this.strategy.kind,
        context.serviceId,
      );
    }
    const response = await this.client.requery({
      request_id: context.requestId,
    });
    return mapVtpassResponseToProviderResult(
      response,
      context,
      this.strategy.kind,
    );
  }
}
