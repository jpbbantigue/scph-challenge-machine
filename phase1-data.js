// Phase 1 seed data for Prompt Royale — Music + Characters categories only.
// Curated per Suno-feasibility rule: Music "Twist" reel keeps only
// lyric-writing / vocal-delivery constraints (cheap, human-controlled) and
// drops precise audio-production / music-theory constraints (unreliable,
// costly in regenerations for AI music generators). Same rule is enforced
// server-side in generate.js / openai-generate.js via TWIST_FEASIBILITY_NOTE.

const MUSIC_TWIST_ITEMS = [
  "Vocals must whisper for the first verse",
  "The song must end mid-sentence",
  "Must include a spoken-word bridge",
  "Under 90 seconds total",
  "Start with the chorus, no intro",
  "No metaphors — only literal images",
  "The title must be the song's last line",
  "Must include a false ending",
  "Backing vocals answer the lead like a conversation",
  "Must reference the weather at least twice",
  "No repeated words across the entire lyric",
  "A one-line callback to verse one at the very end",
  "Harmony only on the last word of each line",
  "Opens a cappella",
  "The second verse flips the meaning of the first",
  "A duet between two opposing perspectives",
  "The chorus lyric is a single repeated phrase",
  "The rhyme scheme breaks on purpose in the final verse",
  "Must name a real or invented street",
  "Addressed to a 'you' who never speaks back",
  "The chorus arrives before the first verse ends",
  "Must include a question that's never answered",
  "Must include a whispered aside not meant for the listener",
  "Works as both a lullaby and a warning",
  "Uses call-and-response between two vocal characters",
  "Each verse gets shorter than the last",
  "No chorus at all — only evolving verses",
  "The song seems to end, then doesn't",
  "Includes a spoken date, time, or place, like a report",
  "Written as a message left on an answering machine",
  "Includes a line borrowed from an overheard conversation"
];
// 31 items. Dropped (audio-production / music-theory, unreliable in Suno):
// no-drums-until-chorus, key-change-every-chorus, one-instrument-only,
// melody-never-repeats, bassline-never-repeats, time-signature-change,
// tempo-doubles, five-chords-only, non-drum-percussion,
// verse/chorus-share-no-notes, fade-in-mid-performance, bridge-instrumental,
// key-unresolved-until-final-chord, field-recording-texture, no-cymbals,
// count-in/studio-chatter, outro-strips-to-one-instrument,
// tempo-matches-heartbeat-bpm, full-bar-of-silence, two-note-vocal-range,
// non-musical-rhythm-source, final-chorus-drops-drums,
// unresolved-final-chord, instrumentation-thins-out, half-step-melody.

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
