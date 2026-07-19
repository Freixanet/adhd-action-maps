import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingState from '../components/LoadingState';
import SessionErrorBanner from '../components/SessionErrorBanner';

export default function LoadingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="px-4 pt-2">
        <SessionErrorBanner />
      </View>
      <LoadingState />
    </SafeAreaView>
  );
}
