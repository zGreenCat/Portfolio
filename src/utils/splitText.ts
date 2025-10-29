/**
 * Utility to split text into individual characters for animation
 * No external dependencies - custom implementation
 */

export function splitTextToChars(text: string): string[] {
  return text.split('').map(char => char === ' ' ? '\u00A0' : char)
}

export function wrapCharsInSpans(text: string, className: string = 'letter'): string {
  const chars = splitTextToChars(text)
  return chars
    .map(char => `<span class="${className}" style="display: inline-block;">${char}</span>`)
    .join('')
}
