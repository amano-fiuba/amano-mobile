// Lowercase and without accents, so "jose" finds "José" and "dolar" finds "Dólar".
export function normalizeText(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
