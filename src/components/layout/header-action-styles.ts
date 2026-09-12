export const headerControlGeometryClassName =
  "h-11 min-h-11 rounded-[var(--control-radius)]";

export const headerNeutralControlClassName =
  `${headerControlGeometryClassName} transition-colors duration-150 hover:bg-accent/70 aria-expanded:bg-accent/70 dark:hover:bg-muted/70 dark:aria-expanded:bg-muted/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`;

export const headerIconControlClassName =
  `${headerNeutralControlClassName} size-11 min-w-11 px-0`;

export const compactHeaderIconControlClassName =
  "max-[420px]:size-11 max-[420px]:min-w-11 max-[420px]:shrink-0 max-[420px]:justify-center max-[420px]:gap-0 max-[420px]:px-0";
