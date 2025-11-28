import {
  UserProfile,
  GoogleProfile,
  NaverProfile,
  KakaoProfile,
} from "./oauth";

// 타입 가드
function isGoogleProfile(profile: UserProfile): profile is GoogleProfile {
  return "sub" in profile;
}

function isKakaoProfile(profile: UserProfile): profile is KakaoProfile {
  return "kakao_account" in profile;
}

function isNaverProfile(profile: UserProfile): profile is NaverProfile {
  return (
    "id" in profile && !("sub" in profile) && !("kakao_account" in profile)
  );
}

export function normalizeProfile(profile: UserProfile) {
  // Google
  if (isGoogleProfile(profile)) {
    return {
      id: profile.sub,
      email: profile.email ?? null,
      name: profile.name ?? null,
      avatar: null, // GoogleProfile에는 picture 필드가 없으므로 null
    };
  }

  // Kakao
  if (isKakaoProfile(profile)) {
    return {
      id: profile.id.toString(),
      email: profile.kakao_account.email ?? null,
      name: profile.kakao_account.profile?.nickname ?? null,
      avatar: null, // KakaoProfile에도 profile_image_url이 없으므로 일단 null
    };
  }

  // Naver
  if (isNaverProfile(profile)) {
    return {
      id: profile.id,
      email: profile.email ?? null,
      name: profile.name ?? null,
      avatar: null, // NaverProfile에도 avatar 필드가 없으므로 null
    };
  }

  // fallback
  return {
    id: "unknown",
    email: null,
    name: null,
    avatar: null,
  };
}
