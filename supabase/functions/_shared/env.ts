// Settings come from Edge Function secrets. The setup guide in README.md lists every one.

export class ConfigError extends Error {
  setting: string
  constructor(setting: string) {
    super(`Missing setting: ${setting}`)
    this.setting = setting
  }
}

export function optionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name)
  return value ? value.trim() : undefined
}

export function env(name: string): string {
  const value = optionalEnv(name)
  if (!value) throw new ConfigError(name)
  return value
}

// The server-side key for the database. New projects expose SUPABASE_SECRET_KEYS (a JSON map of
// named secret keys); older ones expose SUPABASE_SERVICE_ROLE_KEY. MAIL_SERVICE_KEY overrides both.
export function serviceKey(): string {
  const explicit = optionalEnv('MAIL_SERVICE_KEY')
  if (explicit) return explicit
  const keys = optionalEnv('SUPABASE_SECRET_KEYS')
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>
      const key = parsed.default ?? Object.values(parsed)[0]
      if (typeof key === 'string' && key) return key
    } catch {
      // Not JSON. Fall through to the legacy key.
    }
  }
  return env('SUPABASE_SERVICE_ROLE_KEY')
}

export function list(name: string): string[] {
  return (optionalEnv(name) ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
