import { render } from '@react-email/render';
import { IdeationEmail } from './src/templates/IdeationEmail';
import React from 'react';

async function main() {
  const html = await render(
    <IdeationEmail 
      sourceTitle="Flipboard Ideation Pipeline: Mobile Web Refactor" 
      sourceAuthor="Sovereign Artist" 
      sourceDate="2026-05-12T09:48:42" 
      sourceMaterialSnippet="Flipboard's mobile web layout features interesting snapping physics and large editorial typography. We should explore implementing a similar architecture for the Creative Liberation Engine ideation pipeline UI, considering the performance tradeoffs." 
      directive="Analyze Flipboard's spatial mechanics and typography scale to refactor the Creative Liberation Engine UI into a high-density, scroll-snapped content feed."
      rationale="Our current grid layout is functional but lacks the premium editorial feel that encourages exploratory scrolling. Borrowing Flipboard's snap-to-module behavior can improve readability for long-form briefs."
      options={[
        {
          title: "The 'Editorial Print Style' (Sophisticated)",
          description: "Clean typography, large elegant serif fonts, high contrast, sophisticated magazine layout inspired by Flipboard.",
          architecture: "Implements CSS scroll-snapping and a revised typography scale across the viewport.",
          tradeoffs: "Requires strict adherence to typography rules and tuning physics.",
          recommendation: "PREFERRED",
        },
        {
          title: "The 'Action-Oriented Dashboard' (Interactive UI)",
          description: "Treats the ideation feed as a functional dashboard without editorial flourishes.",
          architecture: "Uses a clean, dense grid layout with fast interaction patterns.",
          tradeoffs: "Functional but loses the premium, immersive feel of an editorial product.",
          recommendation: "VIABLE",
        }
      ]}
    />
  );
  console.log(html);
}

main().catch(console.error);
