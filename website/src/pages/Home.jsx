import React from 'react';
import { DemoStage, Hero } from '../sections/Hero.jsx';
import { Highlights, HowItWorks, ToolsMarquee } from '../sections/Story.jsx';
import { Bento } from '../sections/Bento.jsx';
import { AgentsSection } from '../sections/Agents.jsx';
import { MemorySection } from '../sections/Memory.jsx';
import { MobileSection } from '../sections/Mobile.jsx';
import { Security } from '../sections/Security.jsx';
import { DownloadSection, FaqSection, FinalCta, PricingSection } from '../sections/Closing.jsx';

export default function Home() {
  return <>
    <Hero/>
    <DemoStage/>
    <AgentsSection/>
    <ToolsMarquee/>
    <HowItWorks/>
    <Highlights/>
    <div className="section-deferred"><Bento/></div>
    <div className="section-deferred"><MemorySection/></div>
    <div className="section-deferred"><MobileSection/></div>
    <div className="section-deferred"><Security/></div>
    <div className="section-deferred"><PricingSection/></div>
    <div className="section-deferred"><DownloadSection/></div>
    <div className="section-deferred"><FaqSection/></div>
    <div className="section-deferred"><FinalCta/></div>
  </>;
}
