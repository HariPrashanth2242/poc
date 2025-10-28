'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first video
    router.replace('/shorts/1');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen w-full bg-black">
      <div className="text-white">Loading reels...</div>
    </div>
  );
}
