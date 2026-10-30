import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toasts';
import { LandingPage } from './pages/LandingPage';
import { DriverLoginPage } from './pages/driver/DriverLoginPage';
import { DriverPanelPage } from './pages/driver/DriverPanelPage';
import { AlarmsPage } from './pages/passenger/AlarmsPage';
import { BoardingPassPage } from './pages/passenger/BoardingPassPage';
import { HomePage } from './pages/passenger/HomePage';
import { PassengerLayout } from './pages/passenger/PassengerLayout';
import { ProfilePage } from './pages/passenger/ProfilePage';
import { ReportIncidentPage } from './pages/passenger/ReportIncidentPage';

export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/pasajero" element={<PassengerLayout />}>
          <Route index element={<HomePage />} />
          <Route path="pase" element={<BoardingPassPage />} />
          <Route path="alertas" element={<AlarmsPage />} />
          <Route path="alertas/reportar" element={<ReportIncidentPage />} />
          <Route path="perfil" element={<ProfilePage />} />
        </Route>

        <Route path="/conductor" element={<DriverLoginPage />} />
        <Route path="/conductor/panel" element={<DriverPanelPage />} />
        <Route path="/conductor/incidencia" element={<DriverPanelPage reporting />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
