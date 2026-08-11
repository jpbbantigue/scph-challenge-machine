// Ported from index.html's inline <script> — the CATEGORIES data and
// accent/example definitions that drive the slot machine. Phase 1 ships
// three categories (Music, Characters, Album/EP).

export interface ReelDef {
  label: string;
  key: string;
  items: string[];
}

export interface CategoryDef {
  id: string;
  name: string;
  blurb: string;
  accent: "royal" | "crimson" | "gold";
  reels: ReelDef[];
}

const MUSIC_TWIST_ITEMS = [
  "No drums until the final chorus", "Vocals must whisper for the first verse", "A key change every chorus",
  "The song must end mid-sentence", "Only one instrument besides vocals", "The chorus can't repeat the same melody twice",
  "Must include a spoken-word bridge", "Under 90 seconds total", "Start with the chorus, no intro",
  "The bassline never repeats", "A time-signature change in the bridge", "No metaphors — only literal images",
  "The title must be the song's last line", "Must include a false ending", "Backing vocals answer the lead like a conversation",
  "The tempo doubles in the final third", "Only five chords total, no more", "Percussion made entirely of non-drum sounds",
  "Must reference the weather at least twice", "Verse and chorus melodies share no notes", "The song fades in already mid-performance",
  "No repeated words across the entire lyric", "A one-line callback to verse one at the very end", "The bridge is entirely instrumental",
  "Harmony only on the last word of each line", "Opens a cappella", "The key must feel unresolved until the final chord",
  "Must include a crowd or field-recording texture", "The second verse flips the meaning of the first",
  "A duet between two opposing perspectives", "No cymbals anywhere in the mix", "The chorus lyric is a single repeated phrase",
  "Must include a count-in or studio chatter at the start", "The outro strips back to a single instrument",
  "The rhyme scheme breaks on purpose in the final verse", "Must name a real or invented street",
  "Tempo matches a resting heartbeat, 60–100 bpm", "Addressed to a 'you' who never speaks back",
  "Must include a full bar of near-silence", "The melody fits a two-note vocal range",
  "The rhythm is borrowed from something non-musical", "The chorus arrives before the first verse ends",
  "Must include a question that's never answered", "The final chorus drops the drums entirely",
  "Must include a whispered aside not meant for the listener", "Works as both a lullaby and a warning",
  "Uses call-and-response between two vocal characters", "Each verse gets shorter than the last",
  "Ends on a deliberately unresolved chord", "No chorus at all — only evolving verses", "The song seems to end, then doesn't",
  "Instrumentation thins out with every verse until just voice remains", "Includes a spoken date, time, or place, like a report",
  "Written as a message left on an answering machine", "The melody moves mostly in half-steps",
  "Includes a line borrowed from an overheard conversation"
];

export const ACCENTS: Record<string, { border: string; glyph: string }> = {
  royal: { border: "rgba(77,124,255,0.35)", glyph: "linear-gradient(135deg,#4D7CFF,#1836B2)" },
  crimson: { border: "rgba(230,58,70,0.35)", glyph: "linear-gradient(135deg,#E63A46,#74182D)" },
  gold: { border: "rgba(244,191,58,0.4)", glyph: "linear-gradient(135deg,#FFD978,#C68B24)" }
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "music", name: "Music", blurb: "Songs, scores & sonic ideas", accent: "royal",
    reels: [
      { label: "Genre 1", key: "genre1", items: ["Dream Pop","Trip-Hop","Afrobeat","Baroque Pop","Drum & Bass","Neo-Soul","Shoegaze","Bolero","City Pop","Math Rock","Zydeco","Vaporwave","Highlife","Post-Punk","Bedroom Pop","Cumbia","Grime","Dungeon Synth","Emo Rap","J-Pop","Dub","Country Noir","Krautrock","Bachata"] },
      { label: "Genre 2", key: "genre2", items: ["Synthwave","Flamenco","Ambient Jazz","Trap","Bossa Nova","Industrial","Gospel","Chiptune","Reggaeton","Doom Metal","Folktronica","Baile Funk","Lo-fi Hip-Hop","Bluegrass","Witch House","Disco","Tuareg Blues","Ska","Balearic House","Opera","Nu-Disco","Highlife","Grunge","Salsa"] },
      { label: "Mood", key: "mood", items: ["Quietly unsettling","Euphoric and reckless","Bittersweet nostalgia","Defiant","Tender and unresolved","Menacing calm","Weightless","Triumphant grief","Restless longing","Playfully unhinged","Cold detachment","Aching hopefulness","Simmering rage","Serene dread","Giddy infatuation","Weary resolve","Feral joy","Numb and drifting","Fragile bravado","Slow-burning regret"] },
      { label: "Subject", key: "subject", items: ["A lighthouse keeper's last night","Two rivals falling in love","A city that forgets itself","An astronaut coming home","A letter never sent","The last dance of summer","A machine learning to grieve","A ghost who pays rent","A thief who only steals memories","The last payphone in town","A wedding that never happens","A stranger who knows your name","The house that keeps changing rooms","A war fought over a song","Someone rehearsing an apology forever","A town built on a lie","The year the ocean rose","A twin who was never born","A radio station only the lonely find","Falling in love during a blackout"] },
      { label: "Twist", key: "twist", items: MUSIC_TWIST_ITEMS }
    ]
  },
  {
    id: "characters", name: "Characters", blurb: "Personas, arcs & motivations", accent: "crimson",
    reels: [
      { label: "Genre", key: "genre", items: ["Space Opera","Urban Fantasy","Noir Mystery","High Fantasy","Cyberpunk","Slice of Life","Post-Apocalyptic","Gothic Horror","Steampunk","Historical Drama","Fairy Tale","Heist Thriller","Superhero","Western","Mythic Retelling","Political Thriller","Survival Drama","Time-Travel Saga"] },
      { label: "Theme", key: "theme", items: ["Redemption","Betrayal","Coming of Age","Found Family","Power & Corruption","Identity & Memory","Sacrifice","Revenge","Forgiveness","Legacy & Inheritance","Isolation","Rebellion","Grief & Letting Go","Obsession","Duty vs. Desire","Second Chances"] },
      { label: "Archetype", key: "archetype", items: ["Reluctant Hero","Fallen Mentor","Trickster","Guardian","Outcast","Chosen One","Antihero","Rival Turned Ally","Broken King","Wandering Sage","Loyal Second-in-Command","Con Artist With a Code","Last of Their Kind","Double Agent"] },
      { label: "Trait", key: "trait", items: ["Never forgets a debt","Speaks only in questions","Collects other people's memories","Refuses to be touched","Always arrives late to save someone","Can't lie without flinching","Names everything they own","Only trusts strangers, never friends","Keeps a list of people to apologize to","Talks to the dead as if they're listening","Can't stay in one place more than a year","Remembers every promise ever made to them"] },
      { label: "Flaw", key: "flaw", items: ["Addicted to being needed","Terrified of silence","Trusts too easily","Cannot forgive himself","Obsessed with control","Haunted by a broken promise","Runs from every good thing","Mistakes control for safety","Can't accept help from anyone","Sabotages happiness before it's real","Needs to be the one who suffers most","Confuses loyalty with self-erasure"] },
      { label: "Mood", key: "mood", items: ["Quietly tragic","Reluctantly heroic","Charismatically dangerous","Wounded but hopeful","Coldly composed","Chaotically loyal","Weary but unbroken","Magnetically unstable","Gently ruthless","Defiantly tender"] }
    ]
  },
  {
    id: "album", name: "Album/EP", blurb: "Full-project themes & concepts", accent: "gold",
    reels: [
      { label: "Theme", key: "theme", items: ["Grief and Renewal","Coming of Age","Digital Isolation","Nostalgia for a Place That Never Existed","Reinvention","Falling Apart Gracefully","Chosen Family","Escape Velocity","Unfinished Business","The Space Between Words","Ghosts of Old Selves","Learning to Stay","Beautiful Exhaustion","Home as a Moving Target","The Weight of Almost","Quiet Rebellion","Letting the Dead Rest","Becoming Someone Else","The Long Way Back","Static and Silence"] },
      { label: "Genre 1", key: "genre1", items: ["Dream Pop","Trip-Hop","Afrobeat","Baroque Pop","Drum & Bass","Neo-Soul","Shoegaze","Bolero","City Pop","Math Rock","Zydeco","Vaporwave","Highlife","Post-Punk","Bedroom Pop","Cumbia","Grime","Dungeon Synth","Emo Rap","J-Pop","Dub","Country Noir","Krautrock","Bachata"] },
      { label: "Genre 2", key: "genre2", items: ["Synthwave","Flamenco","Ambient Jazz","Trap","Bossa Nova","Industrial","Gospel","Chiptune","Reggaeton","Doom Metal","Folktronica","Baile Funk","Lo-fi Hip-Hop","Bluegrass","Witch House","Disco","Tuareg Blues","Ska","Balearic House","Opera","Nu-Disco","Highlife","Grunge","Salsa"] },
      { label: "Story/Concept", key: "story", items: ["A concept album following a character through five stages of grief","A breakup told in reverse chronological order","Letters to a version of yourself you left behind","A soundtrack for a city that no longer exists","The rise and fall of a fictional band","A year lived entirely at night","Voicemails never returned","A love story told through weather","An astronaut's diary on the way home","The last summer before everything changed","A road trip with no destination","Two strangers writing to each other for a decade","A haunted house telling its own history","The soundtrack to a slow goodbye","A war fought entirely in silence","Growing up in a town everyone left","A machine's love song for its creator","The night shift at the end of the world","A family's unspoken history, sung instead of said","Falling in and out of the same dream"] }
    ]
  }
];

export const CATEGORY_BY_ID: Record<string, CategoryDef> = {};
CATEGORIES.forEach((c) => { CATEGORY_BY_ID[c.id] = c; });

export interface Example {
  categoryId: string;
  text: string;
}

export const EXAMPLES: Example[] = [
  { categoryId: "music", text: "Write a bittersweet nostalgia Dream Pop x Trip-Hop fusion song about a lighthouse keeper's last night." },
  { categoryId: "music", text: "Write a triumphant grief City Pop song about an astronaut coming home." },
  { categoryId: "characters", text: "Create a wounded but hopeful reluctant hero character in a cyberpunk setting defined by never forgets a debt, haunted by terrified of silence, exploring redemption." },
  { categoryId: "characters", text: "Create a coldly composed fallen mentor character in a noir mystery setting defined by keeps a list of people to apologize to, haunted by obsessed with control, exploring betrayal." },
  { categoryId: "album", text: "Write a grief and renewal Dream Pop x Trip-Hop album/EP centered on a concept album following a character through five stages of grief." },
  { categoryId: "album", text: "Write a digital isolation Synthwave album/EP centered on a soundtrack for a city that no longer exists." }
];

export function reelDef(cat: CategoryDef, key: string): ReelDef | undefined {
  return cat.reels.find((r) => r.key === key);
}

export function pick(cat: CategoryDef, key: string): string {
  const list = reelDef(cat, key)!.items;
  return list[Math.floor(Math.random() * list.length)];
}
