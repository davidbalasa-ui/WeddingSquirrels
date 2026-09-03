/** Approved Phase 1B-1 identity mutations. Counts must stay internally consistent. */

export const PHASE_1B1_EXPECTED_START = {
  persons: 22,
  guestPeople: 88,
  contacts: 7,
  mealGuests: 17,
} as const;

export const PHASE_1B1_EXPECTED_END = {
  persons: 84,
  guestPeopleLinked: 72,
  contactsLinked: 1,
  mealGuestsLinked: 0,
} as const;

export type CreatePerson = {
  id: string;
  name: string;
  guestPersonIds: string[];
};

export const PHASE_1B1_CREATES: CreatePerson[] = [
  { id: "adam_crossbow", name: "Adam Crossbow", guestPersonIds: ["cmtkc8dft000hjl04n6q3wywn"] },
  { id: "adam_suedmeier", name: "Adam Suedmeier", guestPersonIds: ["cmsx9u62w001bjsjrrsv14ncv"] },
  { id: "agust_olaffson", name: "Agust Olaffson", guestPersonIds: ["cmsx9u5we0012jsjroc64w90m"] },
  { id: "andi_cartwright", name: "Andi Cartwright", guestPersonIds: ["cmsx9u67t001fjsjrreg6i74k"] },
  { id: "anthony_owens", name: "Anthony Owens", guestPersonIds: ["cmsx9u5t60010jsjr0o0rs003"] },
  { id: "arianna_devros", name: "Arianna Devros", guestPersonIds: ["cmsx9u5y00015jsjrqh744t44"] },
  { id: "austin_fleener", name: "Austin Fleener", guestPersonIds: ["cmsx9u5jg000pjsjrqvpv9vow"] },
  { id: "benjamin_balasa", name: "Benjamin Balasa", guestPersonIds: ["cmsx9u5ay000ijsjr553nzwx0"] },
  { id: "braxton_wasilewski", name: "Braxton Wasilewski", guestPersonIds: ["cmsx9u64i001cjsjrolr9wtc7"] },
  { id: "bryan_balasa", name: "Bryan Balasa", guestPersonIds: ["cmsx9u4z80003jsjr7c7cncy6"] },
  { id: "carly_crossbow", name: "Carly Crossbow", guestPersonIds: ["cmtkc8dft000ljl04b4wkagkm"] },
  { id: "carrie_foura", name: "Carrie Foura", guestPersonIds: ["cmsx9u5we0013jsjrf4ncn59o"] },
  { id: "clare_crossbow", name: "Clare Crossbow", guestPersonIds: ["cmtkc8dft000gjl04uge027cp"] },
  { id: "cynthia_berman", name: "Cynthia Berman", guestPersonIds: ["cmsx9u5440008jsjr08qrktei"] },
  { id: "denise_bordeaux", name: "Denise Bordeaux", guestPersonIds: ["cmtj9idgd0008l104qr38menz"] },
  { id: "elisha_balasa", name: "Elisha Balasa", guestPersonIds: ["cmtkhqqg1000hkz04cpl6iwh8"] },
  { id: "elizabeth_hammond", name: "Elizabeth Hammond", guestPersonIds: ["cmsx9u5cz000jjsjrzr3ld82h"] },
  { id: "erica_pallas", name: "Erica Pallas", guestPersonIds: ["cmsx9u6190018jsjrongal3o2"] },
  { id: "esther_hammond", name: "Esther Hammond", guestPersonIds: ["cmtkhqq7p0003kz04q7p3f588"] },
  { id: "ethan_crossbow", name: "Ethan Crossbow", guestPersonIds: ["cmtkc8dft000ijl04zeb5q2pg"] },
  { id: "evan_eling", name: "Evan Eling", guestPersonIds: ["cmsx9u665001ejsjrllqnrtpq"] },
  { id: "finn_olaffson", name: "Finn Olaffson", guestPersonIds: ["cmtkhqqcq000bkz04rl62hwfy"] },
  { id: "grace_brown", name: "Grace Brown", guestPersonIds: ["cmsx9u5l3000qjsjr8tku3bwz"] },
  { id: "hannah_balasa", name: "Hannah Balasa", guestPersonIds: ["cmsxaev5g0001l104nxgcj2rw"] },
  { id: "isaac_balasa", name: "Isaac Balasa", guestPersonIds: ["cmtkc8dc20004jl0428lwsm24"] },
  { id: "jared_fleener", name: "Jared Fleener", guestPersonIds: ["cmsx9u5zm0016jsjr1tgtesqx"] },
  { id: "jay_mcmann", name: "Jay McMann", guestPersonIds: ["cmsx9u5y00014jsjr8vmoqe5x"] },
  { id: "jennifer_hammond", name: "Jennifer Hammond", guestPersonIds: ["cmtkhqq780001kz04hhqlz62x"] },
  { id: "jeremy_hammond", name: "Jeremy Hammond", guestPersonIds: ["cmsx9u5cz000kjsjrsrp3kgr2"] },
  { id: "joe_crossbow", name: "Joe Crossbow", guestPersonIds: ["cmtkc8dft000jjl04lll19a6x"] },
  { id: "john_wiewiora", name: "John Wiewiora", guestPersonIds: ["cmsx9u4wm0001jsjr78b3245i"] },
  { id: "josh_kippe", name: "Josh Kippe", guestPersonIds: ["cmsx9u5px000xjsjrjf66igja"] },
  { id: "juniper_wiewiora", name: "Juniper Wiewiora", guestPersonIds: ["cmsx9u59c000gjsjr6e8q92s6"] },
  { id: "kaylie_cartwright", name: "Kaylie Cartwright", guestPersonIds: ["cmsx9u62w001ajsjr2zbkicvl"] },
  { id: "ken_brown", name: "Ken Brown", guestPersonIds: ["cmsx9u5l3000rjsjrfwcth984"] },
  { id: "leslie_berman", name: "Leslie Berman", guestPersonIds: ["cmsx9u52h0006jsjrskvdknta"] },
  { id: "liliana_balasa", name: "Liliana Balasa", guestPersonIds: ["cmtkhqqg7000jkz04dxr8jhrd"] },
  { id: "lisa_pelfresne", name: "Lisa Pelfresne", guestPersonIds: ["cmtj9idgz000al104p0fue35e"] },
  { id: "mari_petey", name: "Mari Petey", guestPersonIds: ["cmtj9id2n0000l104xs4nalr1"] },
  { id: "marie_fleener", name: "Marie Fleener", guestPersonIds: ["cmsx9u5zm0017jsjrma211inj"] },
  { id: "marie_wiewiora", name: "Marie Wiewiora", guestPersonIds: ["cmsx9u59c000fjsjr43qzbpua"] },
  { id: "mary_ramos", name: "Mary Ramos", guestPersonIds: ["cmsx9u5rj000yjsjruwkvcj0a"] },
  { id: "meira_balasa", name: "Meira Balasa", guestPersonIds: ["cmtkc8dc20003jl041xh0bnj3"] },
  { id: "mike_crossbow", name: "Mike Crossbow", guestPersonIds: ["cmtkc8dft000kjl04jsdqss6g"] },
  { id: "morgan_black", name: "Morgan Black", guestPersonIds: ["cmsx9u5ob000ujsjrmg2zag59"] },
  { id: "mykah_mckay", name: "Mykah Mckay", guestPersonIds: ["cmsx9u5el000mjsjr75p5psap"] },
  { id: "owen_clearwater", name: "Owen Clearwater", guestPersonIds: ["cmtj9id5p0006l104rn7zjxqg"] },
  { id: "pamela_balasa", name: "Pamela Balasa", guestPersonIds: ["cmsx9u4z80002jsjrssixgo2j"] },
  { id: "phloy_wongvilart", name: "Phloy Wongvilart", guestPersonIds: ["cmtj9id5p0005l1049r8i02zd"] },
  { id: "rowan_wiewiora", name: "Rowan Wiewiora", guestPersonIds: ["cmsx9u59c000hjsjro1om7jp1"] },
  { id: "siggi_olaffson", name: "Siggi Olaffson", guestPersonIds: ["cmtkhqqck0009kz04rwo1kjqu"] },
  { id: "steve_crossbow", name: "Steve Crossbow", guestPersonIds: ["cmtkc8dfa000ejl04j611tgg7"] },
  { id: "susan_berman", name: "Susan Berman", guestPersonIds: ["cmsx9u55q000bjsjrf7eyf0q9"] },
  { id: "tess_guess", name: "Tess Guess", guestPersonIds: ["cmtj9id4m0003l104734dv347"] },
  { id: "tracy_gomez", name: "Tracy Gomez", guestPersonIds: ["cmsx9u50u0004jsjrppvjr81s"] },
  { id: "trinity_medler", name: "Trinity Medler", guestPersonIds: ["cmsx9u69f001gjsjrvexbzpl0"] },
  { id: "victoria_owens", name: "Victoria Owens", guestPersonIds: ["cmsx9u5t6000zjsjrv9cvo65c"] },
  {
    id: "evan_wiewiora",
    name: "Evan Wiewiora",
    guestPersonIds: ["cmtkj5b460001ju0477nfqkiw", "cmsx9u57c000cjsjr5chkdp16"],
  },
  {
    id: "scarlett_wiewiora",
    name: "Scarlett Wiewiora",
    guestPersonIds: ["cmsx9u57c000ejsjrhkzhncz5", "cmtkj5b4c0003ju04hc7upiut"],
  },
  {
    id: "gusti_olaffson",
    name: "Gusti Olaffson",
    guestPersonIds: ["cmtkc8dfa000bjl04by9wt6mo", "cmtkhqqcw000dkz04u7fmz9nt"],
  },
  { id: "david_berman", name: "David Berman", guestPersonIds: ["cmsx9u55q000ajsjrsdec03a8"] },
  { id: "katie_kippe", name: "Katie Kippe", guestPersonIds: ["cmsx9u5px000wjsjrrej8qsnn"] },
];

export const PHASE_1B1_RENAMES: Array<{ id: string; fromName: string; toName: string }> = [
  { id: "bri", fromName: "Bri", toName: "Bri Eling" },
  { id: "shelly", fromName: "Shelly", toName: "Shelly Wiewiora" },
  { id: "skila", fromName: "Skila", toName: "Skila Goins" },
  { id: "kurt", fromName: "Kurt", toName: "Kurt Huizenga" },
  { id: "harmony", fromName: "Harmony", toName: "Harmony Balasa" },
  { id: "melody", fromName: "Melody", toName: "Melody Balasa" },
];

export const PHASE_1B1_EXISTING_GUEST_LINKS: Array<{ guestPersonId: string; personId: string }> = [
  { guestPersonId: "cmsx9u69f001hjsjr15y358dt", personId: "bri" },
  { guestPersonId: "cmsx9u4wm0000jsjre3ntbn7l", personId: "shelly" },
  { guestPersonId: "cmsx9u5el000ljsjr10f4ukuw", personId: "skila" },
  { guestPersonId: "cmsx9u5mp000tjsjr2swj3psj", personId: "kurt" },
  { guestPersonId: "cmtkhqqgt000lkz04kcb60mcy", personId: "harmony" },
  { guestPersonId: "cmsx9u5g7000njsjrmdhuv4a0", personId: "melody" },
  { guestPersonId: "cmsx9u5mp000sjsjrf4bvi12b", personId: "wendy_rush" },
];

export const PHASE_1B1_CONTACT_LINKS: Array<{ contactId: string; personId: string }> = [
  { contactId: "cmtksa1gc0000ih04vwuu5age", personId: "belle_genton" },
];

export function phase1b1GuestPersonLinks(): Array<{ guestPersonId: string; personId: string }> {
  const fromCreates = PHASE_1B1_CREATES.flatMap((row) =>
    row.guestPersonIds.map((guestPersonId) => ({ guestPersonId, personId: row.id })),
  );
  return [...fromCreates, ...PHASE_1B1_EXISTING_GUEST_LINKS];
}

export function assertPhase1b1Manifest(): void {
  if (PHASE_1B1_CREATES.length !== 62) {
    throw new Error(`CREATE count ${PHASE_1B1_CREATES.length} != 62`);
  }
  if (PHASE_1B1_RENAMES.length !== 6) {
    throw new Error(`RENAME count ${PHASE_1B1_RENAMES.length} != 6`);
  }
  const guestLinks = phase1b1GuestPersonLinks();
  if (guestLinks.length !== 72) {
    throw new Error(`GuestPerson LINK count ${guestLinks.length} != 72`);
  }
  if (PHASE_1B1_CONTACT_LINKS.length !== 1) {
    throw new Error(`Contact LINK count ${PHASE_1B1_CONTACT_LINKS.length} != 1`);
  }
  const createIds = PHASE_1B1_CREATES.map((row) => row.id);
  if (new Set(createIds).size !== 62) throw new Error("duplicate CREATE Person ids");
  const gpIds = guestLinks.map((row) => row.guestPersonId);
  if (new Set(gpIds).size !== 72) throw new Error("duplicate GuestPerson link ids");
  const start = PHASE_1B1_EXPECTED_START.persons + PHASE_1B1_CREATES.length;
  if (start !== PHASE_1B1_EXPECTED_END.persons) {
    throw new Error(`Person end count ${start} != ${PHASE_1B1_EXPECTED_END.persons}`);
  }
}
