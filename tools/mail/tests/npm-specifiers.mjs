// Edge Functions import packages as "npm:name@version" (Deno style). Node doesn't know that
// prefix, so the tests map it to the copy in node_modules. The functions live in the repo's
// supabase/functions, outside this folder, so resolve from here to use tools/mail/node_modules.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('npm:')) {
    const bare = specifier.slice(4).replace(/@[^@/]+$/, '')
    return next(bare, { ...context, parentURL: import.meta.url })
  }
  return next(specifier, context)
}
