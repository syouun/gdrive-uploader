import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}
/* ── 🔼 追加ここまで ─────────────────── */

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
});