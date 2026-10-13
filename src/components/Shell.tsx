import { BookOpen, Captions, Download, LockKeyhole, LogOut, Menu, Search, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api";
import { usePolling } from "../hooks";
import { useAccess } from "./AccessGate";
import { CommandPalette } from "./CommandPalette";

const nav = [
  { to: "/download", label: "Crawl video", icon: Download, locked: false },
  { to: "/content-editor", label: "Edit sub", icon: Captions, locked: false },
  { to: "/story", label: "Truyện tranh", icon: BookOpen, locked: false },
  { to: "/workers", label: "Post video", icon: Send, locked: false },
];

function WorkspaceLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <nav>{nav.map(({ to, label, icon: Icon, locked }) => (
    <NavLink
      aria-disabled={locked || undefined}
      aria-label={locked ? `${label} — tạm khóa` : label}
      className={locked ? "is-locked" : undefined}
      key={to}
      title={locked ? "Chức năng đang tạm khóa" : undefined}
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
    </NavLink>
  ))}</nav>;
}

export function Shell() {
  const access = useAccess();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { data: jobs = [] } = usePolling(api.jobs, 3000);
  const { data: health } = usePolling(api.health, 10000);

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
      <div className="api-state"><i className={health?.status === "ok" || health?.status === "healthy" ? "is-online" : ""} /><span>{health ? "API online" : "Đang kết nối"}</span></div>
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
          <span className="nav-drawer__health"><i className={health?.status === "ok" || health?.status === "healthy" ? "is-online" : ""} /><span>{health ? "API online" : "Đang kết nối"}</span></span>
          <small>Backend · {health?.version ?? "local"}</small>
        </footer>
      </div>
    </dialog>
    <aside className="workspace-nav workspace-nav--desktop" aria-label="Điều hướng chính">
      <p>Workspace</p>
      <WorkspaceLinks />
      <small>Backend · {health?.version ?? "local"}</small>
    </aside>
    <main className="workspace"><Outlet context={{ jobs }} /></main>
    <footer className="status-footer"><span>Content Station · không gian làm việc cục bộ</span><span>{jobs.length} job đã lưu</span></footer>
    <CommandPalette jobs={jobs} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
  </div>;
}
