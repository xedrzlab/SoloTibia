/**
 * Landscape-only enforcement: shows a "rotate your device" overlay whenever
 * the viewport is taller than it is wide, and reports the change via
 * `onPortraitChange` so the caller can fold it into its own play/pause
 * decision (main.ts also pauses for tab visibility — the two conditions
 * need to be combined, not fought over independently). Also makes a
 * best-effort attempt at the native Screen Orientation API lock, which only
 * actually works in a handful of contexts (installed PWA/fullscreen on
 * supporting browsers) — the CSS overlay is the reliable fallback everywhere
 * else.
 */
export function initOrientationLock(onPortraitChange: (portrait: boolean) => void) {
  const overlay = document.getElementById("rotate-overlay");
  if (!overlay) return;

  let wasPortrait = false;
  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait === wasPortrait) return;
    wasPortrait = portrait;
    overlay.classList.toggle("visible", portrait);
    onPortraitChange(portrait);
  };

  check();
  window.addEventListener("resize", check);
  window.addEventListener("orientationchange", check);

  type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
  const tryNativeLock = () => {
    const orientation = screen.orientation as LockableOrientation | undefined;
    orientation?.lock?.("landscape").catch(() => {
      // Expected to fail outside fullscreen/installed contexts — the CSS overlay covers it.
    });
  };
  document.addEventListener("pointerdown", tryNativeLock, { once: true });
}
