import { Loader } from "lucide-react";

import { cn } from "@/lib/utils";

export default function InlineLoaderSimple({
  text = "Loading...",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit items-center justify-center gap-x-3 whitespace-nowrap rounded-sm bg-blue-400/20 px-4 py-0.5 font-bold text-ublue",
        className
      )}
    >
      <Loader size={14} />
      <span className="text-sm">{text}</span>
    </div>
  );
}
