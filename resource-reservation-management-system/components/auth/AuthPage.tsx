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
    <main className="auth-page [min-height:100vh] [padding:28px] [display:grid] [place-items:center] [background:radial-gradient(ellipse_at_88%_9%,_rgba(30,_137,_134,_.08),_transparent_28%),_#f7f8f6] max-[880px]:[padding:20px] max-[680px]:[min-height:100vh] max-[680px]:[display:block] max-[680px]:[padding:0] max-[680px]:[background:#fff]">
      <section className="auth-layout [width:min(1110px,_100%)] [min-height:690px] [display:grid] [grid-template-columns:.93fr_1.07fr] [overflow:hidden] [border:1px_solid_rgba(25,_53,_66,_.06)] [border-radius:24px] [background:#fff] [box-shadow:0_24px_70px_rgba(27,_48,_59,_.10),_0_3px_12px_rgba(27,_48,_59,_.04)] max-[880px]:[min-height:640px] max-[880px]:[grid-template-columns:.85fr_1.15fr] max-[680px]:[width:100%] max-[680px]:[min-height:100vh] max-[680px]:[display:flex] max-[680px]:[flex-direction:column] max-[680px]:[overflow:visible] max-[680px]:[border:0] max-[680px]:[border-radius:0] max-[680px]:[box-shadow:none]" aria-label={isRegister ? "Create an account" : "Sign in"}>
        <aside className="auth-story [min-height:690px] [position:relative] [display:flex] [flex-direction:column] [overflow:hidden] [padding:34px_40px_28px] [color:#f5ffff] [background:linear-gradient(150deg,_#0b303d_0%,_#0c4954_53%,_#087c7a_100%)] before:[content:&quot;&quot;] before:[position:absolute] before:[inset:0] before:[z-index:0] before:[opacity:.25] before:[background-image:radial-gradient(rgba(230,_255,_252,_.45)_.75px,_transparent_.75px)] before:[background-size:19px_19px] before:[mask-image:linear-gradient(to_bottom,_#000,_transparent_75%)] before:[pointer-events:none] max-[880px]:[min-height:640px] max-[880px]:[padding-right:28px] max-[880px]:[padding-left:28px] max-[680px]:[min-height:0] max-[680px]:[padding:22px_24px_27px] max-[680px]:[border-radius:0_0_22px_22px] max-[680px]:[&>_.brand]:[display:none] max-[390px]:[padding-right:19px] max-[390px]:[padding-left:19px]">
          <Link className="brand [position:relative] [z-index:1] [display:inline-flex] [align-items:center] [gap:10px] [width:fit-content] [color:inherit] [text-decoration:none]" href="/login" aria-label="PrimeWave Lab home">
            <span className="brand-mark [width:36px] [height:36px] [display:grid] [place-items:center] [color:#d4ffff] [border:1px_solid_rgba(208,_255,_253,_.28)] [border-radius:11px] [background:rgba(206,_255,_252,_.12)]"><Waves size={21} strokeWidth={2.3} /></span>
            <span className="brand-name [font-size:17px] [font-weight:720] [letter-spacing:-.65px] [&_span]:[color:#8ce0d8] [&_span]:[font-weight:520]">primewave<span>lab</span></span>
          </Link>

          <div className="story-content [position:relative] [z-index:1] [width:min(390px,_100%)] [margin:auto_0] [padding:64px_0_48px] [&_h1]:[margin:22px_0_16px] [&_h1]:[font-size:clamp(39px,_4vw,_52px)] [&_h1]:[line-height:1.08] [&_h1]:[letter-spacing:-2.8px] [&_h1]:[font-weight:660] [&_h1_span]:[color:#91ddd4] [&>_p]:[max-width:350px] [&>_p]:[margin:0] [&>_p]:[color:rgba(233,_250,_249,_.75)] [&>_p]:[font-size:14px] [&>_p]:[line-height:1.8] max-[680px]:[width:100%] max-[680px]:[padding:33px_0_5px] max-[680px]:[&_h1]:[margin:13px_0_8px] max-[680px]:[&_h1]:[font-size:32px] max-[680px]:[&_h1]:[letter-spacing:-1.7px] max-[680px]:[&>_p]:[max-width:450px] max-[680px]:[&>_p]:[font-size:12px] max-[680px]:[&>_p]:[line-height:1.6]">
            <div className="story-kicker [display:flex] [align-items:center] [gap:8px] [font-size:10px] [font-weight:750] [letter-spacing:1.25px] [color:#9ce8df] max-[680px]:[font-size:9px]"><Sparkles size={14} /> YOUR SPACE, READY WHEN YOU ARE</div>
            <h1>Make room for<br /><span>great work.</span></h1>
            <p>One simple place to find and reserve the spaces, equipment, and facilities your work needs.</p>

            <div className="story-card [width:min(355px,_100%)] [display:flex] [align-items:center] [gap:13px] [margin-top:36px] [padding:15px_15px] [border:1px_solid_rgba(219,_255,_251,_.17)] [border-radius:14px] [background:rgba(222,_255,_252,_.09)] [backdrop-filter:blur(8px)] [&>_div:nth-child(2)]:[display:grid] [&>_div:nth-child(2)]:[gap:4px] [&_strong]:[font-size:12px] [&_strong]:[font-weight:650] [&_span:not(.story-card-check)]:[color:rgba(233,_250,_249,_.65)] [&_span:not(.story-card-check)]:[font-size:11px] max-[680px]:[display:none]" aria-label="Reservation system benefits">
              <div className="story-card-icon [width:38px] [height:38px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:11px] [color:#b0f3e9] [background:rgba(176,_243,_233,_.12)]"><Layers3 size={19} /></div>
              <div>
                <strong>Everything in one place</strong>
                <span>Rooms, labs, gear, and more.</span>
              </div>
              <span className="story-card-check [width:23px] [height:23px] [margin-left:auto] [display:grid] [place-items:center] [border-radius:50%] [color:#d5fff5] [background:rgba(134,_226,_207,_.2)]"><Check size={15} /></span>
            </div>

            <div className="story-points [display:flex] [gap:22px] [margin-top:22px] [color:rgba(233,_250,_249,_.7)] [font-size:11px] [&_span]:[display:inline-flex] [&_span]:[align-items:center] [&_span]:[gap:7px] [&_svg]:[color:#91ddd4] max-[680px]:[margin-top:15px] max-[680px]:[font-size:10px]">
              <span><ShieldCheck size={15} /> Secure access</span>
              <span><MapPin size={15} /> Easy to find</span>
            </div>
          </div>

          <div className="story-footer [position:relative] [z-index:1] [color:rgba(230,_251,_248,_.53)] [font-size:10px] [letter-spacing:.2px] max-[680px]:[display:none]">Built for the way your team works.</div>
          <div className="story-orb story-orb-one [position:absolute] [border:1px_solid_rgba(180,_247,_238,_.11)] [border-radius:50%] [pointer-events:none] [width:360px] [height:360px] [right:-220px] [top:37%] [box-shadow:0_0_0_34px_rgba(180,_247,_238,_.025),_0_0_0_68px_rgba(180,_247,_238,_.02)] max-[680px]:[width:220px] max-[680px]:[height:220px] max-[680px]:[right:-152px] max-[680px]:[top:15%]" aria-hidden="true" />
          <div className="story-orb story-orb-two [position:absolute] [border:1px_solid_rgba(180,_247,_238,_.11)] [border-radius:50%] [pointer-events:none] [width:150px] [height:150px] [left:-105px] [bottom:4%] [background:rgba(115,_217,_204,_.035)] max-[680px]:[display:none]" aria-hidden="true" />
        </aside>

        <section className="auth-form-panel [display:flex] [align-items:center] [justify-content:center] [padding:54px_64px] [background:#fff] max-[880px]:[padding:42px_34px] max-[680px]:[flex:1] max-[680px]:[align-items:flex-start] max-[680px]:[padding:22px_24px_35px] max-[390px]:[padding-right:19px] max-[390px]:[padding-left:19px]">
          <div className="mobile-brand [display:none] max-[680px]:[display:none]">
            <Link className="brand [position:relative] [z-index:1] [display:inline-flex] [align-items:center] [gap:10px] [width:fit-content] [color:inherit] [text-decoration:none]" href="/login" aria-label="PrimeWave Lab home">
              <span className="brand-mark [width:36px] [height:36px] [display:grid] [place-items:center] [color:#d4ffff] [border:1px_solid_rgba(208,_255,_253,_.28)] [border-radius:11px] [background:rgba(206,_255,_252,_.12)]"><Waves size={20} strokeWidth={2.3} /></span>
              <span className="brand-name [font-size:17px] [font-weight:720] [letter-spacing:-.65px] [&_span]:[color:#8ce0d8] [&_span]:[font-weight:520]">primewave<span>lab</span></span>
            </Link>
          </div>

          <div className="auth-form-wrap [width:min(390px,_100%)] max-[680px]:[width:min(440px,_100%)] max-[680px]:[margin:0_auto]">
            <div className="form-heading [margin-bottom:29px] [&_h2]:[margin:0] [&_h2]:[color:#1a2d3b] [&_h2]:[font-size:27px] [&_h2]:[font-weight:680] [&_h2]:[letter-spacing:-.9px] [&_h2]:[line-height:1.25] [&_p]:[margin:9px_0_0] [&_p]:[color:var(--muted)] [&_p]:[font-size:13px] [&_p]:[line-height:1.6] max-[680px]:[margin-bottom:22px] max-[680px]:[&_h2]:[font-size:24px]">
              <div className="form-eyebrow [display:flex] [align-items:center] [gap:8px] [font-size:10px] [font-weight:750] [letter-spacing:1.25px] [margin-bottom:10px] [color:var(--teal)]">{isRegister ? "GET STARTED" : "WELCOME BACK"}</div>
              <h2>{isRegister ? "Create your account" : "Sign in to your account"}</h2>
              <p>{isRegister ? "A few details and you’ll be ready to go." : "Enter your details to access your workspace."}</p>
            </div>

            {errorMessage && (
              <div className="form-message form-message-error [display:flex] [align-items:flex-start] [gap:9px] [margin:-10px_0_19px] [padding:11px_12px] [border:1px_solid] [border-radius:9px] [font-size:11px] [line-height:1.55] [border-color:#f0d1cd] [color:#9a4138] [background:#fff7f6] [&.message-icon]:[color:#fff] [&.message-icon]:[background:#c66b60]" role="alert">
                <span className="message-icon [width:18px] [height:18px] [flex:0_0_auto] [display:grid] [place-items:center] [border-radius:50%] [font-size:11px] [font-weight:700]">!</span>{errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="form-message form-message-success [display:flex] [align-items:flex-start] [gap:9px] [margin:-10px_0_19px] [padding:11px_12px] [border:1px_solid] [border-radius:9px] [font-size:11px] [line-height:1.55] [border-color:#c9e8dc] [color:#26694f] [background:#f3fbf7] [&.message-icon]:[color:#fff] [&.message-icon]:[background:#55a47e]" role="status">
                <span className="message-icon [width:18px] [height:18px] [flex:0_0_auto] [display:grid] [place-items:center] [border-radius:50%] [font-size:11px] [font-weight:700]"><Check size={14} /></span>{successMessage}
              </div>
            )}

            <form className="auth-form [display:grid] [gap:17px] max-[680px]:[gap:15px]" onSubmit={handleSubmit}>
              {isRegister && (
                <div className="form-row [display:grid] [grid-template-columns:1fr_1fr] [gap:13px] max-[390px]:[gap:9px] max-[390px]:[&.input-wrap]:[gap:7px] max-[390px]:[&.input-wrap]:[padding-right:9px] max-[390px]:[&.input-wrap]:[padding-left:9px]">
                  <label className="field [min-width:0] [display:grid] [gap:8px] [color:#334451] [font-size:11px] [font-weight:650]">
                    <span>First name</span>
                    <span className="input-wrap [height:47px] [display:flex] [align-items:center] [gap:10px] [padding:0_13px] [border:1px_solid_#dfe6e7] [border-radius:10px] [color:#8a9aa2] [background:#fff] [transition:border-color_.16s_ease,_box-shadow_.16s_ease,_background_.16s_ease] focus-within:[border-color:#4ca8a5] focus-within:[background:#fff] focus-within:[box-shadow:0_0_0_3px_rgba(28,_142,_139,_.11)] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[height:100%] [&_input]:[padding:0] [&_input]:[border:0] [&_input]:[outline:0] [&_input]:[color:#233847] [&_input]:[background:transparent] [&_input]:[font-size:12px] [&_input]:[font-weight:450] [&_input::placeholder]:[color:#a7b1b7] [&_input:-webkit-autofill]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:hover]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:focus]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_#fff_inset]"><UserRound size={17} /><input name="firstName" type="text" placeholder="Jane" autoComplete="given-name" minLength={2} maxLength={50} required /></span>
                  </label>
                  <label className="field [min-width:0] [display:grid] [gap:8px] [color:#334451] [font-size:11px] [font-weight:650]">
                    <span>Last name</span>
                    <span className="input-wrap [height:47px] [display:flex] [align-items:center] [gap:10px] [padding:0_13px] [border:1px_solid_#dfe6e7] [border-radius:10px] [color:#8a9aa2] [background:#fff] [transition:border-color_.16s_ease,_box-shadow_.16s_ease,_background_.16s_ease] focus-within:[border-color:#4ca8a5] focus-within:[background:#fff] focus-within:[box-shadow:0_0_0_3px_rgba(28,_142,_139,_.11)] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[height:100%] [&_input]:[padding:0] [&_input]:[border:0] [&_input]:[outline:0] [&_input]:[color:#233847] [&_input]:[background:transparent] [&_input]:[font-size:12px] [&_input]:[font-weight:450] [&_input::placeholder]:[color:#a7b1b7] [&_input:-webkit-autofill]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:hover]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:focus]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_#fff_inset]"><UserRound size={17} /><input name="lastName" type="text" placeholder="Smith" autoComplete="family-name" minLength={2} maxLength={50} required /></span>
                  </label>
                </div>
              )}

              <label className="field [min-width:0] [display:grid] [gap:8px] [color:#334451] [font-size:11px] [font-weight:650]">
                <span>Email address</span>
                <span className="input-wrap [height:47px] [display:flex] [align-items:center] [gap:10px] [padding:0_13px] [border:1px_solid_#dfe6e7] [border-radius:10px] [color:#8a9aa2] [background:#fff] [transition:border-color_.16s_ease,_box-shadow_.16s_ease,_background_.16s_ease] focus-within:[border-color:#4ca8a5] focus-within:[background:#fff] focus-within:[box-shadow:0_0_0_3px_rgba(28,_142,_139,_.11)] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[height:100%] [&_input]:[padding:0] [&_input]:[border:0] [&_input]:[outline:0] [&_input]:[color:#233847] [&_input]:[background:transparent] [&_input]:[font-size:12px] [&_input]:[font-weight:450] [&_input::placeholder]:[color:#a7b1b7] [&_input:-webkit-autofill]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:hover]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:focus]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_#fff_inset]"><Mail size={17} /><input name="email" type="email" placeholder="you@company.com" autoComplete="email" maxLength={255} required /></span>
              </label>

              {isRegister && (
                <label className="field [min-width:0] [display:grid] [gap:8px] [color:#334451] [font-size:11px] [font-weight:650]">
                  <span>Phone number</span>
                  <span className="input-wrap [height:47px] [display:flex] [align-items:center] [gap:10px] [padding:0_13px] [border:1px_solid_#dfe6e7] [border-radius:10px] [color:#8a9aa2] [background:#fff] [transition:border-color_.16s_ease,_box-shadow_.16s_ease,_background_.16s_ease] focus-within:[border-color:#4ca8a5] focus-within:[background:#fff] focus-within:[box-shadow:0_0_0_3px_rgba(28,_142,_139,_.11)] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[height:100%] [&_input]:[padding:0] [&_input]:[border:0] [&_input]:[outline:0] [&_input]:[color:#233847] [&_input]:[background:transparent] [&_input]:[font-size:12px] [&_input]:[font-weight:450] [&_input::placeholder]:[color:#a7b1b7] [&_input:-webkit-autofill]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:hover]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:focus]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_#fff_inset]"><UserRound size={17} /><input name="phone" type="tel" placeholder="+94771234567" autoComplete="tel" pattern="\+?[0-9]{9,15}" title="Use 9 to 15 digits, with an optional + at the start." required /></span>
                </label>
              )}

              <label className="field [min-width:0] [display:grid] [gap:8px] [color:#334451] [font-size:11px] [font-weight:650]">
                <span>Password</span>
                <span className="input-wrap [height:47px] [display:flex] [align-items:center] [gap:10px] [padding:0_13px] [border:1px_solid_#dfe6e7] [border-radius:10px] [color:#8a9aa2] [background:#fff] [transition:border-color_.16s_ease,_box-shadow_.16s_ease,_background_.16s_ease] focus-within:[border-color:#4ca8a5] focus-within:[background:#fff] focus-within:[box-shadow:0_0_0_3px_rgba(28,_142,_139,_.11)] [&_input]:[width:100%] [&_input]:[min-width:0] [&_input]:[height:100%] [&_input]:[padding:0] [&_input]:[border:0] [&_input]:[outline:0] [&_input]:[color:#233847] [&_input]:[background:transparent] [&_input]:[font-size:12px] [&_input]:[font-weight:450] [&_input::placeholder]:[color:#a7b1b7] [&_input:-webkit-autofill]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:hover]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_#fff_inset] [&_input:-webkit-autofill:focus]:[-webkit-text-fill-color:#233847] [&_input:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_#fff_inset]"><KeyRound size={17} /><input name="password" type={showPassword ? "text" : "password"} placeholder={isRegister ? "At least 8 characters" : "Enter your password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : 1} maxLength={100} required />
                  <button className="password-toggle [width:26px] [height:30px] [flex:0_0_auto] [display:grid] [place-items:center] [padding:0] [border:0] [color:#82929a] [background:transparent] [cursor:pointer] hover:[color:var(--teal)] focus-visible:[outline:3px_solid_rgba(18,_143,_143,_.35)] focus-visible:[outline-offset:3px]" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {isRegister && <small className="field-hint [display:inline-flex] [align-items:center] [gap:5px] [color:#84939a] [font-size:10px] [font-weight:450]"><LockKeyhole size={13} /> Include uppercase, lowercase, a number, and a symbol.</small>}
              </label>

              {!isRegister && <div className="secure-note [display:flex] [align-items:center] [gap:7px] [margin-top:-3px] [color:#82918f] [font-size:10px] [&_svg]:[color:#5a9f8b]"><ShieldCheck size={15} /> Your account is protected with secure sign-in.</div>}

              <button className="submit-button [width:100%] [height:48px] [display:flex] [align-items:center] [justify-content:center] [gap:10px] [margin-top:2px] [border:0] [border-radius:10px] [color:#fff] [background:linear-gradient(100deg,_#087d82,_#087578)] [box-shadow:0_5px_12px_rgba(8,_125,_130,_.16)] [font-size:12px] [font-weight:680] [cursor:pointer] [transition:transform_.16s_ease,_box-shadow_.16s_ease,_background_.16s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] [&:hover:not(:disabled)]:[background:linear-gradient(100deg,_#086e73,_#08696d)] [&:hover:not(:disabled)]:[box-shadow:0_8px_17px_rgba(8,_125,_130,_.2)] focus-visible:[outline:3px_solid_rgba(18,_143,_143,_.35)] focus-visible:[outline-offset:3px] disabled:[opacity:.72] disabled:[cursor:wait]" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
                {!isSubmitting && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="auth-switch [margin-top:24px] [color:#77858d] [text-align:center] [font-size:11px] [&_a]:[color:var(--teal)] [&_a]:[font-weight:700] [&_a]:[text-decoration:none] [&_a:hover]:[color:var(--teal-dark)] [&_a:hover]:[text-decoration:underline] [&_a:hover]:[text-underline-offset:3px]">
              {isRegister ? "Already have an account?" : "New to PrimeWave Lab?"}{" "}
              <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
            </div>

            <div className="form-legal [margin-top:29px] [padding-top:17px] [border-top:1px_solid_#edf0f0] [color:#9aa5aa] [text-align:center] [font-size:9px] [line-height:1.5] max-[680px]:[margin-top:23px]">By continuing, you agree to use PrimeWave Lab responsibly.</div>
          </div>
        </section>
      </section>
    </main>
  );
}
