import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Deactivated accounts can't start a new session — surfaces as the
        // same generic invalid-credentials error, no info leak about why.
        if (!user.isActive) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    // `role` on the token/session is for fast, non-authoritative UI decisions
    // only (e.g. which nav tabs to render). Every real authorization check
    // (lib/rbac.ts) re-fetches the User row fresh from the DB instead of
    // trusting this — so a role change or access revocation takes effect
    // immediately, not "next login."
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};
