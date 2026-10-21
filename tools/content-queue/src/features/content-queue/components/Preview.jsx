import { useEffect, useState } from 'react'
import { Bookmark, Globe2, Heart, MessageCircle, Repeat2, Send, Share, ThumbsUp } from 'lucide-react'
import { useQueue } from '../data/QueueContext'
import { resolveImage } from '../data/samples'
import { PLATFORM_BY_ID, truncateAt } from '../lib/platforms'
import { longDate, monthDay, time } from '../lib/dates'

/**
 * A neutral approximation of how a post reads on each platform: where the text folds,
 * how the image is cropped, what sits around it. It does not copy any platform's branding.
 */
export default function Preview({ post }) {
  const p = PLATFORM_BY_ID[post.platform]
  const account = useQueue().accountById(post.account)
  const img = resolveImage(post.imageUrl)
  const [expanded, setExpanded] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [img])
  useEffect(() => setExpanded(false), [post.platform])

  if (!p) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-[14px] border border-dashed border-line2 p-8 text-center text-[14px] leading-relaxed text-faint">
        Pick a platform to see how this post will read there.
      </div>
    )
  }

  const stamp = post.scheduledAt ? `${monthDay(post.scheduledAt)} at ${time(post.scheduledAt)}` : 'Just now'
  const body = post.body || ''
  const props = { post, p, account, img: imgOk ? img : '', onImgError: () => setImgOk(false), body, stamp, expanded, setExpanded }
  const View = { facebook: Feed, linkedin: Feed, instagram: Square, x: Short, gbp: Local, blog: Article, email: Email }[p.id]
  return (
    <div className="mx-auto w-full max-w-[400px]">
      <div className="overflow-hidden rounded-[18px] bg-paper text-ink2 shadow-[0_0_0_1px_rgba(0,0,0,.04)]">
        <View {...props} />
      </div>
      {img && !imgOk && (
        <p className="mt-3 text-[13px] leading-relaxed text-danger">The image did not load. Check that the address points straight to an image file and is public.</p>
      )}
    </div>
  )
}

function Avatar({ account, size = 40 }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ink2 font-sans text-[13px] font-semibold tracking-[0.02em] text-paper"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden="true"
    >
      {account.initials}
    </span>
  )
}

function Folded({ text, fold, expanded, setExpanded, className = '', prefix }) {
  if (!text) return <p className={`italic text-slate ${className}`}>Your post text shows here.</p>
  const { head, cut } = fold ? truncateAt(text, fold) : { head: text, cut: false }
  const show = expanded || !cut ? text : head
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {prefix && <span className="font-semibold">{prefix} </span>}
      {highlight(show)}
      {cut && !expanded && (
        <>
          {'... '}
          <button type="button" onClick={() => setExpanded(true)} className="font-medium text-slate hover:underline">
            more
          </button>
        </>
      )}
    </p>
  )
}

function highlight(text) {
  return text.split(/(#[\p{L}\p{N}_]+|https?:\/\/\S+)/gu).map((part, i) =>
    /^(#|https?:)/.test(part) ? (
      <span key={i} className="text-[#2c5a8a]">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

function Img({ img, onImgError, ratio, className = '' }) {
  if (!img) return null
  return (
    <div className={`overflow-hidden bg-[#e6e4df] ${className}`} style={{ aspectRatio: ratio }}>
      <img src={img} alt="" className="h-full w-full object-cover" onError={onImgError} draggable={false} />
    </div>
  )
}

function Feed({ p, account, img, onImgError, body, stamp, expanded, setExpanded }) {
  const li = p.id === 'linkedin'
  return (
    <article className="text-[14.5px] leading-[1.45]">
      <header className="flex items-center gap-2.5 px-4 pb-2.5 pt-4">
        <Avatar account={account} size={li ? 44 : 40} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[14.5px] font-semibold">{account.name}</div>
          {li && <div className="truncate text-[12.5px] text-slate">{account.about}</div>}
          <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-slate">
            {stamp} <span aria-hidden="true">·</span> <Globe2 size={12} />
          </div>
        </div>
      </header>
      <Folded text={body} fold={p.fold} expanded={expanded} setExpanded={setExpanded} className="px-4 pb-3" />
      <Img img={img} onImgError={onImgError} ratio={li ? '1.2 / 1' : '1 / 1'} />
      <footer className="flex justify-around border-t border-black/10 px-2 py-2 text-[13px] font-medium text-slate">
        <span className="inline-flex items-center gap-1.5 px-2 py-1.5"><ThumbsUp size={16} /> Like</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1.5"><MessageCircle size={16} /> Comment</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1.5">{li ? <Repeat2 size={16} /> : <Share size={16} />} {li ? 'Repost' : 'Share'}</span>
      </footer>
    </article>
  )
}

function Square({ p, account, img, onImgError, body, stamp, expanded, setExpanded }) {
  return (
    <article className="text-[14px] leading-[1.45]">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar account={account} size={32} />
        <span className="text-[13.5px] font-semibold">{account.handle}</span>
      </header>
      {img ? (
        <Img img={img} onImgError={onImgError} ratio="4 / 5" />
      ) : (
        <div className="grid aspect-[4/5] place-items-center bg-[#e6e4df] px-10 text-center text-[13px] text-slate">This platform needs an image. Add an image URL to see it here.</div>
      )}
      <div className="flex items-center gap-4 px-3 pb-1 pt-2.5">
        <Heart size={22} strokeWidth={1.7} />
        <MessageCircle size={22} strokeWidth={1.7} />
        <Send size={21} strokeWidth={1.7} />
        <Bookmark size={21} strokeWidth={1.7} className="ml-auto" />
      </div>
      <div className="px-3 pb-3.5 pt-1">
        <Folded text={body} prefix={body ? account.handle : ''} fold={p.fold} expanded={expanded} setExpanded={setExpanded} />
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.04em] text-slate">{stamp}</div>
      </div>
    </article>
  )
}

function Short({ account, img, onImgError, body, stamp }) {
  return (
    <article className="flex gap-3 px-4 py-4 text-[15px] leading-[1.4]">
      <Avatar account={account} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1 text-[14.5px]">
          <span className="truncate font-semibold">{account.name}</span>
          <span className="truncate text-slate">@{account.handle} · {stamp.split(' at ')[0]}</span>
        </div>
        <OverLimit text={body} limit={280} />
        {img && <Img img={img} onImgError={onImgError} ratio="16 / 9" className="mt-3 rounded-[14px] border border-black/10" />}
        <div className="mt-3 flex justify-between pr-6 text-slate">
          <MessageCircle size={17} />
          <Repeat2 size={17} />
          <Heart size={17} />
          <Share size={17} />
        </div>
      </div>
    </article>
  )
}

// Shows the part past the limit tinted, so it is clear what has to go.
function OverLimit({ text, limit }) {
  if (!text) return <p className="mt-0.5 italic text-slate">Your post text shows here.</p>
  const chars = Array.from(text)
  const ok = chars.slice(0, limit).join('')
  const extra = chars.slice(limit).join('')
  return (
    <p className="mt-0.5 whitespace-pre-wrap break-words">
      {highlight(ok)}
      {extra && <span className="rounded-[3px] bg-[#e0625a33] text-[#9a2f28]">{extra}</span>}
    </p>
  )
}

function Local({ account, img, onImgError, body, stamp, expanded, setExpanded }) {
  return (
    <article className="text-[14px] leading-[1.5]">
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Avatar account={account} size={36} />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold">{account.name}</div>
          <div className="text-[12.5px] text-slate">Update · {stamp.split(' at ')[0]}</div>
        </div>
      </header>
      <Img img={img} onImgError={onImgError} ratio="4 / 3" />
      <div className="px-4 pb-4 pt-3">
        <Folded text={body} fold={230} expanded={expanded} setExpanded={setExpanded} />
        <span className="mt-3 inline-flex rounded-full border border-black/15 px-4 py-2 text-[13.5px] font-medium text-[#2c5a8a]">Learn more</span>
      </div>
    </article>
  )
}

function Article({ post, account, img, onImgError, body }) {
  const w = (body.match(/\S+/g) || []).length
  const paras = body.split(/\n{2,}/).filter(Boolean)
  return (
    <article>
      <Img img={img} onImgError={onImgError} ratio="16 / 9" />
      <div className="px-5 pb-6 pt-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate">{account.site}</div>
        <h3 className="mt-2 text-balance font-display text-[24px] font-[460] leading-[1.15] tracking-[-0.01em]">{post.title || 'Post title'}</h3>
        <div className="mt-2 text-[12.5px] text-slate">
          {account.name} · {post.scheduledAt ? longDate(post.scheduledAt) : 'Draft'} · {Math.max(1, Math.round(w / 238))} min read
        </div>
        <div className="mt-4 flex flex-col gap-3 font-display text-[15px] leading-[1.65]">
          {paras.length ? paras.slice(0, 4).map((t, i) => <p key={i} className="whitespace-pre-wrap">{t}</p>) : <p className="italic text-slate">Your article text shows here.</p>}
          {paras.length > 4 && <p className="text-slate">...</p>}
        </div>
      </div>
    </article>
  )
}

function Email({ post, account, img, onImgError, body, stamp }) {
  const pre = body.replace(/\s+/g, ' ').trim().slice(0, 90)
  return (
    <div>
      <div className="border-b border-black/10 bg-[#ecebe7] px-4 py-3">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate">Inbox</div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-semibold">{account.name}</span>
          <span className="shrink-0 text-[12px] text-slate">{stamp.split(' at ')[1] || stamp}</span>
        </div>
        <div className="truncate text-[14px] font-medium">{post.title || 'Subject line'}</div>
        <div className="truncate text-[13px] text-slate">{pre || 'Preview text comes from the first line of the email.'}</div>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Avatar account={account} size={32} />
          <div className="text-[13px] leading-tight">
            <div className="font-semibold">{account.name}</div>
            <div className="text-slate">to me</div>
          </div>
        </div>
        <h3 className="mt-4 font-display text-[21px] font-[460] leading-tight">{post.title || 'Subject line'}</h3>
        {img && <Img img={img} onImgError={onImgError} ratio="16 / 9" className="mt-4 rounded-[8px]" />}
        <p className="mt-4 whitespace-pre-wrap text-[14.5px] leading-[1.6]">{body || <span className="italic text-slate">Your email text shows here.</span>}</p>
      </div>
    </div>
  )
}
