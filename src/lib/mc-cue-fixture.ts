/** Shared production-shaped MC cue blocks for tests. Not a second schedule. */
export const PRODUCTION_CUE_BLOCKS = [
  {
    startAt: "10:30 AM",
    endAt: null,
    notes: "Venue Opens\nVenue:\n- vendors\n- coordinator Avalon\n- MC Kurt",
    sortOrder: 1,
  },
  {
    startAt: "3:15 PM",
    endAt: "3:30 PM",
    notes:
      "Pre-Ceremony Transition\n- guests arrive\nPlaylist: While They Wait 3:00–3:30\nMC cue 3:25 PM: \"Friends and travelers, welcome! Our ceremony will begin shortly. Please find your seats and silence your phones as we prepare to witness David and Haley begin their next chapter.\"",
    sortOrder: 11,
  },
  {
    startAt: "3:30 PM",
    endAt: "4:00 PM",
    notes:
      "Ceremony\nUnder the shelter\nPlaylist: Walking Down The Aisle\nMC cue at 4:00: \"The ceremony has concluded - let the celebration begin!\"",
    sortOrder: 12,
  },
  {
    startAt: "4:00 PM",
    endAt: "5:00 PM",
    notes:
      "Cocktail Hour\nMC cue 4:55: \"Honored guests, cocktail hour is nearing its end.\"",
    sortOrder: 13,
  },
  {
    startAt: "5:00 PM",
    endAt: "6:00 PM",
    notes:
      "Dinner begins\nGrand Entrance Song: Special Dances Playlist\nMC cue 5:00: \"If I may have your attention - it’s time! Please welcome the wedding party, and then join me in cheering for the newlyweds, David and Haley!\"\nDinner cue immediately after entrance: \"Our couple has arrived - let the feast begin!\"\nPlaylist: Dinner Minstrels, start of dinner through start of toasts",
    sortOrder: 14,
  },
  {
    startAt: "6:00 PM",
    endAt: "6:30 PM",
    notes:
      "Toasts + Cake cutting\nMC cue 6:00: \"As dinner winds down, please return to your seats.\"\nMC cue 6:15: \"With the toasts complete, gather near the cake table.\"",
    sortOrder: 15,
  },
  {
    startAt: "6:30 PM",
    endAt: "7:00 PM",
    notes:
      "First dances\nMusic: First Dance and Father Daughter\nMC cue 6:30: \"Please turn your attention to the center of the space.\"",
    sortOrder: 16,
  },
  {
    startAt: "7:00 PM",
    endAt: "10:00 PM",
    notes:
      "Open Dancing\nMC cue 7:00: \"The dance floor is officially open in the glass house.\"\nPlaylist: Wedding - Kids Section 7:00–8:15\nMC cue 8:00: \"A gentle reminder for our younger travelers.\"\nPlaylist: Wedding - Adults Section 8:15–8:30\nMC cue 8:30 — Dollar Dance: \"It’s time for a cherished tradition - the dollar dance.\"\nMusic: Dollar Dance Song, Special Dances Playlist\nMC cue 9:55 — Last Call + Final Dance: \"As the evening winds down, this is the last call for drinks.\"\nMusic: Last Dance Song, Special Dances Playlist\nMC cue 10:00 — Reception Conclusion: \"Our celebration has reached its end.\"",
    sortOrder: 17,
  },
];
