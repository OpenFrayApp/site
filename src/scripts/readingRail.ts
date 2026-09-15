// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

interface ReadingRailOptions {
  root?: Document;
  linkSelector: string;
  scrollContainerSelector?: string;
  closeToggleSelector?: string;
}

/** Return the decoded target id from an in-page link. */
function targetId(link: HTMLAnchorElement) {
  return decodeURIComponent(link.hash.slice(1));
}

/** Keep a link visible by scrolling only its independently scrolling container. */
function keepVisible(link: HTMLAnchorElement, container?: HTMLElement | null) {
  if (!container) return;

  const linkBounds = link.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  if (containerBounds.height === 0) return;

  if (linkBounds.top < containerBounds.top) {
    container.scrollTop -= containerBounds.top - linkBounds.top;
  } else if (linkBounds.bottom > containerBounds.bottom) {
    container.scrollTop += linkBounds.bottom - containerBounds.bottom;
  }
}

/** Add current-section tracking and optional mobile-panel closing to a reading rail. */
export function setupReadingRail({
  root = document,
  linkSelector,
  scrollContainerSelector,
  closeToggleSelector,
}: ReadingRailOptions) {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(linkSelector));
  const targets = links
    .map((link) => root.getElementById(targetId(link)))
    .filter((element): element is HTMLElement => Boolean(element));
  const scrollContainer = scrollContainerSelector
    ? root.querySelector<HTMLElement>(scrollContainerSelector)
    : null;
  const closeToggle = closeToggleSelector
    ? root.querySelector<HTMLInputElement>(closeToggleSelector)
    : null;

  for (const link of links) {
    link.addEventListener('click', () => {
      if (closeToggle) closeToggle.checked = false;
    });
  }

  if (!links.length || !targets.length) return;

  /** Mark one link as the reader's current location. */
  const markCurrentLink = (id: string) => {
    for (const link of links) {
      const current = targetId(link) === id;
      if (current) {
        link.setAttribute('aria-current', 'true');
        keepVisible(link, scrollContainer);
      } else {
        link.removeAttribute('aria-current');
      }
    }
  };

  /** Select the last heading that has reached the reading line. */
  const syncCurrentSection = () => {
    let current = targets[0];
    for (const target of targets) {
      if (target.getBoundingClientRect().top <= 120) current = target;
    }
    markCurrentLink(current.id);
  };

  syncCurrentSection();
  root.defaultView?.addEventListener('scroll', syncCurrentSection, { passive: true });
  root.defaultView?.addEventListener('resize', syncCurrentSection, { passive: true });
}
