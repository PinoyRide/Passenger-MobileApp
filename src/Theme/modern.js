// The look of the screens redone from 2.0.7 on: quiet surfaces, hairlines in
// place of drop shadows, and gold kept for the one thing that matters on a
// screen. Everything comes from the app's theme, so light and dark stay in
// step. Give it what react-native-paper's useTheme() returns.
//
// One look for both apps, light and dark (A-184, approved by the owner on
// 2026-11-26; design/A-184/SPEC.md section 2): one name for each colour, one
// gold, near-black words on gold, no blue but the pick-up pin. The pairs of
// words and fills here are checked for contrast by __tests__/tokens.test.mjs.

// The one brand gold, the same in both looks (C-1, gold A). It is also the
// light loading screen's line (android `launch_gold`), so the first second of
// a start already matches. LightTheme.js and DarkTheme.js give `primary` and
// `brand` the same value.
export const GOLD = '#FEC107';
// words and icons on the gold (10.9:1)
export const ON_GOLD = '#17171C';

export const modern = ({ colors, dark }) => {
  const look = {
    // the screen behind the cards
    page: dark ? colors.background : '#F6F4EF',
    // the screen, or a sheet lying on it: form pages, headers
    surface: colors.background,
    // cards and boxes: white on the warm page
    card: dark ? '#26252A' : '#FFFFFF',
    // a quiet block on that surface: a row of figures, a group of settings
    soft: dark ? '#26252A' : '#F7F4EE',
    // the quiet square behind an icon that is not gold
    tile: dark ? 'rgba(255, 255, 255, 0.08)' : '#F0EEE7',
    // dividers and card edges (decorative)
    hairline: dark ? 'rgba(255, 255, 255, 0.09)' : '#ECE6DA',
    // the edge of a field or a checkbox, a switch that is off: 3:1 or more
    // on the page and on a card (C-5)
    fieldEdge: dark ? '#7A7469' : '#858177',
    text: colors.text,
    // headlines, fares, names
    ink: dark ? '#F4F3F1' : '#17171C',
    // secondary text, and any text on `soft`, where `muted` is too faint
    inkSoft: dark ? '#B8B4AE' : '#45454F',
    // captions, the version line, a box's note
    muted: dark ? '#A9A49B' : '#6F6A60',
    // chevrons and dividers: never words
    faint: dark ? '#77736B' : '#B3AFA6',
    // the main button, the wallet card, a checked box, a switch that is on
    accent: GOLD,
    onAccent: ON_GOLD,
    // the small round patch behind a gold icon; gold words and icons on a
    // page (links, "Resend code")
    chip: dark ? 'rgba(254, 193, 7, 0.14)' : '#FFF4D0',
    chipInk: dark ? GOLD : '#7A5B00',
    // a good-news badge: `success` text on an `onSuccess` fill (the other way
    // round from accent and onAccent)
    success: dark ? '#6FD3A6' : '#0B6B46',
    onSuccess: dark ? 'rgba(111, 211, 166, 0.14)' : '#E4F1EA',
    // destructive words, errors, the Emergency fill (words on it: `surface`)
    red: dark ? '#FF8A80' : '#B1352A',
    redSoft: dark ? 'rgba(255, 138, 128, 0.14)' : '#F8EAE7',
    // only the pick-up pin or dot: the one blue
    pickup: dark ? '#8FA2FF' : '#3A5AF6',
    // the route line on the map
    route: dark ? '#F4F3F1' : '#17171C',
    // behind every box and sheet
    scrim: 'rgba(0, 0, 0, 0.45)',
    // a button, a chip or a tile lying on the gold card: a shade of the
    // words on it, not a colour of its own
    goldShade: 'rgba(23, 23, 28, 0.12)',
    // corners: a sheet, a card, an icon tile or a field, a button, a pill
    radiusSheet: 28,
    radiusCard: 20,
    radiusTile: 16,
    radiusButton: 14,
    radiusPill: 15,
  };
  return {
    ...look,
    // Retired names (SPEC section 2), kept as aliases until the screens move
    // to the names on the right (A-184 piece d removes them). Not for new
    // code.
    gold: look.accent,
    onGold: look.onAccent,
    onGoldSoft: look.onAccent,
    danger: look.red,
    // links move to `chipInk` and the pick-up dot to `pickup` in piece d;
    // until then `link` keeps today's blue
    link: look.pickup,
    switchOff: look.fieldEdge,
    radius: look.radiusTile,
  };
};
