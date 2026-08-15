// The zoomable-screenshot classes shared by every page with a gallery. The magnifier
// only appears on hover or keyboard focus — at rest the picture is the picture, and
// the affordance would just be furniture.
export const zoomTrigger =
  'group relative block w-full cursor-zoom-in overflow-hidden border border-border p-0 ' +
  'transition-[border-color] hover:border-accent focus-visible:border-accent ' +
  'focus-visible:outline-none';

export const zoomOverlay =
  'pointer-events-none absolute inset-0 grid place-items-center bg-bg/75 opacity-0 ' +
  'transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100';

export const zoomBadge =
  'grid size-12 place-items-center rounded-full border border-border bg-panel text-text';
