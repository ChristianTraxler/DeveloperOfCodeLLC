import { projects } from '../content.js'
import ExtLink from './ExtLink.jsx'

// Grid placement for the projects after the featured one, by position.
const layouts = [
  'md:col-span-6 lg:col-span-7',
  'md:col-span-6 lg:col-span-5 lg:mt-28',
  'md:col-span-6 lg:col-span-5',
  'md:col-span-6 lg:col-span-7 lg:mt-28',
  'md:col-span-6 lg:col-span-7',
  'md:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-28',
]

function Shot({ project }) {
  return (
    <ExtLink href={project.url} className="shot" tabIndex={-1}>
      <img
        src={project.shot}
        alt={`Home page of the ${project.name} website`}
        width="1280"
        height="800"
        loading="lazy"
        decoding="async"
      />
    </ExtLink>
  )
}

function VisitLink({ project }) {
  return (
    <ExtLink href={project.url} className="u-link t-small mt-4 inline-block font-semibold">
      Visit the live site<span className="sr-only">: {project.name}</span>
    </ExtLink>
  )
}

export default function Work() {
  const [feature, ...rest] = projects
  return (
    <section id="work" className="theme-dusk section" aria-labelledby="work-title">
      <div className="wrap">
        <div className="grid grid-cols-12 gap-x-6 gap-y-5">
          <h2 id="work-title" className="t-h2 col-span-12 lg:col-span-7">
            Recent work
          </h2>
          <p className="t-lede col-span-12 text-muted lg:col-span-4 lg:col-start-9 lg:self-end">
            Each of these is a live site for a real client. Open one and look around.
          </p>
        </div>

        <article className="work-item mt-14 lg:mt-20">
          <div className="feature-media">
            <Shot project={feature} />
            <div className="phone" aria-hidden="true">
              <img src={feature.mobile} alt="" width="420" height="909" loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="mt-7 grid grid-cols-12 gap-x-6 gap-y-3">
            <div className="col-span-12 md:col-span-6 lg:col-span-5">
              <h3 className="t-h3">{feature.name}</h3>
              <p className="t-label mt-2 text-muted">{feature.kind}</p>
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-5 lg:col-start-7">
              <p className="t-small text-fg/80">{feature.blurb}</p>
              <VisitLink project={feature} />
            </div>
          </div>
        </article>

        <div className="mt-20 grid grid-cols-12 gap-x-6 gap-y-16 lg:mt-28 lg:gap-y-20">
          {rest.map((project, index) => (
            <article key={project.id} className={`work-item col-span-12 ${layouts[index] ?? 'md:col-span-6'}`}>
              <Shot project={project} />
              <h3 className="t-h3 mt-6">{project.name}</h3>
              <p className="t-label mt-2 text-muted">{project.kind}</p>
              <p className="t-small mt-3 max-w-[34rem] text-fg/80">{project.blurb}</p>
              <VisitLink project={project} />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
