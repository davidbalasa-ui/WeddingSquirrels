/**
 * David and Haley's mini moon, from David on 2026-10-10: his message ("We have the
 * mini moon booked until Tuesday. We check out at noon. We have massages on Saturday
 * afternoon and Tuesday at noon.") and his screenshot of Victoria Resort's listing.
 * It prints only where Stay prints: the binder and the Bride's Packet.
 */
export const MINI_MOON = {
  title: "Mini moon · Victoria Resort",
  lines: [
    "241 Oak St, South Haven, MI 49090",
    "(269) 637-6414 · victoriaresort.com",
    "Booked until Tuesday, October 20. Check out at noon.",
    "Massages: Saturday, October 17 in the afternoon, and Tuesday, October 20 at noon.",
  ],
} as const;

/** The contact the Apply card adds so Victoria Resort shows with the other contacts. */
export const MINI_MOON_CONTACT = {
  name: "Victoria Resort",
  phone: "(269) 637-6414",
  directoryLabel: "Mini moon",
} as const;

/** David, 2026-10-11 12:27: "Here is band member Steves info to add. +17346463360". Added like Victoria Resort. */
export const BAND_CONTACT = {
  name: "Steve Crossbow",
  phone: "(734) 646-3360",
  directoryLabel: "Band",
} as const;

/**
 * David, 2026-10-11 14:44: "269-635-8458 is dans phone number for the get away vehicle".
 * The getaway is a surprise for Haley, so the Bride's Packet leaves this contact out.
 */
export const GETAWAY_DRIVER_CONTACT = {
  name: "Dan Vandenheede",
  phone: "(269) 635-8458",
  directoryLabel: "Getaway vehicle",
} as const;
