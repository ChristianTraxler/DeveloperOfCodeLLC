import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Setup from './components/Setup.jsx'
import Care from './components/Care.jsx'
import AddOns from './components/AddOns.jsx'
import Video from './components/Video.jsx'
import Estimator from './components/Estimator.jsx'
import Terms from './components/Terms.jsx'
import { Faq, Closing } from './components/Closing.jsx'
import { useReveal } from './components/ui.jsx'

export default function App() {
  useReveal()
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-snow focus:px-4 focus:py-2 focus:text-dusk">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Setup />
        <Care />
        <AddOns />
        <Estimator />
        <Video />
        <Terms />
        <Faq />
        <Closing />
      </main>
    </>
  )
}
