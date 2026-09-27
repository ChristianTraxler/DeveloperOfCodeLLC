import { steps } from '../content.js'
import ExtLink from './ExtLink.jsx'

export default function Process() {
  return (
    <section id="process" className="theme-dusk section" aria-labelledby="process-title">
      <div className="wrap">
        <div className="grid grid-cols-12 gap-x-6 gap-y-5">
          <h2 id="process-title" className="t-h2 col-span-12 lg:col-span-7">
            How a project runs
          </h2>
          <p className="t-lede col-span-12 text-muted lg:col-span-4 lg:col-start-9 lg:self-end">
            Four steps and one point of contact. Nothing gets built until you’ve seen the plan in writing.
          </p>
        </div>
        <ol className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="step rule-t pt-7">
              <p className="t-label text-muted" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="t-h3 mt-3">{step.title}</h3>
              <p className="t-small mt-3 text-fg/75">{step.body}</p>
              {step.link && (
                <ExtLink href={step.link.href} className="u-link t-small mt-4 inline-block font-semibold">
                  {step.link.label}
                </ExtLink>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
