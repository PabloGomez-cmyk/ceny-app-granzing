import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    role?: string;
    userId?: string;
    error?: string;
  }

  interface User {
    access_token?: string;
    refresh_token?: string;
    role?: string;
    user_id?: string;
    full_name?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    role?: string;
    userId?: string;
    fullName?: string | null;
    error?: string;
  }
}
