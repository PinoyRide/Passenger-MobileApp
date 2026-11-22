// The look of the screens redone from 2.0.7 on: quiet surfaces, hairlines in
// place of drop shadows, and gold kept for the one thing that matters on a
// screen. Everything comes from the app's theme, so light and dark stay in
// step. Give it what react-native-paper's useTheme() returns.
export const modern = ({ colors, dark }) => ({
  // the screen, or a sheet lying on it
  surface: colors.background,
  // a quiet block on that surface: a row of figures, a group of settings
  soft: dark ? '#26252A' : '#F7F4EE',
  hairline: dark ? 'rgba(255, 255, 255, 0.09)' : '#ECE6DA',
  text: colors.text,
  muted: dark ? '#A9A49B' : '#7A756B',
  accent: colors.primary,
  onAccent: colors.onYellow || '#372A00',
  // the small round patch behind an icon, and the icon on it
  chip: dark ? 'rgba(255, 205, 5, 0.14)' : '#FFF4D0',
  chipInk: dark ? colors.primary : '#7A5B00',
  switchOff: dark ? '#55535A' : '#C9C4BA',
  radius: 16,
  // headlines, fares, names
  ink: dark ? '#F4F3F1' : '#17171C',
  // secondary text, and any text on `soft`, where `muted` is too faint
  inkSoft: dark ? '#B8B4AE' : '#45454F',
  // a good-news badge: `success` text on an `onSuccess` fill (the other way
  // round from accent and onAccent)
  success: dark ? '#6FD3A6' : '#0B6B46',
  onSuccess: dark ? 'rgba(111, 211, 166, 0.14)' : '#E4F1EA',
  // the text of a destructive action, such as cancelling a booking
  danger: dark ? '#FF8A80' : '#C0261F',
  // the route line on the map
  route: dark ? '#F4F3F1' : '#17171C',
  // The pages drawn from the owner's Account and Wallet design (2026-11-22):
  // white cards on a warm page, and a gold card for the wallet.
  page: dark ? colors.background : '#F6F4EF',
  card: dark ? '#26252A' : '#FFFFFF',
  gold: '#F5C344',
  onGold: '#352B08',
  onGoldSoft: '#6B5619',
  // a button, a chip or a tile lying on the gold card
  goldShade: 'rgba(53, 43, 8, 0.12)',
  // the quiet square behind an icon that is not gold
  tile: dark ? 'rgba(255, 255, 255, 0.08)' : '#F0EEE7',
  // help in an emergency: the words and the icon, and the tile behind it
  red: dark ? '#FF8A80' : '#B1352A',
  redSoft: dark ? 'rgba(255, 138, 128, 0.14)' : '#F8EAE7',
  // a link, such as "See all"
  link: dark ? '#8FA2FF' : '#3A5AF6',
  // chevrons and the version line: the faintest words
  faint: dark ? '#77736B' : '#B3AFA6',
  // corners at four scales: a sheet, a card, an icon tile, a pill
  radiusSheet: 28,
  radiusCard: 20,
  radiusTile: 16,
  radiusPill: 15,
});
