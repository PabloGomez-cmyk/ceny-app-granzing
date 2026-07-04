import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Renueva el access token usando el refresh token
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    });

    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);

    const data = await res.json();
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      // 1 minuto de buffer antes del TTL real de 15 min
      accessTokenExpires: Date.now() + 14 * 60 * 1000,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // Login inicial
      if (user) {
        return {
          ...token,
          accessToken: (user as any).access_token,
          refreshToken: (user as any).refresh_token,
          accessTokenExpires: Date.now() + 14 * 60 * 1000,
          role: (user as any).role,
          userId: (user as any).user_id,
          fullName: (user as any).full_name ?? null,
        };
      }

      // Token todavía vigente
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token expirado → intentar refresh
      return refreshAccessToken(token);
    },
    session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).role = token.role;
      (session as any).userId = token.userId;
      (session as any).error = token.error;
      if (token.fullName) session.user.name = token.fullName as string;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });

          if (!res.ok) {
            if (process.env.NODE_ENV !== "production") {
              const body = await res.text().catch(() => "");
              console.error(`[auth] backend ${res.status}:`, body);
            }
            return null;
          }

          const data = await res.json();
          return {
            id: data.user_id,
            email: data.email,
            name: data.full_name ?? data.email,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            role: data.role,
            user_id: data.user_id,
            full_name: data.full_name ?? null,
          };
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[auth] authorize error:", err);
          }
          return null;
        }
      },
    }),
  ],
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
