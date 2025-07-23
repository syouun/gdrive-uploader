import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

/*───────────────── Google トークン自動更新 ─────────────────*/
async function refreshGoogleToken(token: JWT): Promise<JWT> {
  try {
    const url =
      "https://oauth2.googleapis.com/token?" +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    console.error("🔴 RefreshAccessTokenError", err);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

/*───────────────── NextAuth 設定 ─────────────────*/
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: (account.expires_at ?? 0) * 1000,
          user: token.user,
        };
      }
      if (Date.now() < (token.expiresAt as number)) return token;
      return refreshGoogleToken(token);
    },
    async session({ session, token }) {
      (session as Session & {
        accessToken?: string;
        error?: string;
      }).accessToken = token.accessToken as string | undefined;

      (session as Session & {
        accessToken?: string;
        error?: string;
      }).error = (token as JWT & { error?: string }).error;

      return session;
    },
  },
};

export default NextAuth(authOptions);