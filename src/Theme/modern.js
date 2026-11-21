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
});
