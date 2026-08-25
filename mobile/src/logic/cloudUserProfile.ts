import type { User } from '@supabase/supabase-js';

export type CloudUserProfile = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export function toCloudUserProfile(user: User): CloudUserProfile {
  const metadata = user.user_metadata ?? {};
  const displayName =
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    (typeof metadata.user_name === 'string' && metadata.user_name.trim()) ||
    null;
  const avatarUrl =
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata.picture === 'string' && metadata.picture) ||
    null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
    avatarUrl,
  };
}
