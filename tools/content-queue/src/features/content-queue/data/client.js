// Content Queue does not create its own Supabase client. This is the admin's one shared client
// (public/admin/supabase.js), so it runs on the same session as the Hub and the other tools.
// It is loaded from the site at run time rather than bundled. The path sits in a variable so
// Vite leaves it alone in dev and in the build.
const SHARED_CLIENT = '/admin/supabase.js'
const shared = await import(/* @vite-ignore */ SHARED_CLIENT)

export const supabase = shared.supabase
export const IMAGE_BUCKET = 'content-images'

// Uploads a post image to content-images/<user id>/<post id>/<random>.jpg and returns its public link.
export async function uploadImage(postId, blob) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Sign in again to upload images.')
  const path = `${data.user.id}/${postId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

export const isUploadedImage = (url) => !!url && url.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/`)
