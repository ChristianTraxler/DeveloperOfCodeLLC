import { useEffect, useRef, useState } from 'react'
import { useCanHover, useInView, useReducedMotion, prefersSaveData } from '../../lib/hooks'
import { track } from '../../lib/track'
import { Icon } from './Icons'

// A 9:16 phone shell. Content fills the screen area.
export function PhoneFrame({ children, className = '', size = 'md' }) {
  const radius = size === 'lg' ? 'rounded-[2.4rem] p-[7px]' : 'rounded-[2rem] p-[6px]'
  return (
    <div className={`relative bg-[#05070d] shadow-phone ${radius} ${className}`}>
      <div className={`relative aspect-[9/16] overflow-hidden bg-night ${size === 'lg' ? 'rounded-[2rem]' : 'rounded-[1.65rem]'}`}>
        {children}
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-2 z-20 h-[18px] w-[30%] -translate-x-1/2 rounded-full bg-[#05070d]" />
      </div>
    </div>
  )
}

const toneMap = {
  ember: 'from-[#3a1b14] via-[#7a3520] to-[#F07A45]',
  cobalt: 'from-[#0b1532] via-[#1c2f7a] to-[#3f63d6]',
  signal: 'from-[#0b2018] via-[#165238] to-[#4CC38A]',
  navy: 'from-[#070d1d] via-[#112448] to-[#3A548F]',
}

// Designed stand-in for a reel: gradient, grain, caption, fake play button.
// No stock photos of people.
// `mini` hides the text on very small phones, where it would be too tiny to read.
export function MockReel({ caption, tag, tone = 'ember', comingSoon = false, compact = false, mini = false }) {
  const hideSmall = mini ? 'hidden sm:block' : ''
  return (
    <div className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-br ${toneMap[tone] || toneMap.ember} text-paper`}>
      <div aria-hidden="true" className="grain absolute inset-0 opacity-40 mix-blend-overlay" />
      <div aria-hidden="true" className="absolute -right-10 top-1/4 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative z-10 flex items-center justify-between px-4 pt-9">
        {tag && (
          <span className={`${mini ? 'hidden sm:inline' : ''}`}>
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] backdrop-blur-sm">
            {tag}
          </span>
          </span>
        )}
        <span aria-hidden="true" className="ml-auto flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1 rounded-full bg-white/70 ${i === 0 ? 'w-5' : 'w-2 opacity-50'}`} />
          ))}
        </span>
      </div>
      <div aria-hidden="true" className="relative z-10 grid place-items-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur-md">
          <Icon name="play" className="ml-0.5 h-5 w-5" />
        </span>
      </div>
      <div className={`relative z-10 px-4 pb-5 ${hideSmall}`}>
        {comingSoon && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-navy">
            <span className="h-1.5 w-1.5 rounded-full bg-ember" />
            Sample reel coming soon
          </span>
        )}
        <p className={`font-display font-normal leading-[1.08] ${compact ? 'text-lg' : 'text-[1.35rem]'}`}>
          <span className="box-decoration-clone rounded bg-black/30 px-1.5 py-0.5">{caption}</span>
        </p>
        <div aria-hidden="true" className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/20">
          <span className="block h-full w-1/3 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  )
}

/*
 * Plays a real sample inside a PhoneFrame.
 * mode "hover": desktop plays on hover or focus, touch devices tap to play.
 * mode "auto": plays muted while on screen (hero), unless reduced motion or data saver.
 * The video never downloads until it is about to play (preload="none" + poster).
 */
// Remembered for the visit: once someone turns sound on, the next video starts with it on.
let soundPreferred = false

export function SampleVideo({ sample, mode = 'hover', label, location = 'showcase' }) {
  const videoRef = useRef(null)
  const reduced = useReducedMotion()
  const canHover = useCanHover()
  const [wrapRef, onScreen] = useInView({ once: false, threshold: 0.35, rootMargin: '0px' })
  const [playing, setPlaying] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const autoAllowed = mode === 'auto' && !reduced && !prefersSaveData()

  const play = () => {
    const v = videoRef.current
    if (!v) return
    if (sample.hasAudio && soundPreferred) {
      v.muted = false
      setSoundOn(true)
    }
    const p = v.play()
    if (p && p.catch) p.catch(() => setPlaying(false))
  }
  const pause = () => videoRef.current && videoRef.current.pause()

  useEffect(() => {
    if (!onScreen) pause()
    else if (autoAllowed && !userPaused) play()
  }, [onScreen, autoAllowed, userPaused])

  const toggle = () => {
    if (playing) {
      pause()
      setUserPaused(true)
    } else {
      setUserPaused(false)
      play()
      track(`play_${sample.id}`, location)
    }
  }

  const toggleSound = () => {
    const v = videoRef.current
    if (!v) return
    const next = v.muted
    soundPreferred = next
    v.muted = !next
    setSoundOn(next)
    track(`sound_${next ? 'on' : 'off'}_${sample.id}`, location)
  }

  const hoverHandlers =
    mode === 'hover' && canHover && !reduced
      ? { onMouseEnter: () => !userPaused && play(), onMouseLeave: () => pause() }
      : {}

  return (
    <div ref={wrapRef} className="absolute inset-0" {...hoverHandlers}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster={sample.poster}
        preload="none"
        muted
        loop
        playsInline
        aria-label={label || `${sample.style} sample video: ${sample.title}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={sample.src} type="video/mp4" />
        {sample.webm && <source src={sample.webm} type="video/webm" />}
      </video>
      <button
        type="button"
        onClick={toggle}
        data-cta={`play_${sample.id}`}
        data-cta-location={location}
        aria-pressed={playing}
        aria-label={`${playing ? 'Pause' : 'Play'} sample: ${sample.title}`}
        className={`absolute z-10 grid place-items-center rounded-full text-paper ring-1 ring-white/40 backdrop-blur-md transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${
          playing
            ? 'bottom-3 right-3 h-10 w-10 bg-black/40 opacity-70 hover:opacity-100'
            : 'left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 bg-black/35 hover:scale-105 hover:bg-black/50'
        }`}
      >
        <Icon name={playing ? 'pause' : 'play'} className={playing ? 'h-4 w-4' : 'ml-1 h-6 w-6'} />
      </button>
      {sample.hasAudio && (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={`${soundOn ? 'Turn sound off' : 'Turn sound on'}: ${sample.title}`}
          className="absolute bottom-3 left-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-paper ring-1 ring-white/40 backdrop-blur-md transition duration-300 hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
            {soundOn ? (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </>
            ) : (
              <>
                <path d="m16 9 5 6" />
                <path d="m21 9-5 6" />
              </>
            )}
          </svg>
        </button>
      )}
    </div>
  )
}
