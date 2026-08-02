import React, { Suspense } from 'react';
import { RecommendationWorkspace } from '../components/RecommendationWorkspace';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading blr.life...</div>}>
        <RecommendationWorkspace />
      </Suspense>
    </main>
  );
}
