import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { DownloadPage } from "./pages/DownloadPage";
import { AutopostProjectsPage } from "./pages/AutopostProjectsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StoryPage } from "./pages/StoryPage";

export default function App() {
  return <Routes><Route element={<Shell />}><Route index element={<OverviewPage />} /><Route path="download" element={<Navigate to="/download/douyin" replace />} /><Route path="download/:source" element={<DownloadPage />} /><Route path="content-editor" element={<Navigate to="/" replace />} /><Route path="jobs" element={<Navigate to="/" replace />} /><Route path="jobs/:id" element={<JobDetailPage />} /><Route path="story" element={<StoryPage />} /><Route path="workers" element={<AutopostProjectsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>;
}
