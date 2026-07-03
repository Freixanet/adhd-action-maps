import React from 'react';
import { View } from 'react-native';
import { LoadingFadeOverlay } from '../components/LoadingState';
import { useAppSession } from '../context/AppSessionContext';
import InputScreen from '../screens/InputScreen';
import LoadingScreen from '../screens/LoadingScreen';
import ResultScreen from '../screens/ResultScreen';

export function ComprensionPhaseRouter() {
  const session = useAppSession();

  if (session.phase === 'loading') return <LoadingScreen />;
  if (session.phase === 'result') {
    return (
      <View className="flex-1">
        <ResultScreen />
        {session.loadingFadeOverlayActive ? (
          <LoadingFadeOverlay onComplete={session.completeLoadingFadeOverlay} />
        ) : null}
      </View>
    );
  }
  return <InputScreen />;
}
