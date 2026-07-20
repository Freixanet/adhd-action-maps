import { useCallback, useEffect, useState } from 'react';
import {
  configureRevenueCat,
  subscribeRevenueCatPro,
} from '../logic/proPurchases';

/** Subscribes to RevenueCat Pro entitlement and configures the SDK when the user email changes. */
export function useRevenueCatPro(cloudUserEmail: string | null) {
  const [revenueCatPro, setRevenueCatPro] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeRevenueCatPro(setRevenueCatPro);
    return unsubscribe;
  }, []);

  useEffect(() => {
    void configureRevenueCat(cloudUserEmail);
  }, [cloudUserEmail]);

  const openPaywall = useCallback(() => {
    setPaywallOpen(true);
  }, []);

  return {
    revenueCatPro,
    paywallOpen,
    setPaywallOpen,
    openPaywall,
  };
}
