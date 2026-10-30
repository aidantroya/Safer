import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toasts';
import { LandingPage } from './pages/LandingPage';
import { CoordinatorLoginPage } from './pages/coordinator/CoordinatorLoginPage';
import { PlannerPage } from './pages/coordinator/PlannerPage';
import { DriverLoginPage } from './pages/driver/DriverLoginPage';
import { DriverPanelPage } from './pages/driver/DriverPanelPage';
import { DriverProfilePage } from './pages/driver/DriverProfilePage';
import { AlarmsPage } from './pages/passenger/AlarmsPage';
import { HomePage } from './pages/passenger/HomePage';
import { PassengerLayout } from './pages/passenger/PassengerLayout';
import { ProfilePage } from './pages/passenger/ProfilePage';
import { ReportIncidentPage } from './pages/passenger/ReportIncidentPage';
import { RoutesPage } from './pages/passenger/RoutesPage';
import { ScanBusPage } from './pages/passenger/ScanBusPage';

export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/pasajero" element={<PassengerLayout />}>
          <Route index element={<HomePage />} />
          <Route path="rutas" element={<RoutesPage />} />
          <Route path="escanear" element={<ScanBusPage />} />
          <Route path="pase" element={<Navigate to="/pasajero/escanear" replace />} />
          <Route path="alertas" element={<AlarmsPage />} />
          <Route path="alertas/reportar" element={<ReportIncidentPage />} />
          <Route path="perfil" element={<ProfilePage />} />
        </Route>

        <Route path="/conductor" element={<DriverLoginPage />} />
        <Route path="/conductor/panel" element={<DriverPanelPage />} />
        <Route path="/conductor/incidencia" element={<DriverPanelPage reporting />} />
        <Route path="/conductor/perfil" element={<DriverProfilePage />} />

        <Route path="/coordinador" element={<CoordinatorLoginPage />} />
        <Route path="/coordinador/planificador" element={<PlannerPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
