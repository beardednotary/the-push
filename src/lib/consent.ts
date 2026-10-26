// Google Analytics consent. Visitors in the EEA, the UK and Switzerland are asked first and
// GA doesn't load until they allow it; elsewhere it loads unless the visitor turned it off
// on the privacy page. An unknown country (no cookie yet) is treated as needing consent.
export const GA_ID = "G-S6FRGZN0WQ";
export const COUNTRY_COOKIE = "push_cc"; // set by middleware from Vercel's geolocation
export const CONSENT_KEY = "push:analytics"; // localStorage: "granted" | "denied"

// EU 27, plus Iceland, Liechtenstein, Norway, the UK and Switzerland
const ASK = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "));

export function needsConsent(country: string | null | undefined): boolean {
  return !country || ASK.has(country.toUpperCase());
}
