'use client';

import {ScreenShareProvider} from '@/lib/provider/screen-share-context';

export function Providers({children}: { children: React.ReactNode }) {
  return (
      <ScreenShareProvider>
        {children}
      </ScreenShareProvider>
  );
}