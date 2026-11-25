import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PortalLanding } from './components/PortalLanding';
import { PortalUser } from './components/PortalUser';
import { PortalMitra } from './components/PortalMitra';
import { PortalAdmin } from './components/PortalAdmin';
import { ToastContainer } from './components/ToastContainer';

function PrintKampusRouter() {
  const { portalRoute } = useApp();

  return (
    <>
      {portalRoute === 'home' && <PortalLanding />}
      {portalRoute === 'user' && <PortalUser />}
      {portalRoute === 'mitra' && <PortalMitra />}
      {portalRoute === 'admin' && <PortalAdmin />}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <PrintKampusRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}
