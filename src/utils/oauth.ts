import fetch from "node-fetch";
import querystring from "querystring";

export type Provider = "google" | "naver" | "kakao";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}
export interface NaverProfile {
  id: string;
  email: string | null;
  name: string | null;
}
export interface KakaoProfile {
  id: number;
  kakao_account: { email?: string; profile?: { nickname?: string } };
}
export type UserProfile = GoogleProfile | NaverProfile | KakaoProfile;

function assertTokenResponse(obj: any): asserts obj is TokenResponse {
  if (!obj || typeof obj.access_token !== "string")
    throw new Error("Invalid token response");
}

function assertGoogleProfile(obj: any): asserts obj is GoogleProfile {
  if (!obj || typeof obj.sub !== "string")
    throw new Error("Invalid Google profile");
}

function assertNaverProfile(obj: any): asserts obj is NaverProfile {
  if (!obj || typeof obj.id !== "string")
    throw new Error("Invalid Naver profile");
}

function assertKakaoProfile(obj: any): asserts obj is KakaoProfile {
  if (!obj || typeof obj.id !== "number")
    throw new Error("Invalid Kakao profile");
}

export async function exchangeCodeForToken(
  provider: Provider,
  code: string
): Promise<TokenResponse> {
  let res;
  let body: Record<string, string> = {};

  switch (provider) {
    case "google":
      body = {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      };
      res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: querystring.stringify(body),
      });
      break;
    case "naver":
      body = {
        grant_type: "authorization_code",
        client_id: process.env.NAVER_CLIENT_ID!,
        client_secret: process.env.NAVER_CLIENT_SECRET!,
        code,
      };
      res = await fetch("https://nid.naver.com/oauth2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: querystring.stringify(body),
      });
      break;
    case "kakao":
      body = {
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID!,
        redirect_uri: process.env.KAKAO_REDIRECT_URI!,
        code,
      };
      res = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: querystring.stringify(body),
      });
      break;
  }

  const json = await res.json();
  assertTokenResponse(json);
  return json;
}

export async function getProfile(
  provider: Provider,
  accessToken: string
): Promise<UserProfile> {
  let res, json: any;

  switch (provider) {
    case "google":
      res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      json = await res.json();
      assertGoogleProfile(json);
      return json;

    case "naver":
      res = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      json = await res.json();
      if (!json?.response) throw new Error("Invalid Naver profile");
      assertNaverProfile(json.response);
      return json.response;

    case "kakao":
      res = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      json = await res.json();
      assertKakaoProfile(json);
      return json;
  }
}
