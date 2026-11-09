import { useState } from 'react';
import '../landing.css';
import LandingHeader from './LandingHeader.jsx';
import HeroSection from './HeroSection.jsx';
import FeaturesSection from './FeaturesSection.jsx';
import IndustriesSection from './IndustriesSection.jsx';
import DevicesSection from './DevicesSection.jsx';
import HowItWorksSection from './HowItWorksSection.jsx';
import DemoBanner from './DemoBanner.jsx';
import FaqSection from './FaqSection.jsx';
import ContactSection from './ContactSection.jsx';
import SiteFooter from './SiteFooter.jsx';
import DemoModal from './DemoModal.jsx';

export default function Landing() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

  return (
    <div className="lp" id="top">
      <LandingHeader onDemo={openDemo} />
      <main>
        <HeroSection onDemo={openDemo} />
        <FeaturesSection />
        <IndustriesSection />
        <DevicesSection />
        <HowItWorksSection />
        <DemoBanner onDemo={openDemo} />
        <FaqSection />
        <ContactSection onDemo={openDemo} />
      </main>
      <SiteFooter />
      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </div>
  );
}
