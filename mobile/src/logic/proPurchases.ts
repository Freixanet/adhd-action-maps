/**
 * RevenueCat client entitlement. Native SDK is optional until a rebuild links
 * `react-native-purchases`; without it we stay on the email allowlist fallback.
 */

export const PRO_ENTITLEMENT_ID = 'pro';

export type ProOfferingPackage = {
  id: string;
  packageType: 'monthly' | 'annual' | 'unknown';
  /** Localized price from the store / RevenueCat — never invent amounts. */
  priceString: string | null;
  productIdentifier: string;
};

export type ProOfferings = {
  packages: ProOfferingPackage[];
  configured: boolean;
};

type PurchasesModule = {
  default: {
    configure: (opts: { apiKey: string; appUserID?: string | null }) => void;
    getCustomerInfo: () => Promise<{ entitlements: { active: Record<string, unknown> } }>;
    getOfferings: () => Promise<{
      current: {
        availablePackages: Array<{
          identifier: string;
          packageType: string;
          product: { priceString?: string; identifier: string };
        }>;
      } | null;
    }>;
    purchasePackage: (pkg: unknown) => Promise<{
      customerInfo: { entitlements: { active: Record<string, unknown> } };
    }>;
    restorePurchases: () => Promise<{ entitlements: { active: Record<string, unknown> } }>;
    logIn: (appUserID: string) => Promise<unknown>;
    logOut: () => Promise<unknown>;
  };
  LOG_LEVEL?: { WARN: unknown };
  PACKAGE_TYPE?: { MONTHLY: string; ANNUAL: string };
};

let purchases: PurchasesModule['default'] | null = null;
let configured = false;
let hasProEntitlement = false;
const listeners = new Set<(isPro: boolean) => void>();

function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() || undefined;
}

function notify() {
  for (const listener of listeners) listener(hasProEntitlement);
}

function applyCustomerInfo(info: { entitlements: { active: Record<string, unknown> } }) {
  hasProEntitlement = Boolean(info.entitlements?.active?.[PRO_ENTITLEMENT_ID]);
  notify();
}

async function loadPurchasesModule(): Promise<PurchasesModule['default'] | null> {
  if (purchases) return purchases;
  try {
    // Optional native module — fails gracefully before a rebuild.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as PurchasesModule;
    purchases = mod.default;
    return purchases;
  } catch {
    return null;
  }
}

export function isRevenueCatConfigured(): boolean {
  return Boolean(apiKey());
}

export function getCachedRevenueCatPro(): boolean {
  return hasProEntitlement;
}

export function subscribeRevenueCatPro(listener: (isPro: boolean) => void): () => void {
  listeners.add(listener);
  listener(hasProEntitlement);
  return () => {
    listeners.delete(listener);
  };
}

export async function configureRevenueCat(appUserId?: string | null): Promise<void> {
  const key = apiKey();
  if (!key) return;
  const sdk = await loadPurchasesModule();
  if (!sdk) {
    console.warn('[purchases] react-native-purchases not linked; Pro uses allowlist fallback.');
    return;
  }
  if (!configured) {
    sdk.configure({ apiKey: key, appUserID: appUserId ?? undefined });
    configured = true;
  } else if (appUserId) {
    try {
      await sdk.logIn(appUserId);
    } catch (err) {
      console.warn('[purchases] logIn failed', err);
    }
  }
  try {
    const info = await sdk.getCustomerInfo();
    applyCustomerInfo(info);
  } catch (err) {
    console.warn('[purchases] getCustomerInfo failed', err);
  }
}

export async function fetchProOfferings(): Promise<ProOfferings> {
  const sdk = await loadPurchasesModule();
  if (!sdk || !configured) {
    return { configured: false, packages: [] };
  }
  try {
    const offerings = await sdk.getOfferings();
    const available = offerings.current?.availablePackages ?? [];
    const packages: ProOfferingPackage[] = available.map((pkg) => {
      const type = String(pkg.packageType || '').toUpperCase();
      let packageType: ProOfferingPackage['packageType'] = 'unknown';
      if (type.includes('MONTH')) packageType = 'monthly';
      else if (type.includes('ANNUAL') || type.includes('YEAR')) packageType = 'annual';
      return {
        id: pkg.identifier,
        packageType,
        priceString: pkg.product.priceString ?? null,
        productIdentifier: pkg.product.identifier,
      };
    });
    return { configured: true, packages };
  } catch (err) {
    console.warn('[purchases] getOfferings failed', err);
    return { configured: true, packages: [] };
  }
}

export async function purchaseProPackage(packageId: string): Promise<boolean> {
  const sdk = await loadPurchasesModule();
  if (!sdk || !configured) {
    throw new Error('Compras no disponibles en este build. Usa un dev client con RevenueCat.');
  }
  const offerings = await sdk.getOfferings();
  const pkg = offerings.current?.availablePackages.find((item) => item.identifier === packageId);
  if (!pkg) throw new Error('No se encontró el producto Pro.');
  const { customerInfo } = await sdk.purchasePackage(pkg);
  applyCustomerInfo(customerInfo);
  return hasProEntitlement;
}

export async function restoreProPurchases(): Promise<boolean> {
  const sdk = await loadPurchasesModule();
  if (!sdk || !configured) {
    throw new Error('Restaurar compra no está disponible en este build.');
  }
  const info = await sdk.restorePurchases();
  applyCustomerInfo(info);
  return hasProEntitlement;
}
