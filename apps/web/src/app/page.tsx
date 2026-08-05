import React, { Suspense } from 'react';
import { RecommendationWorkspace } from '../components/RecommendationWorkspace';

export default function Home() {
  return (
    <main>
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center font-sans text-brand-primary">Loading blr.life...</div>}>
        <RecommendationWorkspace />
      </Suspense>
    </main>
  );
}
