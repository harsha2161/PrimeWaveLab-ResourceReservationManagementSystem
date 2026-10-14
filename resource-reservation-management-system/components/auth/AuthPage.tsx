"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Layers3,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
  Waves,
} from "lucide-react";

type AuthPageProps = {
  mode: "login" | "register";
};

type AuthResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  details?: Record<string, string[]>;
  data?: {
    user?: {
      role?: string;
    };
  };
};

function responseMessage(body: AuthResponse, fallback: string) {
  const validationMessages = Object.values(body.details ?? {}).flat();
  return validationMessages.length > 0
    ? validationMessages.join(" ")
    : body.error || body.message || fallback;
}

export default function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as AuthResponse;

      if (!response.ok || !body.success) {
        setErrorMessage(
          responseMessage(
            body,
            isRegister
              ? "We couldn’t create your account. Please try again."
              : "We couldn’t sign you in. Please check your details and try again.",
          ),
        );
        return;
      }

      if (isRegister) {
        setSuccessMessage("Your account is ready. Sign in to continue.");
        return;
      }

      const role = body.data?.user?.role;
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "USER") {
        router.push("/dashboard");
      } else {
        setErrorMessage("Your account role could not be confirmed. Please contact support.");
      }
    } catch {
      setErrorMessage("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-label={isRegister ? "Create an account" : "Sign in"}>
        <aside className="auth-story">
          <Link className="brand" href="/login" aria-label="PrimeWave Lab home">
            <span className="brand-mark"><Waves size={21} strokeWidth={2.3} /></span>
            <span className="brand-name">primewave<span>lab</span></span>
          </Link>

          <div className="story-content">
            <div className="story-kicker"><Sparkles size={14} /> YOUR SPACE, READY WHEN YOU ARE</div>
            <h1>Make room for<br /><span>great work.</span></h1>
            <p>One simple place to find and reserve the spaces, equipment, and facilities your work needs.</p>

            <div className="story-card" aria-label="Reservation system benefits">
              <div className="story-card-icon"><Layers3 size={19} /></div>
              <div>
                <strong>Everything in one place</strong>
                <span>Rooms, labs, gear, and more.</span>
              </div>
              <span className="story-card-check"><Check size={15} /></span>
            </div>

            <div className="story-points">
              <span><ShieldCheck size={15} /> Secure access</span>
              <span><MapPin size={15} /> Easy to find</span>
            </div>
          </div>

          <div className="story-footer">Built for the way your team works.</div>
          <div className="story-orb story-orb-one" aria-hidden="true" />
          <div className="story-orb story-orb-two" aria-hidden="true" />
        </aside>

        <section className="auth-form-panel">
          <div className="mobile-brand">
            <Link className="brand" href="/login" aria-label="PrimeWave Lab home">
              <span className="brand-mark"><Waves size={20} strokeWidth={2.3} /></span>
              <span className="brand-name">primewave<span>lab</span></span>
            </Link>
          </div>

          <div className="auth-form-wrap">
            <div className="form-heading">
              <div className="form-eyebrow">{isRegister ? "GET STARTED" : "WELCOME BACK"}</div>
              <h2>{isRegister ? "Create your account" : "Sign in to your account"}</h2>
              <p>{isRegister ? "A few details and you’ll be ready to go." : "Enter your details to access your workspace."}</p>
            </div>

            {errorMessage && (
              <div className="form-message form-message-error" role="alert">
                <span className="message-icon">!</span>{errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="form-message form-message-success" role="status">
                <span className="message-icon"><Check size={14} /></span>{successMessage}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              {isRegister && (
                <div className="form-row">
                  <label className="field">
                    <span>First name</span>
                    <span className="input-wrap"><UserRound size={17} /><input name="firstName" type="text" placeholder="Jane" autoComplete="given-name" minLength={2} maxLength={50} required /></span>
                  </label>
                  <label className="field">
                    <span>Last name</span>
                    <span className="input-wrap"><UserRound size={17} /><input name="lastName" type="text" placeholder="Smith" autoComplete="family-name" minLength={2} maxLength={50} required /></span>
                  </label>
                </div>
              )}

              <label className="field">
                <span>Email address</span>
                <span className="input-wrap"><Mail size={17} /><input name="email" type="email" placeholder="you@company.com" autoComplete="email" maxLength={255} required /></span>
              </label>

              {isRegister && (
                <label className="field">
                  <span>Phone number</span>
                  <span className="input-wrap"><UserRound size={17} /><input name="phone" type="tel" placeholder="+94771234567" autoComplete="tel" pattern="\+?[0-9]{9,15}" title="Use 9 to 15 digits, with an optional + at the start." required /></span>
                </label>
              )}

              <label className="field">
                <span>Password</span>
                <span className="input-wrap"><KeyRound size={17} /><input name="password" type={showPassword ? "text" : "password"} placeholder={isRegister ? "At least 8 characters" : "Enter your password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : 1} maxLength={100} required />
                  <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {isRegister && <small className="field-hint"><LockKeyhole size={13} /> Include uppercase, lowercase, a number, and a symbol.</small>}
              </label>

              {!isRegister && <div className="secure-note"><ShieldCheck size={15} /> Your account is protected with secure sign-in.</div>}

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
                {!isSubmitting && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="auth-switch">
              {isRegister ? "Already have an account?" : "New to PrimeWave Lab?"}{" "}
              <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
            </div>

            <div className="form-legal">By continuing, you agree to use PrimeWave Lab responsibly.</div>
          </div>
        </section>
      </section>
    </main>
  );
}
