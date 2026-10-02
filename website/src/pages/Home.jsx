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
    <Bento/>
    <MemorySection/>
    <MobileSection/>
    <Security/>
    <PricingSection/>
    <DownloadSection/>
    <FaqSection/>
    <FinalCta/>
  </>;
}
