"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./PasswordField";

const signupSchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.replace(/\s+/g, " ").trim())
      .pipe(
        z
          .string()
          .min(2, "Name must be 2-40 characters")
          .max(40, "Name must be 2-40 characters")
          .regex(/^[A-Za-z][A-Za-z\s'.-]*$/, "Only letters, spaces, hyphens and apostrophes"),
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.string().email("Enter a valid email address")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirm" | "form", string>>;

function mapServerError(e: unknown): { field?: keyof FieldErrors; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const clean = msg.replace(/^Uncaught Error:\s*/i, "").slice(0, 500);
  if (/That email is already registered/i.test(clean)) return { field: "email", message: clean };
  if (/Account .* already exists/i.test(clean)) return { field: "email", message: "That email is already registered. Try logging in or Continue with Google." };
  if (/Invalid email/i.test(clean)) return { field: "email", message: "Enter a valid email address." };
  if (/Name may only/i.test(clean) || /Name must be/i.test(clean)) return { field: "name", message: clean };
  if (/Name required/i.test(clean)) return { field: "name", message: "Name is required." };
  if (/Password must be at least 8/i.test(clean) || /Invalid password/i.test(clean)) return { field: "password", message: "Password must be at least 8 characters." };
  if (/Too many/i.test(clean) || /Rate limit/i.test(clean)) return { message: "Too many attempts. Try again in a few minutes." };
  if (/Invalid credentials/i.test(clean)) return { message: "Wrong email or password." };
  return { message: clean || "Something went wrong. Try again." };
}

export function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { signIn } = useAuthActions();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);

  const validateField = React.useCallback(
    (field: "name" | "email" | "password" | "confirm", value: { name: string; email: string; password: string; confirm: string }) => {
      const res = signupSchema.safeParse(value);
      if (res.success) return undefined;
      const f = res.error.flatten().fieldErrors as Record<string, string[]>;
      return f[field]?.[0];
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ name, email, password, confirm });
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fe: FieldErrors = {};
      const fieldErrors = flat.fieldErrors as Record<string, string[]>;
      for (const k of ["name", "email", "password", "confirm"] as const) {
        if (fieldErrors[k]?.[0]) fe[k] = fieldErrors[k]![0]!;
      }
      if (flat.formErrors[0]) fe.form = flat.formErrors[0] as string;
      setErrors(fe);
      setTouched({ name: true, email: true, password: true, confirm: true });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await signIn("password", {
        flow: "signUp",
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
      });
      onSuccess?.();
    } catch (err) {
      const mapped = mapServerError(err);
      if (mapped.field) setErrors({ [mapped.field]: mapped.message });
      else setErrors({ form: mapped.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Name</Label>
        <Input
          id="signup-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((s) => ({ ...s, name: undefined, form: undefined }));
          }}
          onBlur={() => {
            setTouched((s) => ({ ...s, name: true }));
            const msg = validateField("name", { name, email, password, confirm });
            setErrors((s) => ({ ...s, name: msg }));
          }}
          placeholder="Ada Lovelace"
          autoComplete="name"
          maxLength={40}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          className={errors.name ? "border-destructive focus-visible:ring-destructive/20" : undefined}
        />
        {touched.name && errors.name && (
          <p id="signup-name-error" className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((s) => ({ ...s, email: undefined, form: undefined }));
          }}
          onBlur={() => {
            setTouched((s) => ({ ...s, email: true }));
            const msg = validateField("email", { name, email, password, confirm });
            setErrors((s) => ({ ...s, email: msg }));
          }}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          className={errors.email ? "border-destructive focus-visible:ring-destructive/20" : undefined}
        />
        {touched.email && errors.email && (
          <p id="signup-email-error" className="text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordField
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors((s) => ({ ...s, password: undefined, confirm: undefined, form: undefined }));
          }}
          id="signup-password"
          autoComplete="new-password"
        />
        {touched.password && errors.password ? (
          <p className="text-xs text-destructive">{errors.password}</p>
        ) : (
          <p className="text-xs text-muted-foreground">At least 8 characters</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <PasswordField
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setErrors((s) => ({ ...s, confirm: undefined, form: undefined }));
          }}
          id="signup-confirm"
          autoComplete="new-password"
          placeholder="Repeat password"
        />
        {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
      </div>

      {errors.form && <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2" role="alert">{errors.form}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
