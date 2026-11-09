"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "sm", ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "shrink-0 border border-gray-200 py-1 text-[11px] shadow-slate-200",
        className
      )}
      {...props}
    />
  )
);
ToolbarButton.displayName = "ToolbarButton";
