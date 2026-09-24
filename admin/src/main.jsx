import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import './styles.css';
import { AuthProvider, RequireAuth } from './lib/auth.jsx';
import { ToastProvider, ConfirmProvider } from './components/feedback.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Projects from './pages/Projects.jsx';
import ProjectEditor from './pages/ProjectEditor.jsx';
import MediaLibrary from './pages/MediaLibrary.jsx';
import Resume from './pages/Resume.jsx';
import Messages from './pages/Messages.jsx';
import Sections from './pages/Sections.jsx';
import SiteSettings from './pages/SiteSettings.jsx';
import Account from './pages/Account.jsx';
import CollectionPage from './pages/CollectionPage.jsx';
import { COLLECTIONS } from './pages/collections.jsx';

function Root() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function NotFound() {
  return <div className="empty"><h3>Page not found</h3><p>The page you are looking for does not exist.</p><a className="btn btn--secondary" href="/admin/">Back to dashboard</a></div>;
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/login', element: <Login /> },
      {
        element: <RequireAuth><Layout /></RequireAuth>,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/profile', element: <Profile /> },
          { path: '/projects', element: <Projects /> },
          { path: '/projects/new', element: <ProjectEditor /> },
          { path: '/projects/:id', element: <ProjectEditor /> },
          ...Object.entries(COLLECTIONS).map(([path, config]) => ({ path: `/${path}`, element: <CollectionPage key={path} config={config} /> })),
          { path: '/media', element: <MediaLibrary /> },
          { path: '/resume', element: <Resume /> },
          { path: '/messages', element: <Messages /> },
          { path: '/sections', element: <Sections /> },
          { path: '/site-settings', element: <SiteSettings /> },
          { path: '/account', element: <Account /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
], { basename: '/admin' });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
