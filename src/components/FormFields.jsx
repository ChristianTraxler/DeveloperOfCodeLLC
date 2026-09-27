import { CheckIcon, PlusIcon } from './Icons.jsx'

export const fieldId = (name) =>
  `f-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`

function Heading({ field, htmlFor, legend = false }) {
  const content = (
    <>
      {field.label}
      {field.required && !field.quietRequired && <span className="field-req">Required</span>}
    </>
  )
  return legend ? (
    <legend className="field-label">{content}</legend>
  ) : (
    <label className="field-label" htmlFor={htmlFor}>
      {content}
    </label>
  )
}

const Hint = ({ id, text }) => (text ? <p id={id} className="field-hint">{text}</p> : null)
const Problem = ({ id, text }) => (text ? <p id={id} className="field-error">{text}</p> : null)

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch-track" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

export function Field({ field, values, onChange, error, className = '' }) {
  const key = field.name || field.names[0]
  const id = fieldId(key)
  const hintId = field.hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const value = field.name ? values[field.name] : undefined
  const invalid = error ? 'true' : undefined

  if (['text', 'email', 'tel', 'url', 'number', 'date'].includes(field.kind)) {
    return (
      <div className={`field ${className}`}>
        <Heading field={field} htmlFor={id} />
        <Hint id={hintId} text={field.hint} />
        <input
          id={id}
          name={field.name}
          className="input"
          type={field.kind}
          value={value ?? ''}
          onChange={(event) => onChange(field.name, event.target.value)}
          autoComplete={field.autoComplete || 'off'}
          placeholder={field.placeholder}
          inputMode={field.inputMode}
          min={field.min}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-required={field.required || undefined}
        />
        <Problem id={errorId} text={error} />
      </div>
    )
  }

  if (field.kind === 'textarea') {
    return (
      <div className={`field ${className}`}>
        <Heading field={field} htmlFor={id} />
        <Hint id={hintId} text={field.hint} />
        <textarea
          id={id}
          name={field.name}
          className="input"
          rows={field.rows || 4}
          value={value ?? ''}
          onChange={(event) => onChange(field.name, event.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-required={field.required || undefined}
        />
        <Problem id={errorId} text={error} />
      </div>
    )
  }

  if (field.kind === 'cards' || field.kind === 'segmented' || field.kind === 'choiceChips') {
    const group =
      field.kind === 'cards' ? `choice-grid cols-${field.cols || 2}` : field.kind === 'segmented' ? 'segmented' : 'chip-set'
    const item = field.kind === 'cards' ? 'choice' : field.kind === 'segmented' ? 'seg' : 'chip'
    return (
      <fieldset id={id} className={`field ${className}`} aria-describedby={describedBy}>
        <Heading field={field} legend />
        <Hint id={hintId} text={field.hint} />
        <div className={group}>
          {field.options.map((option, index) => {
            const checked = value === option.value
            return (
              <label key={option.value} className={item} data-checked={checked}>
                <input
                  type="radio"
                  id={index === 0 ? `${id}-0` : undefined}
                  name={field.name}
                  value={option.value}
                  checked={checked}
                  onChange={() => onChange(field.name, option.value)}
                  onClick={() => {
                    if (checked && !field.required) onChange(field.name, '')
                  }}
                  aria-invalid={invalid}
                />
                {field.kind === 'cards' ? (
                  <>
                    <span className="choice-title">{option.label}</span>
                    {option.detail && <span className="choice-detail">{option.detail}</span>}
                  </>
                ) : field.kind === 'choiceChips' ? (
                  <>
                    <span className="chip-radio" aria-hidden="true" />
                    {option.label}
                  </>
                ) : (
                  option.label
                )}
              </label>
            )
          })}
        </div>
        <Problem id={errorId} text={error} />
      </fieldset>
    )
  }

  if (field.kind === 'chips') {
    const list = Array.isArray(value) ? value : []
    return (
      <fieldset id={id} className={`field ${className}`} aria-describedby={describedBy}>
        <Heading field={field} legend />
        <Hint id={hintId} text={field.hint} />
        <div className="chip-set">
          {field.options.map((option, index) => {
            const checked = list.includes(option.value)
            return (
              <label key={option.value} className="chip" data-checked={checked}>
                <input
                  type="checkbox"
                  id={index === 0 ? `${id}-0` : undefined}
                  name={field.name}
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    onChange(field.name, checked ? list.filter((v) => v !== option.value) : [...list, option.value])
                  }
                />
                <span className="chip-mark" aria-hidden="true">
                  {checked ? <CheckIcon /> : <PlusIcon />}
                </span>
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }

  if (field.kind === 'colors') {
    return (
      <fieldset className={`field ${className}`} aria-describedby={hintId}>
        <Heading field={field} legend />
        <Hint id={hintId} text={field.hint} />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {field.names.map((name, index) => {
            const colorId = fieldId(name)
            const current = values[name] || ''
            const valid = /^#[0-9a-f]{6}$/i.test(current)
            return (
              <div key={name} className="color-field">
                <span className="swatch" style={valid ? { background: current } : undefined}>
                  <input
                    type="color"
                    aria-label={`Choose the ${field.labels[index].toLowerCase()} color`}
                    value={valid ? current : '#112448'}
                    onChange={(event) => onChange(name, event.target.value)}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <label htmlFor={colorId} className="t-label block text-muted">
                    {field.labels[index]}
                  </label>
                  <input
                    id={colorId}
                    className="color-hex"
                    value={current}
                    placeholder="#000000"
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => onChange(name, event.target.value)}
                  />
                </span>
              </div>
            )
          })}
        </div>
      </fieldset>
    )
  }

  if (field.kind === 'urls') {
    return (
      <fieldset className={`field ${className}`} aria-describedby={hintId}>
        <Heading field={field} legend />
        <Hint id={hintId} text={field.hint} />
        <div className="grid gap-2.5">
          {field.names.map((name, index) => (
            <input
              key={name}
              id={fieldId(name)}
              className="input !mt-0 first:!mt-3"
              type="url"
              placeholder="https://"
              aria-label={`Website ${index + 1}`}
              value={values[name] ?? ''}
              onChange={(event) => onChange(name, event.target.value)}
            />
          ))}
        </div>
      </fieldset>
    )
  }

  return null
}
