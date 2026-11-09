"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const SliderSlim = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer touch-none select-none items-center py-1",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[3px] w-full grow cursor-pointer overflow-hidden rounded-full bg-slate-200">
      <SliderPrimitive.Range className="absolute h-full bg-[#1D667F]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-4 cursor-pointer rounded-full border-none bg-[#1D667F] shadow-sm transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D667F]/30 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
SliderSlim.displayName = "SliderSlim";

export { SliderSlim };
