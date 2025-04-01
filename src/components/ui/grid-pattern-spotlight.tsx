"use client";

import { Spotlight } from "@/components/ui/spotlight";

export function GridPatternSpotlight() {
  return (
    <div className='relative aspect-video h-[350px] w-[700px] md:h-[750px] md:w-[950px] flex-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-primary/20 to-background p-4'>
      <Spotlight
        className='from-blue-800 via-blue-600 to-blue-400 blur-xl dark:from-blue-900 dark:via-blue-500 dark:to-blue-900'
        size={64}
      />
      <div className='absolute inset-0'>
        <svg className='h-full w-full'>
          <defs>
            <pattern
              id='grid-pattern'
              width='8'
              height='8'
              patternUnits='userSpaceOnUse'
            >
              <path
                xmlns='http://www.w3.org/2000/svg'
                d='M0 4H4M4 4V0M4 4H8M4 4V8'
                stroke='currentColor'
                strokeOpacity='0.3'
                className='stroke-white dark:stroke-black'
              />
              <rect
                x='3'
                y='3'
                width='2'
                height='2'
                fill='currentColor'
                fillOpacity='0.25'
                className='fill-white dark:fill-black'
              />
            </pattern>
          </defs>
          <rect width='100%' height='100%' fill='url(#grid-pattern)' />
        </svg>
      </div>
    </div>
  );
}