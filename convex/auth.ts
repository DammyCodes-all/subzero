import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

function userIdCandidates(userId: string) {
  const parts = userId.split("|");
  const uid = parts.length >= 2 ? parts[1] : userId;
  return new Set([userId, uid, `user:${uid}`]);
}

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
        const rawEmail = (params.email as string | undefined)
          ?.trim()
          .toLowerCase();
        if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          throw new Error("Invalid email");
        }
        if (flow === "signUp") {
          const rawName = (params.name as string | undefined)
            ?.trim()
            .replace(/\s+/g, " ");
          if (!rawName) throw new Error("Name required");
          if (rawName.length < 2 || rawName.length > 40) {
            throw new Error("Name must be 2-40 characters");
          }
          if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(rawName)) {
            throw new Error(
              "Name may only contain letters, spaces, hyphens and apostrophes",
            );
          }
          return { email: rawEmail, name: rawName, flow } as any;
        }
        return { email: rawEmail, flow } as any;
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
      const profile = args.profile as {
        email?: string;
        name?: string;
        flow?: string;
      };
      const { flow: authFlow, ...userProfile } = profile;
      const rawEmail =
        typeof profile.email === "string"
          ? profile.email.trim().toLowerCase()
          : undefined;
      const emailNorm = rawEmail?.toLowerCase();
      const isPassword =
        args.type === "credentials" && args.provider.id === "password";
      const isPasswordSignUp = isPassword && authFlow === "signUp";

      if (existingUserId !== null) {
        if (emailNorm) {
          const ownerIds = userIdCandidates(existingUserId);
          const connectedRows = await (ctx.db.query("connections") as any)
            .withIndex("by_accountEmail_status", (q: any) =>
              q.eq("accountEmail", emailNorm).eq("status", "connected"),
            )
            .collect();
          const connectedElsewhere = connectedRows.find(
            (connection: any) =>
              connection.provider === "google" &&
              !ownerIds.has(connection.userId),
          );
          if (connectedElsewhere) {
            throw new Error(
              "This email is already connected to another SubZero account. Sign in to that account instead.",
            );
          }
        }
        return existingUserId;
      }

      // --- Guard + Link: same email -> same User regardless of provider (password / google / gmail) ---
      // This prevents duplicate users (harliarmeen@gmail.com x3) and makes signup/login/oauth all land on one User.
      if (emailNorm) {
        const existingByEmail = await (ctx.db.query("users") as any)
          .withIndex("email", (q: any) => q.eq("email", emailNorm))
          .first();
        if (existingByEmail) {
          if (isPasswordSignUp) {
            throw new Error(
              "That email is already registered. Try logging in instead.",
            );
          }
          // Block password access if the existing user has NO password account (created via OAuth only).
          // Otherwise an attacker with the same email would silently gain password access to it.
          if (isPassword) {
            const hasPasswordAccount = await (
              ctx.db.query("authAccounts") as any
            )
              .withIndex("userIdAndProvider", (q: any) =>
                q.eq("userId", existingByEmail._id).eq("provider", "password"),
              )
              .first();
            if (!hasPasswordAccount) {
              throw new Error(
                "An account with this email already exists. Please sign in with Google.",
              );
            }
          }
          if (args.type === "oauth") {
            // For Google OAuth, patch profile (image, name) onto existing user
            const patch: Record<string, unknown> = {};
            if (profile.name && !existingByEmail.name)
              patch.name = profile.name;
            if ((profile as any).image && !(existingByEmail as any).image)
              patch.image = (profile as any).image;
            if ((profile as any).emailVerificationTime)
              patch.emailVerificationTime = (
                profile as any
              ).emailVerificationTime;
            else if (!(existingByEmail as any).emailVerificationTime)
              patch.emailVerificationTime = Date.now();
            if (Object.keys(patch).length)
              await ctx.db.patch(existingByEmail._id, patch as any);
          }
          return existingByEmail._id;
        }
      }

      // No existing user — create new one. Validate name for password.
      // Guard: block creating a NEW account with an email already connected as a Gmail
      // account to another user — that email "belongs" to an existing account.
      if (emailNorm) {
        const connectedRows = await (ctx.db.query("connections") as any)
          .withIndex("by_accountEmail_status", (q: any) =>
            q.eq("accountEmail", emailNorm).eq("status", "connected"),
          )
          .collect();
        const connectedElsewhere = connectedRows.find(
          (connection: any) => connection.provider === "google",
        );
        if (connectedElsewhere) {
          throw new Error(
            "This email is already connected to another SubZero account. Sign in to that account instead.",
          );
        }
      }
      if (isPassword) {
        const name =
          typeof profile.name === "string" ? profile.name.trim() : undefined;
        if (!rawEmail) throw new Error("Invalid email");
        if (!name) throw new Error("Name required");
        const normalizedName = name.replace(/\s+/g, " ").trim();
        if (normalizedName.length < 2 || normalizedName.length > 40)
          throw new Error("Name must be 2-40 characters");
        if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(normalizedName))
          throw new Error(
            "Name may only contain letters, spaces, hyphens and apostrophes",
          );
        const userId = await ctx.db.insert("users", {
          email: emailNorm!,
          name: normalizedName,
        });
        return userId;
      }

      // OAuth / other credentials without existing email — create
      const userData: Record<string, unknown> = { ...userProfile };
      if (rawEmail) (userData as any).email = emailNorm;
      const userId = await ctx.db.insert("users", userData as any);
      return userId;
    },
  },
});
