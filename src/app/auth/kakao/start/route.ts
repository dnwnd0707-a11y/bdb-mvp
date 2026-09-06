import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const clientId = process.env.KAKAO_REST_API_KEY;

  if (!clientId) {
    return NextResponse.redirect(new URL("/?auth_error=missing_kakao_key", origin));
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/auth/kakao/callback`;
  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");

  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile_nickname profile_image");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("bdb_kakao_oauth_state", state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: origin.startsWith("https://"),
  });

  return response;
}
