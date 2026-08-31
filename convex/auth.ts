import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      id: "password",
      validatePasswordRequirements(password: string) {
        if (!password || password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
      },
      profile(params: any) {
        const flow = params.flow as string;
        const rawEmail = (params.email as string | undefined)?.trim().toLowerCase();
        if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          throw new Error("Invalid email");
        }
        if (flow === "signUp") {
          const rawName = (params.name as string | undefined)?.trim().replace(/\s+/g, " ");
          if (!rawName) throw new Error("Name required");
          if (rawName.length < 2 || rawName.length > 40) {
            throw new Error("Name must be 2-40 characters");
          }
          if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(rawName)) {
            throw new Error("Name may only contain letters, spaces, hyphens and apostrophes");
          }
          return { email: rawEmail, name: rawName } as any;
        }
        return { email: rawEmail } as any;
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const existingUserId = args.existingUserId;
      if (existingUserId !== null) return existingUserId;

      // Only enforce email-dup check for Password credentials signUp
      if (args.type === "credentials" && args.provider.id === "password") {
        const profile = args.profile as { email?: string; name?: string };
        const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : undefined;
        const name = typeof profile.name === "string" ? profile.name.trim() : undefined;

        if (!email) throw new Error("Invalid email");
        if (!name) throw new Error("Name required");
        const normalizedName = name.replace(/\s+/g, " ").trim();
        if (normalizedName.length < 2 || normalizedName.length > 40) {
          throw new Error("Name must be 2-40 characters");
        }
        if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(normalizedName)) {
          throw new Error("Name may only contain letters, spaces, hyphens and apostrophes");
        }

        // Cross-provider duplicate: any existing user with same email (regardless of provider) blocks Password signUp
        const existingByEmail = await (ctx.db.query("users") as any)
          .withIndex("email", (q: any) => q.eq("email", email))
          .first();
        if (existingByEmail) {
          throw new Error("That email is already registered. Try logging in or Continue with Google.");
        }

        const userId = await ctx.db.insert("users", {
          email,
          name: normalizedName,
        });
        return userId;
      }

      // For OAuth / other providers, fall back to default behavior (link if verified)
      const { provider, profile } = args as any;
      const email = typeof profile.email === "string" ? profile.email : undefined;
      const shouldLinkViaEmail =
        (args as any).shouldLinkViaEmail ||
        (provider.type === "oauth" || provider.type === "oidc") && provider.allowDangerousEmailAccountLinking !== false;

      if (shouldLinkViaEmail && typeof email === "string") {
        const verifiedUser = await (ctx.db.query("users") as any)
          .withIndex("email", (q: any) => q.eq("email", email))
          .filter((q: any) => q.neq(q.field("emailVerificationTime"), undefined))
          .first();
        if (verifiedUser) {
          await ctx.db.patch(verifiedUser._id, { ...profile });
          return verifiedUser._id;
        }
      }

      // Create new user with profile fields
      const userData: Record<string, unknown> = { ...profile };
      // Preserve Convex Auth expected fields
      const userId = await ctx.db.insert("users", userData as any);
      return userId;
    },
  },
});
