// Where Tethr lives, plus the facts its public homepage, privacy policy and terms of service share.
// Google's OAuth verification checks those pages, so keep them in step with what the app does.

// Public site (homepage + legal pages). The proxy serves only those pages on this host.
export const SITE_URL = "https://tethr.aswin-ambalathara.space"
export const SITE_HOST = new URL(SITE_URL).host

// The web app (dashboard, sign-in, settings)
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export const CONTACT_EMAIL = "aswinnairtm@gmail.com"
export const OPERATOR_NAME = "Aswin Nair T M"
export const LEGAL_LAST_UPDATED = "October 14, 2026"
