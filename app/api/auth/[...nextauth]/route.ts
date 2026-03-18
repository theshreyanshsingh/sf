// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { API } from "@/app/config/publicEnv";
interface SessionUser {
  id?: string;
  name?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
  plan?: string;
  sessionId?: string;
}

const handler = NextAuth({
  // Set the base URL for NextAuth
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
  providers: [
    GithubProvider({
      clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
      clientSecret: process.env.NEXT_PUBLIC_GITHUB_CLIENT_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP Code", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.otp) {
          return null;
        }

        // Call your existing OTP verification API
        const response = await fetch(`${API}/verify-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            otp: credentials.otp,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          return null;
        }

        // Return the user object from your API
        return {
          id: data.email, // Using email as ID since your response has email
          email: data.email,
          name: data.email.split("@")[0],
          plan: data.plan, // Include the plan from your response
          sessionId: data.session,
        };
      },
    }),
  ],
  secret: process.env.NEXT_PUBLIC_NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "github" || account?.provider === "google") {
        try {
          const response = await fetch(`${API}/user-data`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              provider: account.provider,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            return false;
          }

          (user as SessionUser).plan = data.plan;
          (user as SessionUser).sessionId = data.session;

          return true;
        } catch (error) {
          console.log(error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
      }

      if (
        account &&
        (account.provider === "github" || account.provider === "google") &&
        account.access_token
      ) {
        token.accessToken = account.access_token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.id as string;
        session.user.email = token.email as string;
        (session.user as SessionUser).plan = token.plan as string;
        (session.user as SessionUser).sessionId = token.sessionId as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If the URL is a relative URL, make it absolute
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // If the URL is on the same origin, allow it
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      // For external URLs, redirect to the base URL
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});

export { handler as GET, handler as POST };
