"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useWorkoutNavigationHref } from "./workout-navigation-link";

const PRIMARY_LINKS = [
  { href: "/planuri-gratuite", label: "Planuri gratuite", icon: "calendar" },
  { href: "/antrenamentul-meu", label: "Antrenamentul meu", icon: "dumbbell" },
  { href: "/exercitii", label: "Exerciții", icon: "play" },
  { href: "/stil-de-viata", label: "Stil de viață", icon: "leaf" },
  { href: "/alimentatie", label: "Alimentație", icon: "bowl" },
] as const;

const CARD_LINKS = [
  { href: "/abonamente", label: "VEMI Plus", icon: "card", variant: "subscription" },
  { href: "/contul-meu", label: "Contul meu", icon: "user", variant: "account" },
] as const;

type IconName = (typeof PRIMARY_LINKS)[number]["icon"] | (typeof CARD_LINKS)[number]["icon"];

function MenuIcon({ name }: { name: IconName }) {
  const common = {
    "aria-hidden": true,
    className: "vemi-drawer-icon",
    fill: "none",
    viewBox: "0 0 32 32",
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="4.5" y="6.5" width="23" height="21" rx="2.8" />
        <path d="M10 3.8v5.4M22 3.8v5.4M4.5 12h23" />
        <circle cx="10.3" cy="17" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="16" cy="17" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="21.7" cy="17" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="10.3" cy="22.4" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="16" cy="22.4" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "dumbbell") {
    return (
      <svg {...common}>
        <path d="M3.5 13.5v5M7 9.3v13.4M10.7 11.5v9M21.3 11.5v9M25 9.3v13.4M28.5 13.5v5M10.7 16h10.6" />
      </svg>
    );
  }

  if (name === "play") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="12" />
        <path d="m13.4 10.9 7.4 5.1-7.4 5.1Z" />
      </svg>
    );
  }

  if (name === "leaf") {
    return (
      <svg {...common}>
        <path d="M27.2 4.8C17 4.8 8.1 8 6.1 16.1c-1.2 4.8 2 8.7 6.7 8.1 8.3-1 12.9-8.4 14.4-19.4Z" />
        <path d="M4.2 27.6c4.2-6.7 9.5-11.2 17.8-15.5M8.7 20.9l-3.9-.7M13.2 16.4l-.3-4.2" />
      </svg>
    );
  }

  if (name === "bowl") {
    return (
      <svg {...common}>
        <path d="M5 15.2h22c-.7 7.3-4.4 11-11 11s-10.3-3.7-11-11Z" />
        <path d="M9.2 12.6c.7-2.3 2.3-3.5 4.8-3.8M17.1 12.7c1.2-2.9 3.4-4.6 6.4-5.2M20.5 10.2c-.2-2.4.9-4.1 3.3-5.1" />
        <circle cx="11" cy="7.2" r="1.7" />
      </svg>
    );
  }

  if (name === "card") {
    return (
      <svg {...common}>
        <rect x="3.8" y="7.5" width="24.4" height="17" rx="3" />
        <path d="M4 12.1h24M8.2 19.8h4.7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="16" cy="16" r="12.2" />
      <circle cx="16" cy="11.5" r="3.3" />
      <path d="M9.6 24.2c.8-4.1 2.9-6.1 6.4-6.1s5.6 2 6.4 6.1" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="vemi-drawer-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m7.5 4.2 5.4 5.8-5.4 5.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

type DragState = {
  active: boolean;
  cancelled: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocity: number;
};

const EMPTY_DRAG: DragState = {
  active: false,
  cancelled: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastTime: 0,
  velocity: 0,
};

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function VemiNavigationDrawer({ knownHasWorkout }: { knownHasWorkout?: boolean | null } = {}) {
  const mounted = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountDragX, setAccountDragX] = useState(0);
  const [accountDragging, setAccountDragging] = useState(false);
  const effectiveOpen = open;
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.42);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const accountPanelRef = useRef<HTMLElement>(null);
  const accountTriggerRef = useRef<HTMLAnchorElement>(null);
  const accountChevronRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState>({ ...EMPTY_DRAG });
  const accountDragRef = useRef<DragState>({ ...EMPTY_DRAG });
  const accountWasOpenRef = useRef(false);
  const suppressClickRef = useRef(false);
  const scrollYRef = useRef(0);
  const workoutHref = useWorkoutNavigationHref(knownHasWorkout);

  useEffect(() => {
    if (accountOpen) {
      accountWasOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => accountChevronRef.current?.focus({ preventScroll: true }));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!accountWasOpenRef.current) return;
    accountWasOpenRef.current = false;
    const frame = window.requestAnimationFrame(() => accountTriggerRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [accountOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const closeOnDesktop = () => {
      if (!media.matches) {
        setAccountOpen(false);
        setAccountDragX(0);
        setAccountDragging(false);
        setOpen(false);
        setDragX(0);
        setDragging(false);
        setOverlayOpacity(0.42);
      }
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!effectiveOpen) {
      return;
    }

    scrollYRef.current = window.scrollY;
    const trigger = triggerRef.current;

    const body = document.body;
    const bodyStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const root = rootRef.current?.parentElement;
    const backgroundNodes = Array.from(body.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement
        && node !== root)
      .map((node) => ({ node, inert: node.inert, ariaHidden: node.getAttribute("aria-hidden") }));
    backgroundNodes.forEach(({ node }) => {
      node.inert = true;
      node.setAttribute("aria-hidden", "true");
    });

    const focusFrame = window.requestAnimationFrame(() => {
      if (rootRef.current?.dataset.accountOpen === "true") accountChevronRef.current?.focus({ preventScroll: true });
      else closeRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (rootRef.current?.dataset.accountOpen === "true") {
          setAccountOpen(false);
          setAccountDragX(0);
          setAccountDragging(false);
          return;
        }
        setOpen(false);
        setDragX(0);
        setDragging(false);
        setOverlayOpacity(0.42);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const activePanel = rootRef.current?.dataset.accountOpen === "true" ? accountPanelRef.current : panelRef.current;
      if (!activePanel) return;
      const focusable = Array.from(
        activePanel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      const restoreY = scrollYRef.current;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      backgroundNodes.forEach(({ node, inert, ariaHidden }) => {
        node.inert = inert;
        if (ariaHidden === null) node.removeAttribute("aria-hidden");
        else node.setAttribute("aria-hidden", ariaHidden);
      });
      Object.assign(body.style, bodyStyle);
      trigger?.focus({ preventScroll: true });
      const rootScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, restoreY);
      window.requestAnimationFrame(() => {
        window.scrollTo(0, restoreY);
        document.documentElement.style.scrollBehavior = rootScrollBehavior;
      });
    };
  }, [effectiveOpen]);

  const closeDrawer = () => {
    if (accountOpen) {
      setAccountOpen(false);
      setAccountDragX(0);
      setAccountDragging(false);
      return;
    }
    setOpen(false);
    setDragX(0);
    setDragging(false);
    setOverlayOpacity(0.42);
  };

  const openAccountPanel = () => {
    setAccountOpen(true);
    setAccountDragX(0);
    setAccountDragging(false);
  };

  const onAccountPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    accountDragRef.current = {
      active: false,
      cancelled: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
  };

  const onAccountPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = accountDragRef.current;
    if (drag.pointerId !== event.pointerId || drag.cancelled) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx) || dx <= 0) {
        drag.cancelled = true;
        return;
      }
      drag.active = true;
      setAccountDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const now = event.timeStamp;
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const width = accountPanelRef.current?.getBoundingClientRect().width ?? 1;
    setAccountDragX(Math.min(width, Math.max(0, dx)));
  };

  const finishAccountDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = accountDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      const width = accountPanelRef.current?.getBoundingClientRect().width ?? 1;
      const shouldClose = accountDragX >= width * 0.22 || (drag.velocity >= 0.5 && accountDragX > 20);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setAccountDragging(false);
      if (shouldClose) {
        setAccountOpen(false);
        setAccountDragX(0);
      } else {
        setAccountDragX(0);
      }
    }
    accountDragRef.current = { ...EMPTY_DRAG };
  };

  const navigateFromDrawer = (href: string) => {
    setOpen(false);
    setDragX(0);
    setDragging(false);
    setOverlayOpacity(0.42);
    window.location.assign(href);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = {
      active: false,
      cancelled: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId || drag.cancelled) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.active) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx) || dx <= 0) {
        drag.cancelled = true;
        return;
      }
      drag.active = true;
      suppressClickRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const now = event.timeStamp;
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const width = panelRef.current?.getBoundingClientRect().width ?? 1;
    const nextDragX = Math.min(width, Math.max(0, dx));
    setDragX(nextDragX);
    setOverlayOpacity(0.42 * (1 - Math.min(1, nextDragX / width)));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      const width = panelRef.current?.getBoundingClientRect().width ?? 1;
      const shouldClose = dragX >= width * 0.22 || (drag.velocity >= 0.5 && dragX > 20);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
      if (shouldClose) closeDrawer();
      else {
        setDragX(0);
        setOverlayOpacity(0.42);
      }
      window.requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    }
    dragRef.current = { ...EMPTY_DRAG };
  };

  const drawerStyle = {
    "--vemi-drawer-x": `${dragX}px`,
    "--vemi-account-drawer-x": `${accountDragX}px`,
  } as CSSProperties;

  const drawer = (
    <div
      ref={rootRef}
      className="vemi-drawer-root"
      data-open={effectiveOpen ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      data-account-open={accountOpen ? "true" : "false"}
      data-account-dragging={accountDragging ? "true" : "false"}
      aria-hidden={!effectiveOpen}
      style={drawerStyle}
    >
      <button
        className="vemi-drawer-overlay"
        type="button"
        aria-label="Închide meniul"
        tabIndex={-1}
        onClick={closeDrawer}
        style={{ opacity: effectiveOpen ? overlayOpacity : 0 }}
      />
      <aside
        ref={panelRef}
        className="vemi-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigare VEMI"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div className="vemi-drawer-topbar">
          <div className="vemi-drawer-brand" aria-hidden="true">
            <Image className="vemi-drawer-brand-symbol" src="/vemi-symbol-2026.png" alt="" width={56} height={56} priority unoptimized />
            <span>VEMI</span>
          </div>
          <button ref={closeRef} className="vemi-drawer-close" type="button" onClick={closeDrawer} aria-label="Închide meniul">
            <CloseIcon />
          </button>
        </div>
        <div className="vemi-drawer-scroll">
          <nav className="vemi-drawer-nav" aria-label="Navigare principală">
            <div className="vemi-drawer-primary">
              {PRIMARY_LINKS.map((item) => {
                const href = item.label === "Antrenamentul meu" ? workoutHref : item.href;
                return (
                <a
                  className="vemi-drawer-row"
                  key={item.href}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateFromDrawer(href);
                  }}
                >
                  <MenuIcon name={item.icon} />
                  <span>{item.label}</span>
                  <ChevronIcon />
                </a>
                );
              })}
            </div>
            <div className="vemi-drawer-separator">
              <button
                className="vemi-drawer-swipe-indicator"
                type="button"
                onClick={closeDrawer}
                aria-label="Închide meniul"
              >
                <span aria-hidden="true" /><span aria-hidden="true" />
              </button>
            </div>
            <div className="vemi-drawer-cards">
              {CARD_LINKS.map((item) => (
                <a
                  ref={item.href === "/contul-meu" ? accountTriggerRef : undefined}
                  className={`vemi-drawer-card vemi-drawer-card-${item.variant}`}
                  key={item.href}
                  href={item.href}
                  onClick={(event) => {
                    event.preventDefault();
                    if (item.href === "/contul-meu") openAccountPanel();
                    else navigateFromDrawer(item.href);
                  }}
                >
                  {item.variant === "subscription" ? (
                    <span className="vemi-drawer-plus-logo" aria-hidden="true">
                      <Image src="/assets/vemi-plus-card-logo-simple.png" alt="" width={30} height={30} unoptimized />
                    </span>
                  ) : (
                    <span className="vemi-drawer-account-icon" aria-hidden="true">
                      <Image src="/assets/vemi-account-card-icon.png" alt="" width={30} height={30} unoptimized />
                    </span>
                  )}
                  <span>{item.label}</span>
                  {item.variant === "account" ? (
                    <Image
                      className="vemi-drawer-account-chevron"
                      src="/assets/vemi-account-card-chevron.svg"
                      alt=""
                      width={20}
                      height={20}
                      unoptimized
                    />
                  ) : (
                    <ChevronIcon />
                  )}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </aside>
      <aside
        ref={accountPanelRef}
        className="vemi-drawer-panel vemi-account-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Contul meu"
        aria-hidden={!accountOpen}
        onPointerDown={onAccountPointerDown}
        onPointerMove={onAccountPointerMove}
        onPointerUp={finishAccountDrag}
        onPointerCancel={finishAccountDrag}
      >
        <div className="vemi-account-drawer-decoration" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="vemi-drawer-separator vemi-account-drawer-divider">
          <button
            ref={accountChevronRef}
            className="vemi-drawer-swipe-indicator"
            type="button"
            onClick={closeDrawer}
            aria-label="Înapoi la panoul de control"
          >
            <span aria-hidden="true" /><span aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        className="menu-toggle vemi-drawer-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Deschide meniul"
        aria-expanded={effectiveOpen}
        aria-controls="vemi-navigation-drawer"
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {mounted ? createPortal(
        <div id="vemi-navigation-drawer">{drawer}</div>,
        document.body,
      ) : null}
    </>
  );
}
