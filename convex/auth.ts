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

      const profile = args.profile as { email?: string; name?: string };
      const rawEmail = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : undefined;
      const emailNorm = rawEmail?.toLowerCase();

      // --- Guard + Link: same email -> same User regardless of provider (password / google / gmail) ---
      // This prevents duplicate users (harliarmeen@gmail.com x3) and makes signup/login/oauth all land on one User.
      if (emailNorm) {
        const existingByEmail = await (ctx.db.query("users") as any)
          .withIndex("email", (q: any) => q.eq("email", emailNorm))
          .first();
        if (existingByEmail) {
          // For password signup, keep provided name if existing has none, but don't overwrite verified name
          if (args.type === "credentials" && args.provider.id === "password") {
            const name = typeof profile.name === "string" ? profile.name.replace(/\s+/g, " ").trim() : undefined;
            if (name && !existingByEmail.name) {
              await ctx.db.patch(existingByEmail._id, { name });
            }
          } else if (args.type === "oauth") {
            // For Google OAuth, patch profile (image, name) onto existing user
            const patch: Record<string, unknown> = {};
            if (profile.name && !existingByEmail.name) patch.name = profile.name;
            if ((profile as any).image && !(existingByEmail as any).image) patch.image = (profile as any).image;
            if ((profile as any).emailVerificationTime) patch.emailVerificationTime = (profile as any).emailVerificationTime;
            else if (!(existingByEmail as any).emailVerificationTime) patch.emailVerificationTime = Date.now();
            if (Object.keys(patch).length) await ctx.db.patch(existingByEmail._id, patch as any);
          }
          return existingByEmail._id;
        }
      }

      // No existing user — create new one. Validate name for password.
      if (args.type === "credentials" && args.provider.id === "password") {
        const name = typeof profile.name === "string" ? profile.name.trim() : undefined;
        if (!rawEmail) throw new Error("Invalid email");
        if (!name) throw new Error("Name required");
        const normalizedName = name.replace(/\s+/g, " ").trim();
        if (normalizedName.length < 2 || normalizedName.length > 40) throw new Error("Name must be 2-40 characters");
        if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(normalizedName)) throw new Error("Name may only contain letters, spaces, hyphens and apostrophes");
        const userId = await ctx.db.insert("users", { email: emailNorm!, name: normalizedName });
        return userId;
      }

      // OAuth / other credentials without existing email — create
      const userData: Record<string, unknown> = { ...profile };
      if (rawEmail) (userData as any).email = emailNorm;
      const userId = await ctx.db.insert("users", userData as any);
      return userId;
    },
  },
});
