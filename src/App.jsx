import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Intro from './components/Intro.jsx'
import Work from './components/Work.jsx'
import Services from './components/Services.jsx'
import Process from './components/Process.jsx'
import Band from './components/Band.jsx'
import About from './components/About.jsx'
import Voices from './components/Voices.jsx'
import Shop from './components/Shop.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import ScrollTop from './components/ScrollTop.jsx'

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Intro />
        <Work />
        <Services />
        <Process />
        <Band />
        <About />
        <Voices />
        <Shop />
        <Contact />
      </main>
      <Footer />
      <ScrollTop />
    </>
  )
}
