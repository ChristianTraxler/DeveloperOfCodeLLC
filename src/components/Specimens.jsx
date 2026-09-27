import { Fragment } from 'react'
import { CheckIcon } from './Icons.jsx'

// Small, original interface sketches for each product, drawn in the site palette. Decorative only.
const Line = ({ w, faint = false }) => <span className={faint ? 'mock-line is-faint' : 'mock-line'} style={{ width: w }} />

function CrmBoard() {
  const columns = [
    { title: 'Lead', cards: 3 },
    { title: 'Contacted', cards: 2 },
    { title: 'Proposal', cards: 2, hot: 0 },
    { title: 'Won', cards: 3 },
  ]
  const widths = ['78%', '62%', '70%']
  return (
    <>
      <div className="mock-bar">
        <span className="mock-logo">
          Relay<b>.</b>
        </span>
        <span className="mock-search">
          Search<kbd>⌘K</kbd>
        </span>
      </div>
      <div className="mock-board">
        {columns.map((column) => (
          <div key={column.title} className="mock-col">
            <p className="mock-col-title">
              {column.title}
              <span>{column.cards}</span>
            </p>
            {Array.from({ length: column.cards }, (_, i) => (
              <div key={i} className={column.hot === i ? 'mock-card is-hot' : 'mock-card'}>
                <span className="mock-avatar" />
                <Line w={widths[i % 3]} />
                <Line w="44%" faint />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function SoloPhone({ className = '' }) {
  const rows = [{ w: '72%' }, { w: '58%', due: true }, { w: '66%' }, { w: '50%' }]
  return (
    <div className={`mock-phone ${className}`}>
      <div className="mock-phone-head">
        <span className="mock-logo is-small">
          Relay<b>.</b>
        </span>
        <span className="mock-avatar is-small" />
      </div>
      <p className="mock-phone-title">Today</p>
      <ul className="mock-list">
        {rows.map((row, i) => (
          <li key={i}>
            <span className="mock-avatar" />
            <span className="mock-stack">
              <Line w={row.w} />
              <Line w="40%" faint />
            </span>
            {row.due && <span className="mock-chip">Due</span>}
          </li>
        ))}
      </ul>
      <div className="mock-recurring">
        <span>Recurring payments</span>
        <span className="mock-toggle" />
      </div>
      <div className="mock-tabs">
        <span className="is-on">Clients</span>
        <span>Deals</span>
        <span>Tasks</span>
      </div>
    </div>
  )
}

export function CrmSpecimen({ className = '' }) {
  return (
    <div className={`plate plate-wide ${className}`} aria-hidden="true">
      <CrmBoard />
    </div>
  )
}

export function SoloSpecimen({ className = '' }) {
  return (
    <div className={`plate plate-wide plate-tint plate-center ${className}`} aria-hidden="true">
      <SoloPhone />
      <div className="mock-toast">
        <span className="mock-check">
          <CheckIcon />
        </span>
        <span className="mock-stack">
          <span className="mock-toast-title">Payment received</span>
          <Line w="72%" faint />
        </span>
      </div>
    </div>
  )
}

// Both Relay products together: the team pipeline with the solo phone app in front.
export function FamilySpecimen({ className = '' }) {
  return (
    <div className={`plate plate-wide plate-family ${className}`} aria-hidden="true">
      <CrmBoard />
      <SoloPhone className="family-phone" />
    </div>
  )
}

export function HabitSpecimen() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const habits = [
    ['Read', '1101111'],
    ['Walk', '1011101'],
    ['Water', '1111111'],
    ['Journal', '0111011'],
  ]
  return (
    <div className="plate" aria-hidden="true">
      <p className="mock-title">Habits</p>
      <div className="mock-habits">
        <span />
        {days.map((day, i) => (
          <span key={i} className="mock-day">
            {day}
          </span>
        ))}
        {habits.map(([name, pattern]) => (
          <Fragment key={name}>
            <span className="mock-habit">{name}</span>
            {pattern.split('').map((mark, i) => (
              <span
                key={i}
                className={`mock-dot${mark === '1' ? ' is-on' : ''}${name === 'Water' && i >= 3 ? ' is-streak' : ''}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="mock-foot">
        <span>Weekly review</span>
        <span className="mock-meter">
          <i style={{ width: '78%' }} />
        </span>
      </div>
    </div>
  )
}

export function WeddingSpecimen() {
  const tasks = [
    ['Venue booked', true],
    ['Invitations sent', true],
    ['Seating chart', false],
  ]
  return (
    <div className="plate" aria-hidden="true">
      <p className="mock-title">Wedding plan</p>
      <div className="mock-row">
        <span>Budget</span>
        <span className="mock-meter is-lamp">
          <i style={{ width: '62%' }} />
        </span>
      </div>
      <ul className="mock-tasks">
        {tasks.map(([task, done]) => (
          <li key={task} className={done ? 'is-done' : undefined}>
            <span className="mock-box">{done && <CheckIcon />}</span>
            {task}
          </li>
        ))}
      </ul>
      <div className="mock-tables">
        {[0, 1, 2].map((table) => (
          <span key={table} className="mock-table">
            {Array.from({ length: 6 }, (_, seat) => (
              <i key={seat} style={{ '--a': `${seat * 60}deg` }} />
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}

export function JournalSpecimen() {
  return (
    <div className="plate plate-paper" aria-hidden="true">
      <p className="mock-date">Tuesday evening</p>
      <p className="mock-prompt">What went well today?</p>
      <div className="mock-rules">
        <span>
          <Line w="86%" />
        </span>
        <span>
          <Line w="64%" />
        </span>
        <span />
        <span />
      </div>
      <div className="mock-moods">
        <span>Mood</span>
        {[0, 1, 2, 3, 4].map((mood) => (
          <i key={mood} className={mood === 3 ? 'is-on' : undefined} />
        ))}
      </div>
    </div>
  )
}
