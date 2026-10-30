import { useCallback, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { app } from '@/api';
import type { PassengerEvent, PassengerSnapshot } from '@/service/PassengerService';
import { BottomNav } from '../../components/BottomNav';
import { DevPanel } from '../../components/DevPanel';
import { ReviewSheet } from '../../components/ReviewSheet';
import { useToasts } from '../../components/Toasts';
import { WakeUpAlarm } from '../../components/WakeUpAlarm';
import { haptic } from '../../lib/haptics';
import { usePolling } from '../../lib/usePolling';
import { useSession } from '../../session/SessionContext';
import { PassengerCtx } from './PassengerContext';

/** Marco de todas las pantallas del pasajero: consulta el estado cada ½ s y reacciona a eventos. */
export function PassengerLayout() {
  const { user, ready } = useSession();
  const { toast } = useToasts();
  const location = useLocation();
  const [snap, setSnap] = useState<PassengerSnapshot>();
  const [wake, setWake] = useState<Extract<PassengerEvent, { type: 'wake_up' }>>();
  const [reviewClosed, setReviewClosed] = useState<string>();

  const handle = useCallback((e: PassengerEvent) => {
    if (e.type === 'bus_approaching') {
      haptic.medium();
      toast('Tu bus está llegando', `El Bus #${e.busNumber} llega a ${e.stopName} en ~${e.minutes} min.`, 'info');
    } else if (e.type === 'wake_up') {
      setWake(e);
    } else {
      haptic.success();
      toast('Llegaste a tu destino', `${e.stopName}. ¡Buen día!`, 'ok');
    }
  }, [toast]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const res = await app.passenger.getSnapshot(user.id);
    if (!res.ok) return;
    setSnap(res.data);
    res.data.events.forEach(handle);
  }, [user, handle]);

  usePolling(refresh, 500, !!user);

  if (ready && (!user || user.role !== 'passenger')) return <Navigate to="/" replace />;
  if (!user) return null;

  const hideNav = location.pathname.endsWith('/pase');
  const review = snap?.pendingReview && snap.pendingReview.tripId !== reviewClosed ? snap.pendingReview : undefined;

  return (
    <PassengerCtx.Provider value={{ snap, refresh }}>
      <div className="relative mx-auto max-w-md min-h-screen bg-surface-bg">
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
      {snap && <DevPanel routeId={snap.route.id} boardIndex={snap.route.stops.findIndex((s) => s.id === snap.boardStop.id)} dropIndex={snap.route.stops.findIndex((s) => s.id === snap.dropStop.id)} onChanged={refresh} />}
      {wake && <WakeUpAlarm stopName={wake.stopName} minutes={wake.minutes} onStop={() => setWake(undefined)} />}
      {review && !wake && <ReviewSheet review={review} userId={user.id} onDone={() => { setReviewClosed(review.tripId); void refresh(); }} />}
    </PassengerCtx.Provider>
  );
}
