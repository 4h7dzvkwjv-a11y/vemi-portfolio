const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export const supabaseCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: false,
  maxAge: COOKIE_MAX_AGE_SECONDS,
};
