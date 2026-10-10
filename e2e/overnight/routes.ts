/** Every page the app has, with a word that proves the right page opened. */
export const ROUTES: Array<{ path: string; expect: RegExp }> = [
  { path: "/today", expect: /David & Haley|Today/i },
  { path: "/day", expect: /Wedding day|planned|Today/i },
  { path: "/day?asOf=2026-10-16T15:35", expect: /Ceremony/i },
  { path: "/day/mc", expect: /MC Run of Show/i },
  { path: "/day/assignments", expect: /Assignments|jobs/i },
  { path: "/day/contacts", expect: /Contacts/i },
  { path: "/day/hair-makeup", expect: /Hair/i },
  { path: "/day/shots", expect: /Shot/i },
  { path: "/day/decor", expect: /Decor/i },
  { path: "/plan", expect: /Everything|Plan/i },
  { path: "/plan/timeline", expect: /Wedding Day/i },
  { path: "/plan/timeline?edit=1", expect: /Add moment/i },
  { path: "/plan/rehearsal", expect: /Rehearsal/i },
  { path: "/people", expect: /People|wedding happen/i },
  { path: "/print", expect: /Wedding Binder & Print/i },
  { path: "/more", expect: /More|Offline/i },
];
