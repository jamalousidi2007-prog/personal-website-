"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { sendContactInquiry, sendVerificationCode, generateOTP } from "@/lib/emailService";
import { createRateLimiter } from "@/lib/rateLimiter";

import styles from "./page.module.css";

const PROFILE_IMAGE_STORAGE_KEY = "personal_profile_image";
const DEFAULT_PROFILE_IMAGE = "/images/profile.jpg";
const BANNED_MESSAGE_STORAGE_KEY = "personal_site_banned_message";

// Rate limiters: max 5 login attempts per 60 seconds, max 3 contact submissions per 5 minutes
const loginRateLimiter = createRateLimiter("login", 5, 60_000);
const contactRateLimiter = createRateLimiter("contact", 3, 300_000);

// Input sanitization: strip HTML tags to prevent XSS
function sanitizeInput(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, "").slice(0, maxLength).trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginPage() {
  const { lang } = useLanguage();

  const copy = {
    ar: {
      initials: "جو",
      title: "مشاريع المهندس جمال اوسيدي",
      subtitle: "سجل دخولك للوصول إلى المنصة",
      email: "البريد الإلكتروني",
      login: "تسجيل الدخول",
      restricted: "الوصول محمي",
      note: "المشاريع متاحة فقط بعد تسجيل الدخول",
      wrong: "اكتب بريدا إلكترونيا صحيحا",
      banned: "تم حظر هذا الحساب. تواصل مع المسؤول.",
      notRegistered: "هذا البريد غير مسجل. تواصل مع المسؤول.",
      otpSent: "تم إرسال رمز التحقق إلى بريدك",
      otpLabel: "رمز التحقق",
      otpPlaceholder: "أدخل الرمز المكون من 6 أرقام",
      otpWrong: "رمز التحقق غير صحيح",
      otpExpired: "انتهت صلاحية الرمز. أعد الإرسال.",
      resend: "إعادة الإرسال",
      verify: "تأكيد"
    },
    fr: {
      initials: "JO",
      title: "Projets de l'ingenieur Jamal Ousidi",
      subtitle: "Connectez-vous pour acceder a la plateforme",
      email: "E-mail",
      login: "Se connecter",
      restricted: "Acces protege",
      note: "Les projets sont accessibles apres authentification",
      wrong: "Entrez une adresse e-mail valide",
      banned: "Ce compte est bloque. Contactez l'administrateur.",
      notRegistered: "Cet e-mail n'est pas enregistre. Contactez l'administrateur.",
      otpSent: "Code de verification envoye a votre e-mail",
      otpLabel: "Code de verification",
      otpPlaceholder: "Entrez le code a 6 chiffres",
      otpWrong: "Code de verification incorrect",
      otpExpired: "Code expire. Renvoyez-le.",
      resend: "Renvoyer",
      verify: "Verifier"
    },
    en: {
      initials: "JO",
      title: "Engineer Jamal Ousidi Projects",
      subtitle: "Sign in to access the platform",
      email: "Email",
      login: "Sign In",
      restricted: "Protected access",
      note: "Projects are available after authentication",
      wrong: "Enter a valid email address",
      banned: "This account is banned. Contact the administrator.",
      notRegistered: "This email is not registered. Contact the administrator.",
      otpSent: "Verification code sent to your email",
      otpLabel: "Verification Code",
      otpPlaceholder: "Enter the 6-digit code",
      otpWrong: "Invalid verification code",
      otpExpired: "Code expired. Please resend.",
      resend: "Resend",
      verify: "Verify"
    }
  } as const;

  const t = copy[lang];
  const googleLabel =
    lang === "ar"
      ? "الدخول عبر Google"
      : lang === "fr"
        ? "Continuer avec Google"
        : "Continue with Google";

  const router = useRouter();
  const [nextUrl, setNextUrl] = useState("/home");
  const [profileImage, setProfileImage] = useState(DEFAULT_PROFILE_IMAGE);

  const { user, loading, signIn, signInWithEmail, signInWithGoogle } = useAuth();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [busy, setBusy] = useState(false);
const [error, setError] = useState<string | null>(null);

// OTP verification state
const [showOTP, setShowOTP] = useState(false);
const [otpInput, setOtpInput] = useState("");
const [generatedOTP, setGeneratedOTP] = useState("");
const [otpTimestamp, setOtpTimestamp] = useState(0);
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Contact form state
const [showContactForm, setShowContactForm] = useState(false);
const [contactName, setContactName] = useState("");
const [contactEmail, setContactEmail] = useState("");
const [contactPhone, setContactPhone] = useState("");
const [contactMessage, setContactMessage] = useState("");
const [contactBusy, setContactBusy] = useState(false);
const [contactSent, setContactSent] = useState(false);
const [contactError, setContactError] = useState<string | null>(null);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/home";
  // Prevent open redirect: only allow relative paths starting with /
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  setNextUrl(safeNext);
  const bannedMessage = localStorage.getItem(BANNED_MESSAGE_STORAGE_KEY);
  if (bannedMessage) {
    setError(bannedMessage);
    localStorage.removeItem(BANNED_MESSAGE_STORAGE_KEY);
  }
}, []);

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY);
    if (saved) setProfileImage(saved);
  }, []);

  useEffect(() => {
    console.log("[Login] useEffect check: loading=", loading, "user=", user?.email ?? "null", "nextUrl=", nextUrl);
    if (!loading && user) {
      console.log("[Login] Redirecting to:", nextUrl);
      router.replace(nextUrl);
    }
  }, [loading, nextUrl, router, user]);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const isSuperAdminEmail = (value: string) => normalizeEmail(value) === SUPER_ADMIN_EMAIL;
  const showPassword = isSuperAdminEmail(email);

const onSubmit = async (event: FormEvent) => {
  event.preventDefault();

  // Rate limiting check
  if (!loginRateLimiter.tryAcquire()) {
    const retryAfter = loginRateLimiter.retryAfterSeconds();
    setError(
      lang === "ar" ? `عدد محاولات كبير. حاول بعد ${retryAfter} ثانية.` :
      lang === "fr" ? `Trop de tentatives. Reessayez dans ${retryAfter}s.` :
      `Too many attempts. Try again in ${retryAfter}s.`
    );
    return;
  }

  const emailNormalized = normalizeEmail(email);
  if (!isValidEmail(emailNormalized)) {
    setError(t.wrong);
    return;
  }

  setError(null);
  setBusy(true);

  try {
    // Super admin uses password, skip OTP
    if (isSuperAdminEmail(emailNormalized)) {
      await signIn(emailNormalized, password);
      loginRateLimiter.reset();
      router.replace(nextUrl);
      return;
    }

    // Regular users: OTP verification required
    if (!showOTP) {
      // Step 1: Send OTP code
      const code = generateOTP();
      const sent = await sendVerificationCode(emailNormalized, code);
      
      if (!sent) {
        setError(lang === "ar" ? "فشل إرسال الرمز. حاول مرة أخرى." :
                 lang === "fr" ? "Echec de l'envoi du code. Reessayez." :
                 "Failed to send code. Please try again.");
        setBusy(false);
        return;
      }
      
      setGeneratedOTP(code);
      setOtpTimestamp(Date.now());
      setShowOTP(true);
      setBusy(false);
      return;
    }

    // Step 2: Verify OTP code
    if (Date.now() - otpTimestamp > OTP_EXPIRY_MS) {
      setError(t.otpExpired);
      setShowOTP(false);
      setBusy(false);
      return;
    }

    if (otpInput.trim() !== generatedOTP) {
      setError(t.otpWrong);
      setBusy(false);
      return;
    }

    // OTP verified - proceed with login
    console.log("[Login] OTP verified, signing in...");
    await signInWithEmail(emailNormalized);
    console.log("[Login] signInWithEmail successful");
    loginRateLimiter.reset();
    router.replace(nextUrl);
  } catch (err) {
    console.error("[Login] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    console.log("[Login] Error message:", message);
    
    // Check for specific error messages
    if (message.includes("ACCESS_BANNED")) {
      setError(t.banned);
    } else if (message.includes("EMAIL_NOT_REGISTERED") || message.includes("not registered")) {
      setError(t.notRegistered);
    } else if (message.includes("timeout") || message.includes("Firestore")) {
      setError(lang === "ar" ? "خطأ في الاتصال. حاول مرة أخرى." :
               lang === "fr" ? "Erreur de connexion. Reessayez." :
               "Connection error. Please try again.");
    } else {
      // Show the actual error message for debugging
      setError(message || t.wrong);
    }
  } finally {
    setBusy(false);
  }
};

const handleResendOTP = async () => {
  setError(null);
  setBusy(true);
  
  const emailNormalized = normalizeEmail(email);
  const code = generateOTP();
  const sent = await sendVerificationCode(emailNormalized, code);
  
  if (!sent) {
    setError(lang === "ar" ? "فشل إرسال الرمز. حاول مرة أخرى." :
             lang === "fr" ? "Echec de l'envoi du code. Reessayez." :
             "Failed to send code. Please try again.");
  } else {
    setGeneratedOTP(code);
    setOtpTimestamp(Date.now());
    setOtpInput("");
  }
  setBusy(false);
};

  const onGoogleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Page will redirect to Google - nothing else to do here
    } catch (err) {
      setBusy(false);
      console.error("[Google Login Error]", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t.wrong);
    }
  };

  const onContactSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setContactError(null);

    // Rate limiting check
    if (!contactRateLimiter.tryAcquire()) {
      const retryAfter = contactRateLimiter.retryAfterSeconds();
      setContactError(
        lang === "ar" ? `عدد إرسال كبير. حاول بعد ${retryAfter} ثانية.` :
        lang === "fr" ? `Trop d'envois. Reessayez dans ${retryAfter}s.` :
        `Too many submissions. Try again in ${retryAfter}s.`
      );
      return;
    }

    // Sanitize inputs with length limits
    const cleanName = sanitizeInput(contactName, 100);
    const cleanEmail = sanitizeInput(contactEmail, 254);
    const cleanPhone = sanitizeInput(contactPhone, 20);
    const cleanMessage = sanitizeInput(contactMessage, 2000);

    if (!cleanName || !cleanEmail || !cleanMessage) {
      setContactError(
        lang === "ar" ? "يرجى ملء جميع الحقول المطلوبة" :
        lang === "fr" ? "Veuillez remplir tous les champs obligatoires" :
        "Please fill in all required fields"
      );
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setContactError(
        lang === "ar" ? "يرجى إدخال بريد إلكتروني صحيح" :
        lang === "fr" ? "Veuillez entrer un e-mail valide" :
        "Please enter a valid email address"
      );
      return;
    }

    setContactBusy(true);
    try {
      const success = await sendContactInquiry({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        message: cleanMessage
      });
      if (success) {
        setContactSent(true);
      } else {
        setContactError(
          lang === "ar" ? "فشل الإرسال. حاول مرة أخرى." :
          lang === "fr" ? "Echec de l'envoi. Reessayez." :
          "Failed to send. Please try again."
        );
      }
    } catch {
      setContactError(
        lang === "ar" ? "حدث خطأ. حاول مرة أخرى." :
        lang === "fr" ? "Une erreur s'est produite. Reessayez." :
        "An error occurred. Please try again."
      );
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="container">
        <section className={styles.page}>
          <form className={styles.card} onSubmit={onSubmit}>
            <div className={styles.loginAvatarBtn}>
              <div className={styles.loginAvatar}>
                <img src={profileImage} alt="profile" />
              </div>
            </div>
            <h2>{t.title}</h2>
            <p className={styles.sub}>{t.subtitle}</p>

<label className={styles.field}>
  <span>{t.email}</span>
  <input
    type="email"
    value={email}
    onChange={(e) => {
      const nextEmail = e.target.value;
      setEmail(nextEmail);
      if (!isSuperAdminEmail(nextEmail)) setPassword("");
    }}
    placeholder="example@gmail.com"
    autoComplete="email"
    required
  />
</label>
{showPassword && (
  <label className={styles.field}>
    <span>كلمة المرور</span>
    <input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="كلمة المرور"
      autoComplete="current-password"
      required
    />
  </label>
)}

{showOTP && (
  <>
    <p className={styles.notice}>{t.otpSent}</p>
    <label className={styles.field}>
      <span>{t.otpLabel}</span>
      <input
        type="text"
        value={otpInput}
        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder={t.otpPlaceholder}
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
        dir="ltr"
        required
        autoFocus
      />
    </label>
    <button
      type="button"
      className={styles.secondaryBtn}
      onClick={handleResendOTP}
      disabled={busy}
    >
      {t.resend}
    </button>
  </>
)}

            <button className={styles.btn} type="submit" disabled={busy}>
              {busy ? "..." : (showOTP ? t.verify : t.login)}
            </button>

            <button
              className={styles.googleBtn}
              type="button"
              disabled={busy}
              onClick={onGoogleLogin}
            >
              {googleLabel}
            </button>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.footer}>
              {t.restricted}
              <br />
              {t.note}
            </div>
          </form>

          {/* Contact Button - Use this site for 1000 MAD/month */}
          {!showContactForm && (
            <button
              className={styles.offerBtn}
              onClick={() => setShowContactForm(true)}
            >
              {lang === "ar" ? "\u{1F680} \u0627\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0642\u0639 \u0628\u0640 1000 \u062F\u0631\u0647\u0645/\u0634\u0647\u0631" :
               lang === "fr" ? "\u{1F680} Utilisez ce site a 1000 MAD/mois" :
               "\u{1F680} Use this site for 1000 MAD/month"}
            </button>
          )}

          {showContactForm && (
            <div className={styles.contactCard}>
              {contactSent ? (
                <div className={styles.contactSuccess}>
                  <div className={styles.successIcon}>{"\u2705"}</div>
                  <h3>
                    {lang === "ar" ? "\u0634\u0643\u0631\u0627\u064B \u0644\u0643!" :
                     lang === "fr" ? "Merci!" :
                     "Thank you!"}
                  </h3>
                  <p>
                    {lang === "ar" ? "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u062A\u0643 \u0628\u0646\u062C\u0627\u062D. \u0633\u0646\u062A\u0635\u0644 \u0628\u0643 \u0642\u0631\u064A\u0628\u0627\u064B.\u0625\u0646 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647.\u0625\u0646 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647." :
                     lang === "fr" ? "Votre message a ete envoy avec succes. Nous vous contacterons bientot." :
                     "Your message has been sent successfully. We'll contact you soon."}
                  </p>
                  <button
                    className={styles.contactCloseBtn}
                    onClick={() => {
                      setShowContactForm(false);
                      setContactSent(false);
                      setContactName("");
                      setContactEmail("");
                      setContactPhone("");
                      setContactMessage("");
                    }}
                  >
                    {lang === "ar" ? "\u0625\u063A\u0644\u0627\u0642" : lang === "fr" ? "Fermer" : "Close"}
                  </button>
                </div>
              ) : (
                <form className={styles.contactForm} onSubmit={onContactSubmit}>
                  <h3 className={styles.contactTitle}>
                    {lang === "ar" ? "\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627" :
                     lang === "fr" ? "Contactez-nous" :
                     "Contact Us"}
                  </h3>
                  <p className={styles.contactSub}>
                    {lang === "ar" ? "\u0623\u062D\u0635\u0644 \u0639\u0644\u0649 \u0645\u0648\u0642\u0639 \u0645\u062B\u0644 \u0647\u0630\u0627 \u0628\u0640 1000 \u062F\u0631\u0647\u0645/\u0634\u0647\u0631" :
                     lang === "fr" ? "Obtenez un site comme celui-ci a 1000 MAD/mois" :
                     "Get a website like this for 1000 MAD/month"}
                  </p>

                  <label className={styles.contactField}>
                    <span>{lang === "ar" ? "\u0627\u0644\u0627\u0633\u0645 *" : lang === "fr" ? "Nom *" : "Name *"}</span>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder={lang === "ar" ? "\u0627\u0633\u0645\u0643 \u0627\u0644\u0643\u0627\u0645\u0644" : "Your full name"}
                      maxLength={100}
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label className={styles.contactField}>
                    <span>{lang === "ar" ? "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A *" : lang === "fr" ? "E-mail *" : "Email *"}</span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      maxLength={254}
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className={styles.contactField}>
                    <span>{lang === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641" : lang === "fr" ? "Téléphone" : "Phone"}</span>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+212 6XX XXX XXX"
                      maxLength={20}
                      autoComplete="tel"
                      dir="ltr"
                    />
                  </label>

                  <label className={styles.contactField}>
                    <span>{lang === "ar" ? "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 *" : lang === "fr" ? "Message *" : "Message *"}</span>
                    <textarea
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder={lang === "ar" ? "\u0627\u0643\u062A\u0628 \u0631\u0633\u0627\u0644\u062A\u0643 \u0647\u0646\u0627..." : "Write your message here..."}
                      rows={3}
                      maxLength={2000}
                      required
                    />
                  </label>

                  {contactError && <p className={styles.error}>{contactError}</p>}

                  <button className={styles.contactSendBtn} type="submit" disabled={contactBusy}>
                    {contactBusy ? "..." : (lang === "ar" ? "\u0625\u0631\u0633\u0627\u0644" : lang === "fr" ? "Envoyer" : "Send")}
                  </button>

                  <button
                    className={styles.contactCancelBtn}
                    type="button"
                    onClick={() => {
                      setShowContactForm(false);
                      setContactError(null);
                    }}
                  >
                    {lang === "ar" ? "\u0625\u0644\u063A\u0627\u0621" : lang === "fr" ? "Annuler" : "Cancel"}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
