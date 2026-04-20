import { Font } from '@react-pdf/renderer'

// Two separate families — one file each.
// We register BOTH 'normal' and 'italic' fontStyle variants pointing at the
// same TTF. react-pdf's resolver filters sources by fontStyle first, so a
// style using fontStyle:'italic' on these families would otherwise throw
// "Could not resolve font for <family>, fontWeight <n>". The italic variant
// is not a true italic (we don't ship an italic TTF) — but it prevents
// resolution failures when a style combines italic with our families.
export function registerPdfFonts() {
  Font.register({
    family: 'NotoSans',
    fonts: [
      { src: '/fonts/NotoSans.ttf', fontWeight: 400, fontStyle: 'normal' },
      { src: '/fonts/NotoSans.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  })

  Font.register({
    family: 'NotoSansBold',
    fonts: [
      { src: '/fonts/NotoSans-Bold.ttf', fontWeight: 400, fontStyle: 'normal' },
      { src: '/fonts/NotoSans-Bold.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  })

  // Hyphenation off — prevents words being broken mid-line
  Font.registerHyphenationCallback((word) => [word])
}
