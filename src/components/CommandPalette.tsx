import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Job } from "../types";
import { activityActionLabel, jobAction, statusLabel } from "../utils";

export function CommandPalette({ jobs, open, onClose }: { jobs: Job[]; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => jobs.filter((job) => `${job.title ?? ""} ${job.url} ${job.id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 7), [jobs, query]);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return <dialog ref={dialog} className="command" onClose={onClose} onCancel={onClose} onClick={(event) => event.target === dialog.current && onClose()}>
    <div className="command__search"><Search aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên video, URL hoặc mã job" aria-label="Tìm job" /><kbd>Esc</kbd></div>
    <div className="command__results">
      {matches.length ? matches.map((job) => <button key={job.id} onClick={() => { navigate(`/jobs/${job.id}`); onClose(); }}><span>{job.title || job.url}</span><small>{activityActionLabel[jobAction(job)]} · {statusLabel[job.status]}</small></button>) : <p>Không tìm thấy job phù hợp.</p>}
    </div>
  </dialog>;
}
