import { Navigate, Route, Routes } from "react-router-dom";
import { RequireBackend } from "./components/RequireBackend";
import { Shell } from "./components/Shell";
import { AutopostProjectsPage } from "./pages/AutopostProjectsPage";
import { ContentEditorPage } from "./pages/ContentEditorPage";
import { DownloadPage } from "./pages/DownloadPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StoryPage } from "./pages/StoryPage";

export default function App() {
  return <Routes>
    <Route element={<Shell />}>
      <Route index element={<OverviewPage />} />
      <Route path="download" element={<Navigate to="/download/douyin" replace />} />
      <Route path="download/:source" element={<RequireBackend><DownloadPage /></RequireBackend>} />
      <Route path="content-editor" element={<RequireBackend><ContentEditorPage /></RequireBackend>} />
      <Route path="jobs" element={<Navigate to="/" replace />} />
      <Route path="jobs/:id" element={<RequireBackend><JobDetailPage /></RequireBackend>} />
      <Route path="story" element={<RequireBackend><StoryPage /></RequireBackend>} />
      <Route path="workers" element={<AutopostProjectsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>;
}
