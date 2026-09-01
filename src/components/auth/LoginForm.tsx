"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./PasswordField";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});

type FieldErrors = Partial<Record<"email" | "password" | "form", string>>;

function mapServerError(e: unknown): {
  field?: keyof FieldErrors;
  message: string;
} {
  const msg = e instanceof Error ? e.message : String(e);
  const clean = msg.replace(/^(Uncaught Error:\s*)+/i, "").slice(0, 500);
  if (/Invalid credentials/i.test(clean))
    return { message: "Wrong email or password." };
  if (/Invalid email/i.test(clean))
    return { field: "email", message: "Enter a valid email address." };
  if (/Too many/i.test(clean) || /Rate limit/i.test(clean))
    return { message: "Too many attempts. Try again in a few minutes." };
  return { message: clean || "Something went wrong. Try again." };
}

export function LoginForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fe: FieldErrors = {};
      const fieldErrors = flat.fieldErrors as Record<string, string[]>;
      for (const k of ["email", "password"] as const)
        if (fieldErrors[k]?.[0]) fe[k] = fieldErrors[k]![0]!;
      if (flat.formErrors[0]) fe.form = flat.formErrors[0] as string;
      setErrors(fe);
      setTouched({ email: true, password: true });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await signIn("password", {
        flow: "signIn",
        email: parsed.data.email,
        password: parsed.data.password,
      });
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
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((s) => ({ ...s, email: undefined, form: undefined }));
          }}
          onBlur={() => {
            setTouched((s) => ({ ...s, email: true }));
            const res = loginSchema.safeParse({ email, password });
            if (!res.success) {
              const fe = res.error.flatten().fieldErrors as Record<
                string,
                string[]
              >;
              setErrors((s) => ({ ...s, email: fe.email?.[0] }));
            } else {
              setErrors((s) => ({ ...s, email: undefined }));
            }
          }}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          className={
            errors.email
              ? "border-destructive focus-visible:ring-destructive/20"
              : undefined
          }
        />
        {touched.email && errors.email && (
          <p id="login-email-error" className="text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">Password</Label>
        <PasswordField
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors((s) => ({ ...s, password: undefined, form: undefined }));
          }}
          id="login-password"
          autoComplete="current-password"
        />
        {touched.password && errors.password && (
          <p className="text-xs text-destructive">{errors.password}</p>
        )}
      </div>

      {errors.form && (
        <p
          className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2"
          role="alert"
        >
          {errors.form}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
