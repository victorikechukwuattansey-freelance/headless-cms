/**
 * Catalog serviceId → VTPass serviceID. 11 of 23 catalog services map
 * to VTPass. Unmapped services throw VtpassUnsupportedServiceError at
 * the adapter layer (T2). Product-variation codes (for data plans,
 * etc.) are resolved dynamically via /service-variations; not in this
 * map. See docs/vtpass-scoping.md §7.3 and §7.4.
 */
export const VTPASS_SERVICE_ID_MAP: Readonly<Record<string, string>> = {
  svc_airtime_mtn: "mtn",
  svc_airtime_airtel: "airtel",
  svc_data_mtn: "mtn-data",
  svc_data_airtel: "airtel-data",
  svc_electricity_aedc: "abuja-electric",
  svc_electricity_ikedc: "ikeja-electric",
  svc_cable_dstv: "dstv",
  svc_cable_gotv: "gotv",
  svc_internet_spectranet: "spectranet",
  svc_education_jamb: "jamb",
  svc_education_waec: "waec",
};

export function resolveVtpassServiceId(
  catalogServiceId: string,
): string | null {
  return VTPASS_SERVICE_ID_MAP[catalogServiceId] ?? null;
}

/**
 * Maps catalog plan names to VTPass variation codes.
 * The catalog uses human-readable plans (1GB, 2GB), while VTPass
 * requires specific SKUs (mtn-10mb-100, mtn-100mb-1000).
 */
export const VTPASS_VARIATION_MAP: Readonly<Record<string, string>> = {
  "svc_data_mtn:1GB": "mtn-10mb-100",
  "svc_data_mtn:2GB": "mtn-100mb-1000",
  "svc_data_mtn:5GB": "mtn-3gb-1500",
  "svc_data_mtn:10GB": "mtn-3gb-2500",
};

export function resolveVtpassVariationCode(
  serviceId: string,
  catalogPlan: string,
): string {
  return VTPASS_VARIATION_MAP[`${serviceId}:${catalogPlan}`] ?? catalogPlan;
}
