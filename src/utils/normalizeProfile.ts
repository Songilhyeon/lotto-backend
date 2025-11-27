import { UserProfile } from "./oauth";

export function normalizeProfile(profile: UserProfile) {
  if ("sub" in profile)
    return { id: profile.sub, email: profile.email, name: profile.name };
  if ("kakao_account" in profile)
    return {
      id: profile.id.toString(),
      email: profile.kakao_account.email || null,
      name: profile.kakao_account.profile?.nickname || null,
    };
  return {
    id: profile.id,
    email: profile.email || null,
    name: profile.name || null,
  };
}
