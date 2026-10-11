// Email color themes. Emails stay light so they read well in every inbox, including dark mode ones.
// Button text colors were checked for at least 4.5:1 contrast against the button color.

export const THEMES = {
  studio: {
    name: 'Studio',
    note: 'Your ember on warm paper',
    bg: '#EFECE6', card: '#FFFFFF', ink: '#0E1626', body: '#3A4356', muted: '#6B7385',
    accent: '#FF5A1F', onAccent: '#1C0A02', link: '#C4410C', eyebrow: '#C4410C', logo: '#FF5A1F',
    soft: '#FFF3EC', softBorder: '#FFB592', line: '#E8E3DA', footer: '#F7F5F0',
    band: '#070A12', bandInk: '#ECE8DF', bandMuted: '#98A1B5', bandLogo: '#FF5A1F',
  },
  navy: {
    name: 'Navy',
    note: 'Deep navy with an ember spark',
    bg: '#E8ECF3', card: '#FFFFFF', ink: '#0F1D3A', body: '#3A4763', muted: '#69748D',
    accent: '#112448', onAccent: '#FFFFFF', link: '#1F4FB8', eyebrow: '#C4410C', logo: '#112448',
    soft: '#EEF2FA', softBorder: '#AFC0E4', line: '#E2E7F0', footer: '#F5F7FB',
    band: '#112448', bandInk: '#FFFFFF', bandMuted: '#B6C3DE', bandLogo: '#FF7A45',
  },
  blueprint: {
    name: 'Blueprint',
    note: 'Cool blue, like a plan on paper',
    bg: '#E5EDF6', card: '#FFFFFF', ink: '#10233F', body: '#39506E', muted: '#647A95',
    accent: '#2C5AD6', onAccent: '#FFFFFF', link: '#2C5AD6', eyebrow: '#2C5AD6', logo: '#2C5AD6',
    soft: '#EDF2FD', softBorder: '#B3C6F3', line: '#E0E7F1', footer: '#F4F7FB',
    band: '#10233F', bandInk: '#FFFFFF', bandMuted: '#A9BAD3', bandLogo: '#8FB0FF',
  },
  sand: {
    name: 'Sand',
    note: 'Warm, friendly and local',
    bg: '#F2EADF', card: '#FFFDF9', ink: '#2B2119', body: '#574536', muted: '#83705F',
    accent: '#B4562C', onAccent: '#FFFFFF', link: '#A14A23', eyebrow: '#A14A23', logo: '#B4562C',
    soft: '#FBF0E6', softBorder: '#E3B694', line: '#ECE2D5', footer: '#FAF5EE',
    band: '#2B2119', bandInk: '#FBF0E6', bandMuted: '#CDBBA9', bandLogo: '#F09A6A',
  },
  clean: {
    name: 'Simple white',
    note: 'Quiet, like a personal note',
    bg: '#FFFFFF', card: '#FFFFFF', ink: '#111418', body: '#363D47', muted: '#68707B',
    accent: '#111418', onAccent: '#FFFFFF', link: '#111418', eyebrow: '#68707B', logo: '#111418',
    soft: '#F4F5F6', softBorder: '#D2D6DB', line: '#E7E9EC', footer: '#F7F8F9',
    band: '#111418', bandInk: '#FFFFFF', bandMuted: '#A9B0B9', bandLogo: '#FF7A45',
  },
}
export const THEME_ORDER = ['studio', 'navy', 'blueprint', 'sand', 'clean']

export const HEADINGS = {
  serif: { name: 'Classic', note: 'Serif headlines', stack: "Georgia, 'Times New Roman', Times, serif", weight: 400, spacing: '-0.3px' },
  sans: { name: 'Modern', note: 'Bold sans headlines', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif", weight: 700, spacing: '-0.5px' },
  code: { name: 'Code', note: 'Monospace, like your logo', stack: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace", weight: 700, spacing: '-0.8px' },
}
export const HEADING_ORDER = ['serif', 'sans', 'code']

export const BUTTONS = {
  pill: { name: 'Pill', radius: 999 },
  rounded: { name: 'Rounded', radius: 8 },
  square: { name: 'Square', radius: 0 },
}
export const BUTTON_ORDER = ['pill', 'rounded', 'square']

export const BODY_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
export const MONO_STACK = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace"
