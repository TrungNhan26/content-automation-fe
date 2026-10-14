import { BookOpen, Captions, Download, LockKeyhole, LogOut, Menu, Search, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Job } from "../types";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api";
import { usePolling } from "../hooks";
import { useAccess } from "./AccessGate";
import { CommandPalette } from "./CommandPalette";

// needsBackend: only usable while the PC runs the local backend; Post video lives on Cloudflare.
const nav = [
  { to: "/download", label: "Crawl video", icon: Download, needsBackend: true },
  { to: "/content-editor", label: "Edit sub", icon: Captions, needsBackend: true },
  { to: "/story", label: "Truyện tranh", icon: BookOpen, needsBackend: true },
  { to: "/workers", label: "Post video", icon: Send, needsBackend: false },
];

function WorkspaceLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { backendOnline } = useAccess();
  return <nav>{nav.map(({ to, label, icon: Icon, needsBackend }) => {
    const locked = needsBackend && backendOnline === false;
    return <NavLink
      aria-disabled={locked || undefined}
      aria-label={locked ? `${label} — cần bật server` : label}
      className={locked ? "is-locked" : undefined}
      key={to}
      title={locked ? "Cần bật server" : undefined}
      to={to}
      onClick={(event) => {
        if (locked) {
          event.preventDefault();
          return;
        }
        onNavigate?.();
      }}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {locked && <LockKeyhole className="nav-lock" aria-hidden="true" />}
    </NavLink>;
  })}</nav>;
}

export function Shell() {
  const access = useAccess();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  // Jobs live on the local backend: don't ask for them while it is off.
  const loadJobs = useCallback(
    (): Promise<Job[]> => (access.backendOnline ? api.jobs() : Promise.resolve([])),
    [access.backendOnline],
  );
  const { data: jobs = [] } = usePolling(loadJobs, 3000);
  const online = access.backendOnline === true;
  const backendLabel = access.backendOnline === null ? "Đang kiểm tra server" : online ? "Server: bật" : "Server: tắt";

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 60rem)");
    const closeOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!event.matches || !drawerRef.current?.open) return;
      drawerRef.current.close();
      setDrawerOpen(false);
      window.requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>(".workspace-nav--desktop a.active")?.focus({ preventScroll: true }));
    };
    closeOnDesktop(desktop);
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (drawerRef.current?.open) drawerRef.current.close();
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previousOverflow; };
  }, [drawerOpen]);

  function openDrawer() {
    const drawer = drawerRef.current;
    if (!drawer || drawer.open) return;
    drawer.showModal();
    setDrawerOpen(true);
    window.requestAnimationFrame(() => {
      if (!drawer.open) return;
      (drawer.querySelector<HTMLAnchorElement>("nav a.active") ?? drawer.querySelector<HTMLAnchorElement>("nav a"))?.focus({ preventScroll: true });
    });
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (drawerRef.current?.open) drawerRef.current.close();
    setDrawerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus({ preventScroll: true }));
  }

  function closeFromBackdrop(event: ReactMouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDrawer();
  }

  return <div className="app-shell">
    <header className="topbar">
      <button ref={menuButtonRef} type="button" className="mobile-menu" aria-label="Mở điều hướng" aria-controls="mobile-navigation" aria-expanded={drawerOpen} aria-haspopup="dialog" onClick={openDrawer}><Menu aria-hidden="true" /></button>
      <NavLink to="/" className="wordmark"><strong>Content Station</strong></NavLink>
      <button className="search-trigger" onClick={() => setPaletteOpen(true)}><Search aria-hidden="true" /><span>Tìm video hoặc job</span><kbd>Ctrl K</kbd></button>
      <div className="api-state" title="Crawl, Edit sub và Truyện tranh cần server đang bật. Post video luôn dùng được."><i className={online ? "is-online" : ""} /><span>{backendLabel}</span></div>
      {access.required && <button type="button" className="icon-button" aria-label="Khóa và đăng xuất" title="Khóa" onClick={() => void access.logout()}><LogOut aria-hidden="true" /></button>}
    </header>
    <dialog ref={drawerRef} id="mobile-navigation" className="nav-drawer" aria-labelledby="nav-drawer-title" onClick={closeFromBackdrop} onClose={() => setDrawerOpen(false)} onCancel={() => setDrawerOpen(false)}>
      <div className="nav-drawer__panel">
        <header className="nav-drawer__head">
          <NavLink className="nav-drawer__brand" to="/" onClick={() => closeDrawer({ restoreFocus: false })}><strong id="nav-drawer-title">Content Station</strong><small>Tổng quan hoạt động</small></NavLink>
          <button type="button" className="icon-button" aria-label="Đóng điều hướng" onClick={() => closeDrawer()}><X aria-hidden="true" /></button>
        </header>
        <div className="nav-drawer__body">
          <p>Chức năng</p>
          <WorkspaceLinks onNavigate={() => closeDrawer({ restoreFocus: false })} />
        </div>
        <footer className="nav-drawer__footer">
          <span className="nav-drawer__health"><i className={online ? "is-online" : ""} /><span>{backendLabel}</span></span>
          <small>Post video chạy trên Cloudflare</small>
        </footer>
      </div>
    </dialog>
    <aside className="workspace-nav workspace-nav--desktop" aria-label="Điều hướng chính">
      <p>Workspace</p>
      <WorkspaceLinks />
      <small>{backendLabel}</small>
    </aside>
    <main className="workspace"><Outlet context={{ jobs }} /></main>
    <footer className="status-footer"><span>Content Station · không gian làm việc cục bộ</span><span>{jobs.length} job đã lưu</span></footer>
    <CommandPalette jobs={jobs} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
  </div>;
}
