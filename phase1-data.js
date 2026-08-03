// Phase 1 seed data for Prompt Royale — Music + Characters categories only.
// Music's "Twist" reel is the full original list (56 items), including
// audio-production/music-theory constraints — an earlier revision curated
// this down to a Suno-feasibility-only subset, but that was reverted at the
// user's request (the fuller variety was preferred over strict achievability).

const MUSIC_TWIST_ITEMS = [
  "No drums until the final chorus",
  "Vocals must whisper for the first verse",
  "A key change every chorus",
  "The song must end mid-sentence",
  "Only one instrument besides vocals",
  "The chorus can't repeat the same melody twice",
  "Must include a spoken-word bridge",
  "Under 90 seconds total",
  "Start with the chorus, no intro",
  "The bassline never repeats",
  "A time-signature change in the bridge",
  "No metaphors — only literal images",
  "The title must be the song's last line",
  "Must include a false ending",
  "Backing vocals answer the lead like a conversation",
  "The tempo doubles in the final third",
  "Only five chords total, no more",
  "Percussion made entirely of non-drum sounds",
  "Must reference the weather at least twice",
  "Verse and chorus melodies share no notes",
  "The song fades in already mid-performance",
  "No repeated words across the entire lyric",
  "A one-line callback to verse one at the very end",
  "The bridge is entirely instrumental",
  "Harmony only on the last word of each line",
  "Opens a cappella",
  "The key must feel unresolved until the final chord",
  "Must include a crowd or field-recording texture",
  "The second verse flips the meaning of the first",
  "A duet between two opposing perspectives",
  "No cymbals anywhere in the mix",
  "The chorus lyric is a single repeated phrase",
  "Must include a count-in or studio chatter at the start",
  "The outro strips back to a single instrument",
  "The rhyme scheme breaks on purpose in the final verse",
  "Must name a real or invented street",
  "Tempo matches a resting heartbeat, 60–100 bpm",
  "Addressed to a 'you' who never speaks back",
  "Must include a full bar of near-silence",
  "The melody fits a two-note vocal range",
  "The rhythm is borrowed from something non-musical",
  "The chorus arrives before the first verse ends",
  "Must include a question that's never answered",
  "The final chorus drops the drums entirely",
  "Must include a whispered aside not meant for the listener",
  "Works as both a lullaby and a warning",
  "Uses call-and-response between two vocal characters",
  "Each verse gets shorter than the last",
  "Ends on a deliberately unresolved chord",
  "No chorus at all — only evolving verses",
  "The song seems to end, then doesn't",
  "Instrumentation thins out with every verse until just voice remains",
  "Includes a spoken date, time, or place, like a report",
  "Written as a message left on an answering machine",
  "The melody moves mostly in half-steps",
  "Includes a line borrowed from an overheard conversation"
];

const CATEGORIES_PHASE1 = [
  {
    id: "music",
    name: "Music",
    blurb: "Songs, scores & sonic ideas",
    accent: "royal",
    reels: [
      { label: "Genre 1", items: ["Dream Pop","Trip-Hop","Afrobeat","Baroque Pop","Drum & Bass","Neo-Soul","Shoegaze","Bolero","City Pop","Math Rock","Zydeco","Vaporwave","Highlife","Post-Punk","Bedroom Pop","Cumbia","Grime","Dungeon Synth","Emo Rap","J-Pop","Dub","Country Noir","Krautrock","Bachata"] },
      { label: "Genre 2", items: ["Synthwave","Flamenco","Ambient Jazz","Trap","Bossa Nova","Industrial","Gospel","Chiptune","Reggaeton","Doom Metal","Folktronica","Baile Funk","Lo-fi Hip-Hop","Bluegrass","Witch House","Disco","Tuareg Blues","Ska","Balearic House","Opera","Nu-Disco","Highlife","Grunge","Salsa"] },
      { label: "Mood", items: ["Quietly unsettling","Euphoric and reckless","Bittersweet nostalgia","Defiant","Tender and unresolved","Menacing calm","Weightless","Triumphant grief","Restless longing","Playfully unhinged","Cold detachment","Aching hopefulness","Simmering rage","Serene dread","Giddy infatuation","Weary resolve","Feral joy","Numb and drifting","Fragile bravado","Slow-burning regret"] },
      { label: "Subject", items: ["A lighthouse keeper's last night","Two rivals falling in love","A city that forgets itself","An astronaut coming home","A letter never sent","The last dance of summer","A machine learning to grieve","A ghost who pays rent","A thief who only steals memories","The last payphone in town","A wedding that never happens","A stranger who knows your name","The house that keeps changing rooms","A war fought over a song","Someone rehearsing an apology forever","A town built on a lie","The year the ocean rose","A twin who was never born","A radio station only the lonely find","Falling in love during a blackout"] },
      { label: "Twist", items: MUSIC_TWIST_ITEMS }
    ]
  },
  {
    id: "characters",
    name: "Characters",
    blurb: "Personas, arcs & motivations",
    accent: "crimson",
    reels: [
      { label: "Genre", items: ["Space Opera","Urban Fantasy","Noir Mystery","High Fantasy","Cyberpunk","Slice of Life","Post-Apocalyptic","Gothic Horror","Steampunk","Historical Drama","Fairy Tale","Heist Thriller","Superhero","Western","Mythic Retelling","Political Thriller","Survival Drama","Time-Travel Saga"] },
      { label: "Theme", items: ["Redemption","Betrayal","Coming of Age","Found Family","Power & Corruption","Identity & Memory","Sacrifice","Revenge","Forgiveness","Legacy & Inheritance","Isolation","Rebellion","Grief & Letting Go","Obsession","Duty vs. Desire","Second Chances"] },
      { label: "Archetype", items: ["Reluctant Hero","Fallen Mentor","Trickster","Guardian","Outcast","Chosen One","Antihero","Rival Turned Ally","Broken King","Wandering Sage","Loyal Second-in-Command","Con Artist With a Code","Last of Their Kind","Double Agent"] },
      { label: "Trait", items: ["Never forgets a debt","Speaks only in questions","Collects other people's memories","Refuses to be touched","Always arrives late to save someone","Can't lie without flinching","Names everything they own","Only trusts strangers, never friends","Keeps a list of people to apologize to","Talks to the dead as if they're listening","Can't stay in one place more than a year","Remembers every promise ever made to them"] },
      { label: "Flaw", items: ["Addicted to being needed","Terrified of silence","Trusts too easily","Cannot forgive himself","Obsessed with control","Haunted by a broken promise","Runs from every good thing","Mistakes control for safety","Can't accept help from anyone","Sabotages happiness before it's real","Needs to be the one who suffers most","Confuses loyalty with self-erasure"] },
      { label: "Mood", items: ["Quietly tragic","Reluctantly heroic","Charismatically dangerous","Wounded but hopeful","Coldly composed","Chaotically loyal","Weary but unbroken","Magnetically unstable","Gently ruthless","Defiantly tender"] }
    ]
  }
];

module.exports = { MUSIC_TWIST_ITEMS, CATEGORIES_PHASE1 };
