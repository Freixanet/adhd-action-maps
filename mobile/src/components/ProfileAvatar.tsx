import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { UserRound } from '../icons';
import { useTheme } from '../context/ThemeContext';

type ProfileAvatarProps = {
  signedIn?: boolean;
  avatarUrl?: string | null;
  floating?: boolean;
};

export default function ProfileAvatar({
  signedIn = false,
  avatarUrl,
  floating = false,
}: ProfileAvatarProps) {
  const { isDark } = useTheme();
  const [imageError, setImageError] = useState(false);
  const showPhoto = Boolean(signedIn && avatarUrl && !imageError);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  if (showPhoto) {
    const size = floating ? 44 : 36;

    return (
      <View
        className="overflow-hidden bg-neutral-200 bg-surface-2"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      >
        <Image
          source={{ uri: avatarUrl! }}
          style={{ width: size, height: size }}
          accessibilityLabel="Foto de perfil"
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  if (floating) {
    return (
      <UserRound
        size={20}
        color={signedIn ? '#8B8FF5' : isDark ? '#d4d4d4' : '#525252'}
        strokeWidth={2.25}
      />
    );
  }

  return (
    <View
      className={`w-9 h-9 rounded-full items-center justify-center ${
        signedIn ? 'bg-accent' : 'bg-base0/10 dark:bg-white/10'
      }`}
    >
      <UserRound size={18} color={signedIn ? '#ffffff' : '#525252'} />
    </View>
  );
}
