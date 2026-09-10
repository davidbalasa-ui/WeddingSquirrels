/** Production-like local simulation fingerprint. Do not write production. */

export const MASTER_ACCOUNT_ID = "cmtonz4ma0000jsuyf9ra47of";
export const RESTRICTED_ACCOUNT_ID = "cmtonz4r50002jsuyknc1ve1n";

export const MONEY = {
  items: 24,
  committed: "$21,485.83",
  paid: "$9,167.22",
  remaining: "$12,318.61",
};

export const WEDDING_TITLES = [
  "Settle in at Airbnb",
  "Venue Opens",
  "Vendor + Wedding Party Arrival",
  "Hair & makeup at Airbnb",
  "Wedding party packs up",
  "Wedding party leaves Airbnb",
  "Quiet time at the Airbnb",
  "Photographer arrives",
  "Final getting ready",
  "Getting dressed",
  "First Look + Portraits",
  "Pre-Ceremony Transition",
  "Ceremony",
  "Cocktail Hour",
  "Dinner begins",
  "Toasts + Cake cutting",
  "First dances",
  "Open Dancing",
  "Tear down / Clean up",
];

export const REHEARSAL_TITLES = [
  "Airbnb Check-in",
  "Get ready",
  "Depart Airbnb",
  "Dinner",
  "Depart for Black Sheep Shelter",
  "Rehearsal",
  "Return to Airbnb",
];

export const DAY_OF_CONTACTS = [
  "Avalon Green",
  "Black Sheep Shelter",
  "Barry Tilson",
  "Belle Genton · Videographer",
  "Precious Peony",
  "Shelly Wiewiora",
  "Wendy Rush",
];

export const SHOPPING_ITEMS = ["Smores Marshmallows", "Grahams Crackers", "Herseys 6 pack"];

export const ASSIGNMENTS = ["Get 100 lbs of Ice", "Prep Smores Station foods", "Cater in Lunch"];

export const PRIMARY_NAV = ["Today", "Plan", "People", "Money", "More"] as const;

export const AUTH_ROUTES: Array<{ path: string; expect: RegExp }> = [
  { path: "/today", expect: /David & Haley|Today/i },
  { path: "/day", expect: /Wedding day|Here's how the day is planned|Today/i },
  { path: "/day/assignments", expect: /Assignments/i },
  { path: "/day/mc", expect: /MC Run of Show/i },
  { path: "/day/hair-makeup", expect: /Hair & Makeup/i },
  { path: "/day/shots", expect: /Photo Shot List/i },
  { path: "/day/decor", expect: /Decor/i },
  { path: "/people", expect: /Everyone making this wedding happen/i },
  { path: "/plan", expect: /Everything that gets us/i },
  { path: "/plan/tasks", expect: /^Tasks$|Tasks/ },
  { path: "/plan/timeline", expect: /Wedding Day/i },
  { path: "/plan/rehearsal", expect: /Rehearsal/i },
  { path: "/plan/stay", expect: /Stay/ },
  { path: "/plan/shopping", expect: /Shopping/ },
  { path: "/plan/calendar", expect: /Calendar/ },
  { path: "/money", expect: /Committed|Know what we’ve committed|Know what we've committed/i },
  { path: "/money/due", expect: /Due|Nothing is due|Nothing coming due/i },
  { path: "/money/history", expect: /History|No payments recorded|paid/i },
  { path: "/money/print", expect: /Print|Committed|Money/i },
  { path: "/print", expect: /Wedding Binder & Print/i },
  { path: "/more", expect: /More|Wedding Binder & Print|Offline/i },
  { path: "/accounts", expect: /Accounts|Add account/i },
  { path: "/people/vendors", expect: /Vendor|People|Search/i },
  { path: "/guests/print", expect: /Gift|Guest|Print/i },
];

export const ALIAS_ROUTES: Array<{ path: string; expectPath: RegExp }> = [
  { path: "/home", expectPath: /\/today/ },
  { path: "/requests", expectPath: /\/today/ },
  { path: "/shop", expectPath: /\/plan\/shopping/ },
  { path: "/stay", expectPath: /\/plan\/stay/ },
  { path: "/calendar", expectPath: /\/plan\/calendar/ },
  { path: "/rehearsal", expectPath: /\/plan\/rehearsal/ },
  { path: "/dinner", expectPath: /\/(plan\/)?rehearsal/ },
  { path: "/guests", expectPath: /\/people/ },
  { path: "/people/guests", expectPath: /\/people/ },
  { path: "/people/contacts", expectPath: /\/people/ },
  { path: "/people/responsibilities", expectPath: /\/day\/assignments/ },
  { path: "/day/now", expectPath: /\/day/ },
  { path: "/day/contacts", expectPath: /\/people/ },
];

export const CERT_PREFIX = "CERT-WS";

export const SECRET_LEAK = /pinHash|DATABASE_URL|PIN_SESSION_SECRET|postgres:\/\//;
