import { LockKeyhole } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AUTH_REQUIRED_EVENT, api } from "../api";

type Phase = "checking" | "locked" | "open" | "offline";

interface Access {
  required: boolean;
  logout: () => Promise<void>;
  /** null while the first probe is running; false when the crawling PC is off. */
  backendOnline: boolean | null;
  recheckBackend: () => Promise<void>;
}

const AccessContext = createContext<Access>({
  required: false,
  logout: async () => {},
  backendOnline: null,
  recheckBackend: async () => {},
});

export const useAccess = () => useContext(AccessContext);

const BACKEND_PROBE_MS = 20_000;

/**
 * Shows the access-code screen until the Autopost Worker (always on, on Cloudflare) accepts
 * the code. Nothing else mounts while locked. Also watches whether the local backend is
 * reachable, so Crawl / Edit sub / Truyện tranh can be unlocked only while the PC runs it.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [required, setRequired] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const check = useCallback(async () => {
    setPhase("checking");
    try {
      const status = await api.authStatus();
      setRequired(status.required);
      setPhase(!status.required || status.authenticated ? "open" : "locked");
    } catch {
      setPhase("offline");
    }
  }, []);

  const recheckBackend = useCallback(async () => {
    setBackendOnline(await api.backendOnline());
  }, []);

  useEffect(() => { void check(); }, [check]);

  useEffect(() => {
    if (phase !== "open") return;
    void recheckBackend();
    const probe = () => { if (!document.hidden) void recheckBackend(); };
    const timer = window.setInterval(probe, BACKEND_PROBE_MS);
    document.addEventListener("visibilitychange", probe);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", probe);
    };
  }, [phase, recheckBackend]);

  useEffect(() => {
    const lock = () => { setCode(""); setPhase("locked"); };
    window.addEventListener(AUTH_REQUIRED_EVENT, lock);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, lock);
  }, []);

  useEffect(() => { if (phase === "locked") input.current?.focus(); }, [phase]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setCode("");
    setError("");
    setPhase("locked");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.login(code);
      setCode("");
      setPhase("open");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đăng nhập được.");
      setCode("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  if (phase === "open") {
    return <AccessContext.Provider value={{ required, logout, backendOnline, recheckBackend }}>{children}</AccessContext.Provider>;
  }

  return <main className="access-gate">
    <section className="access-card" aria-labelledby="access-title">
      <span className="access-card__icon"><LockKeyhole aria-hidden="true" /></span>
      <h1 id="access-title">Content Station</h1>
      {phase === "checking" && <p role="status">Đang kiểm tra…</p>}
      {phase === "offline" && <>
        <p role="alert" className="field-error">Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.</p>
        <button type="button" className="button button--submit" onClick={() => void check()}>Thử lại</button>
      </>}
      {phase === "locked" && <form onSubmit={submit} className="field">
        <label htmlFor="access-code">Mã truy cập</label>
        <input
          ref={input}
          id="access-code"
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "access-error" : undefined}
          disabled={busy}
        />
        <small id="access-error" role="alert" className="field-error">{error}</small>
        <button type="submit" className="button button--primary button--submit" data-state={busy ? "loading" : undefined} disabled={busy || !code.trim()}>Vào</button>
      </form>}
    </section>
  </main>;
}
