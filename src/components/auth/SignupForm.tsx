"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as React from "react";
import { sileo } from "sileo";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authInputClassName } from "./inputStyles";
import { PasswordField } from "./PasswordField";

const signupSchema = z.object({
  name: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Name must be 2-40 characters")
        .max(40, "Name must be 2-40 characters")
        .regex(
          /^[A-Za-z][A-Za-z\s'.-]*$/,
          "Only letters, spaces, hyphens and apostrophes",
        ),
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email("Enter a valid email address")),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "form", string>
>;

function cleanServerError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^(Uncaught Error:\s*)+/i, "").slice(0, 500);
}

function mapServerError(e: unknown): {
  field?: keyof FieldErrors;
  message: string;
  toastTitle?: string;
} {
  const clean = cleanServerError(e);
  if (/already connected to another SubZero account/i.test(clean)) {
    return {
      field: "email",
      message:
        "This email is already connected to another SubZero account. Sign in to that account instead.",
      toastTitle: "Email already connected",
    };
  }
  if (/That email is already registered/i.test(clean))
    return {
      field: "email",
      message: clean,
      toastTitle: "Email already registered",
    };
  if (/Account .* already exists/i.test(clean))
    return {
      field: "email",
      message:
        "That email is already registered. Try logging in or Continue with Google.",
      toastTitle: "Email already registered",
    };
  if (/Invalid email/i.test(clean))
    return { field: "email", message: "Enter a valid email address." };
  if (/Name may only/i.test(clean) || /Name must be/i.test(clean))
    return { field: "name", message: clean };
  if (/Name required/i.test(clean))
    return { field: "name", message: "Name is required." };
  if (
    /Password must be at least 8/i.test(clean) ||
    /Invalid password/i.test(clean)
  )
    return {
      field: "password",
      message: "Password must be at least 8 characters.",
    };
  if (/Too many/i.test(clean) || /Rate limit/i.test(clean))
    return { message: "Too many attempts. Try again in a few minutes." };
  if (/Invalid credentials/i.test(clean))
    return { message: "Wrong email or password." };
  return { message: clean || "Something went wrong. Try again." };
}

export function SignupForm() {
  const { signIn } = useAuthActions();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);

  const validateField = React.useCallback(
    (
      field: "name" | "email" | "password",
      value: { name: string; email: string; password: string },
    ) => {
      const res = signupSchema.safeParse(value);
      if (res.success) return undefined;
      const f = res.error.flatten().fieldErrors as Record<string, string[]>;
      return f[field]?.[0];
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fe: FieldErrors = {};
      const fieldErrors = flat.fieldErrors as Record<string, string[]>;
      for (const k of ["name", "email", "password"] as const) {
        if (fieldErrors[k]?.[0]) fe[k] = fieldErrors[k]![0]!;
      }
      if (flat.formErrors[0]) fe.form = flat.formErrors[0] as string;
      setErrors(fe);
      setTouched({ name: true, email: true, password: true });
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
    } catch (err) {
      const mapped = mapServerError(err);
      sileo.error({
        title: mapped.toastTitle ?? "Couldn't create account",
        description: mapped.message,
      });
      if (mapped.field) setErrors({ [mapped.field]: mapped.message });
      else setErrors({ form: mapped.message });
    } finally {
      setPending(false);
    }
  }

  const strength =
    password.length === 0
      ? null
      : password.length < 8
        ? { label: "Keep going, 8 characters minimum.", strong: false }
        : password.length >= 12 &&
            /[a-z]/.test(password) &&
            /[A-Z]/.test(password) &&
            /\d/.test(password)
          ? { label: "Strong. That will do.", strong: true }
          : { label: "Good enough.", strong: false };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
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
            const msg = validateField("name", {
              name,
              email,
              password,
            });
            setErrors((s) => ({ ...s, name: msg }));
          }}
          placeholder="Ada Lovelace"
          autoComplete="name"
          autoFocus
          maxLength={40}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          className={authInputClassName(!!errors.name)}
        />
        {touched.name && errors.name && (
          <p id="signup-name-error" className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
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
            const msg = validateField("email", {
              name,
              email,
              password,
            });
            setErrors((s) => ({ ...s, email: msg }));
          }}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          className={authInputClassName(!!errors.email)}
        />
        {touched.email && errors.email && (
          <p id="signup-email-error" className="text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordField
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors((s) => ({
              ...s,
              password: undefined,
              form: undefined,
            }));
          }}
          onBlur={() => {
            setTouched((s) => ({ ...s, password: true }));
            const msg = validateField("password", {
              name,
              email,
              password,
            });
            setErrors((s) => ({ ...s, password: msg }));
          }}
          id="signup-password"
          autoComplete="new-password"
          className={authInputClassName()}
        />
        {touched.password && errors.password ? (
          <p className="text-xs text-destructive">{errors.password}</p>
        ) : (
          strength && (
            <p
              className={
                strength.strong
                  ? "font-mono text-[11px] text-primary"
                  : "font-mono text-[11px] text-muted-foreground"
              }
            >
              {strength.label}
            </p>
          )
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

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full text-[15px]"
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
