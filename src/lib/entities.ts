/** Field-driven config for the generic admin editors (albums, chapters, notes, songs). */
export type FieldType = "text" | "textarea" | "slug" | "date" | "datetime" | "select" | "checkbox" | "media" | "song" | "note" | "album" | "url" | "number";
export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: [string, string][];
  help?: string;
  required?: boolean;
  rows?: number;
  mediaKind?: "image" | "audio";
};

export type Entity = {
  key: string;
  table: string;
  label: string;
  singular: string;
  slugFrom?: string;
  join?: { table: string; fk: string; label: string };
  fields: Field[];
  listColumns: string[];
  orderBy: { column: string; ascending: boolean };
  publicPath?: (row: any) => string;
  tracksPublishedAt?: boolean;
};

export const STATUS_OPTIONS: [string, string][] = [
  ["draft", "Draft"],
  ["scheduled", "Scheduled"],
  ["published", "Published"],
  ["archived", "Archived"],
];

export const ENTITIES: Record<string, Entity> = {
  albums: {
    key: "albums", table: "albums", label: "Albums", singular: "album", slugFrom: "title",
    join: { table: "album_media", fk: "album_id", label: "Photos and videos in this album" },
    listColumns: ["title", "status", "sort_order"],
    orderBy: { column: "sort_order", ascending: true },
    publicPath: (r) => `/gallery/${r.slug}`,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Web address", type: "slug", help: "Letters, numbers and dashes. Leave empty to create it from the title." },
      { name: "description", label: "Description", type: "textarea", rows: 3 },
      { name: "category", label: "Category", type: "text", help: "Used for the filter chips, e.g. Dates or Trips." },
      { name: "cover_asset_id", label: "Cover photo or video", type: "media", mediaKind: "image" },
      { name: "layout_type", label: "Album display", type: "select", help: "Controls how the photos and videos sit next to each other.", options: [["grid-2", "Grid — 2 columns"], ["grid-3", "Grid — 3 columns"], ["masonry", "Masonry — original-height rows"], ["collage", "Collage — mixed widths"], ["polaroid", "Polaroid — 2 columns"]] },
      { name: "media_aspect", label: "Photo and video shape", type: "select", help: "Controls the visible dimensions without changing the uploaded files.", options: [["natural", "Original dimensions"], ["square", "Square — 1:1"], ["landscape", "Landscape — 4:3"], ["wide", "Wide — 16:9"], ["portrait", "Portrait — 4:5"]] },
      { name: "date_start", label: "From", type: "date" },
      { name: "date_end", label: "To", type: "date" },
      { name: "featured", label: "Feature this album on Home", type: "checkbox" },
      { name: "sort_order", label: "Order", type: "number", help: "Lower numbers come first." },
    ],
  },
  stories: {
    key: "stories", table: "story_chapters", label: "Our Story", singular: "chapter", slugFrom: "title",
    join: { table: "chapter_media", fk: "chapter_id", label: "More photos and videos in this chapter" },
    listColumns: ["title", "event_date", "status"],
    orderBy: { column: "event_date", ascending: true },
    publicPath: (r) => `/story/${r.slug}`,
    fields: [
      { name: "title", label: "Chapter title", type: "text", required: true },
      { name: "slug", label: "Web address", type: "slug" },
      { name: "event_date", label: "Memory date", type: "date" },
      { name: "teaser", label: "Teaser", type: "textarea", rows: 2, help: "One or two lines shown on the timeline." },
      { name: "body", label: "Chapter text", type: "textarea", rows: 14, help: "Plain text. A blank line starts a new paragraph." },
      { name: "cover_asset_id", label: "Cover photo or video", type: "media", mediaKind: "image" },
      { name: "song_id", label: "Song for this chapter", type: "song" },
      { name: "featured", label: "Feature this chapter on Home", type: "checkbox" },
      { name: "sort_order", label: "Order", type: "number", help: "Used when two chapters share a date." },
    ],
  },
  notes: {
    key: "notes", table: "notes", label: "Notes", singular: "note",
    listColumns: ["title", "kind", "status"],
    orderBy: { column: "created_at", ascending: false },
    publicPath: (r) => `/notes/${r.id}`,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, help: 'e.g. "Open when you miss me".' },
      { name: "kind", label: "Type", type: "select", options: [["note", "Short note"], ["letter", "Long letter"], ["open_when", "Open when…"], ["voice", "Voice letter"], ["special", "Special delivery"]] },
      { name: "teaser", label: "Teaser", type: "textarea", rows: 2, help: "The only text she sees while the note is locked." },
      { name: "body", label: "Letter", type: "textarea", rows: 16, help: "Never sent to her until the note is published, unlocked and (if set) the clue is answered." },
      { name: "unlock_at", label: "Unlock at", type: "datetime", help: "Optional. Uses the site timezone." },
      { name: "audio_asset_id", label: "Voice recording", type: "media", mediaKind: "audio", help: "Only with her consent." },
      { name: "song_id", label: "Song", type: "song" },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  songs: {
    key: "songs", table: "songs", label: "Songs", singular: "song",
    listColumns: ["title", "artist", "status"],
    orderBy: { column: "sort_order", ascending: true },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "artist", label: "Artist", type: "text" },
      { name: "source_type", label: "Where it plays", type: "select", options: [["spotify", "Spotify link"], ["youtube", "YouTube link"], ["apple", "Apple Music link"], ["link", "Other link"], ["file", "Audio file I own"]] },
      { name: "source_url", label: "Link", type: "url", help: "https:// link to the song. Spotify and YouTube links play inside the page after she taps play." },
      { name: "audio_asset_id", label: "Audio file", type: "media", mediaKind: "audio", help: "Only music you own or have the rights to." },
      { name: "cover_asset_id", label: "Cover photo", type: "media", mediaKind: "image", help: "Optional. Choose a photo to replace the record icon beside the song. Leave empty to keep the record." },
      { name: "dedication", label: "Why this song reminds me of you", type: "textarea", rows: 3 },
      { name: "featured", label: "This is our song", type: "checkbox" },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  surprises: {
    key: "surprises", table: "surprises", label: "Surprises", singular: "surprise",
    listColumns: ["title", "surprise_type", "status"],
    orderBy: { column: "sort_order", ascending: true },
    publicPath: (r) => `/surprises/${r.id}`,
    tracksPublishedAt: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "teaser", label: "Teaser", type: "textarea", rows: 2, help: "Shown on the card before the surprise opens." },
      { name: "surprise_type", label: "Type", type: "select", options: [["gift", "Gift"], ["envelope", "Envelope"], ["countdown", "Countdown"], ["gallery", "Gallery"], ["quiz", "Quiz"]] },
      { name: "message", label: "Hidden message", type: "textarea", rows: 12, required: true, help: "Kept private until the unlock time." },
      { name: "linked_note_id", label: "Open a note afterwards", type: "note", help: "Optional. The note must also be published and unlocked." },
      { name: "linked_album_id", label: "Open an album afterwards", type: "album", help: "Optional. The album must also be published." },
      { name: "unlock_at", label: "Unlock at", type: "datetime", help: "Optional. Until then, she sees only the teaser and countdown." },
      { name: "expires_at", label: "Expire at", type: "datetime", help: "Optional. After this time the surprise can no longer be opened." },
      { name: "sort_order", label: "Order", type: "number", help: "Lower numbers appear first." },
    ],
  },
};
