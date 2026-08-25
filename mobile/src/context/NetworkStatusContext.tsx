import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type NetworkStatusValue = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  hasKnownStatus: boolean;
  isOffline: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusValue | null>(null);

function readOffline(isConnected: boolean | null): boolean {
  // iOS NetInfo often reports isInternetReachable=false on working Wi-Fi,
  // especially on LAN or right after a request. Only an explicit disconnect
  // is offline; reachability false must not block chats.
  return isConnected === false;
}

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatusValue>({
    isConnected: null,
    isInternetReachable: null,
    hasKnownStatus: false,
    isOffline: false,
  });

  useEffect(() => {
    const apply = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      const isConnected = state.isConnected;
      const isInternetReachable = state.isInternetReachable;
      setStatus({
        isConnected,
        isInternetReachable,
        hasKnownStatus: isConnected !== null,
        isOffline: readOffline(isConnected),
      });
    };

    void NetInfo.fetch().then((state) => {
      apply({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      apply({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
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
