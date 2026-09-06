import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type KakaoTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const storedState = (await cookies()).get("bdb_kakao_oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/?auth_error=invalid_kakao_state", origin));
  }

  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.redirect(new URL("/?auth_error=missing_kakao_key", origin));
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: `${origin}/auth/kakao/callback`,
    code,
  });

  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });

  const tokenPayload = (await tokenResponse.json()) as KakaoTokenResponse;

  if (!tokenResponse.ok || !tokenPayload.id_token) {
    const error = tokenPayload.error ?? "kakao_token_error";
    return NextResponse.redirect(new URL(`/?auth_error=${error}`, origin));
  }

  const supabase = await createClient();
  const { error } =
    (await supabase?.auth.signInWithIdToken({
      provider: "kakao",
      token: tokenPayload.id_token,
    })) ?? {};

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error.message)}`, origin)
    );
  }

  const response = NextResponse.redirect(new URL("/", origin));
  response.cookies.delete("bdb_kakao_oauth_state");
  return response;
}
