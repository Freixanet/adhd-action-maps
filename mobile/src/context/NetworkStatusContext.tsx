import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type NetworkStatusValue = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  hasKnownStatus: boolean;
  isOffline: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusValue | null>(null);

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatusValue>({
    isConnected: null,
    isInternetReachable: null,
    hasKnownStatus: false,
    isOffline: false,
  });

  useEffect(() => {
    // Lectura inicial
    NetInfo.fetch().then((state) => {
      const isConnected = state.isConnected;
      const isInternetReachable = state.isInternetReachable;
      const hasKnownStatus = isConnected !== null;
      // isOffline es true solo si isConnected o isInternetReachable son explícitamente false.
      // Si isInternetReachable es null, no lo consideramos offline por sí solo.
      const isOffline = isConnected === false || isInternetReachable === false;

      setStatus({
        isConnected,
        isInternetReachable,
        hasKnownStatus,
        isOffline,
      });
    });

    // Suscribirse a cambios
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected;
      const isInternetReachable = state.isInternetReachable;
      const hasKnownStatus = isConnected !== null;
      const isOffline = isConnected === false || isInternetReachable === false;

      setStatus({
        isConnected,
        isInternetReachable,
        hasKnownStatus,
        isOffline,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkStatusContext.Provider value={status}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
}
