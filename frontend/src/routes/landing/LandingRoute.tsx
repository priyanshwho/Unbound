import { SiteHeader } from '../../components/layout/SiteHeader'
import { AboutSection } from '../../sections/landing/AboutSection'
import { ContactSection } from '../../sections/landing/ContactSection'
import { FAQSection } from '../../sections/landing/FAQSection'
import { FeaturesSection } from '../../sections/landing/FeaturesSection'
import { HeroSection } from '../../sections/landing/HeroSection'
import { HowItWorksSection } from '../../sections/landing/HowItWorksSection'
import { FooterSection } from '../../sections/landing/FooterSection'

export function LandingRoute() {
  return <><SiteHeader/><main><HeroSection/><FeaturesSection/><HowItWorksSection/><AboutSection/><FAQSection/><ContactSection/></main><FooterSection/></>
}
