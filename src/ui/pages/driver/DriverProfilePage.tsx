import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { NEGATIVE_TAGS, POSITIVE_TAGS } from '@/service/ReviewService';
import type { DriverProfile } from '@/service/RouteCatalogService';
import type { ReviewInsight } from '@/domain/model';
import { BottomNav, driverNavItems } from '../../components/BottomNav';
import { Icon } from '../../components/Icon';
import { InsightCard } from '../../components/InsightCard';
import { Stars } from '../../components/Stars';
import { initials } from '../../lib/format';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';

const TAGS = new Map([...POSITIVE_TAGS, ...NEGATIVE_TAGS].map((t) => [t.id, t]));
const NEGATIVE = new Set(NEGATIVE_TAGS.map((t) => t.id));

/** Pantalla "Perfil del conductor": datos del turno y las reseñas que dejaron los estudiantes sobre su bus. */
export function DriverProfilePage() {
  const { user, ready, logout } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DriverProfile>();
  const [insight, setInsight] = useState<ReviewInsight>();

  useEffect(() => {
    if (!user || user.role !== 'driver') return;
    void app.driver.getProfile(user.id).then((r) => r.ok && setProfile(r.data));
    void app.driver.getInsight(user.id).then((r) => r.ok && setInsight(r.data));
  }, [user]);

  if (ready && (!user || user.role !== 'driver')) return <Navigate to="/conductor" replace />;
  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-surface-bg transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md border-b border-outline-variant/30 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between px-margin h-14">
          <div className="flex items-center gap-2">
            <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
            <h1 className="text-headline-sm text-primary font-bold tracking-tight">Mi Perfil</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-label-sm font-semibold border border-outline-variant/30">
              Conductor
            </span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto px-margin pt-4 flex flex-col gap-space-md">
        <div className="bg-surface-card rounded-3xl p-5 shadow-level-1 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold shadow-md shrink-0">
            {initials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-title-md font-bold text-on-surface truncate">{user.fullName}</p>
            <p className="text-body-sm text-on-surface-variant truncate">{user.email}</p>
            {profile?.today && (
              <p className="mt-1 text-label-sm text-secondary font-semibold truncate">
                Hoy: Ruta {profile.today.route.code} • Bus #{profile.today.bus.number} ({profile.today.bus.plate})
              </p>
            )}
          </div>
        </div>

        {!profile ? (
          <p className="text-on-surface-variant text-body-md py-6 text-center">Cargando reseñas…</p>
        ) : (
          <>
            {insight && <InsightCard insight={insight} title="Lo que dicen de ti" />}

            <section aria-labelledby="calificacion" className="bg-surface-card rounded-2xl p-space-md shadow-level-1 border border-outline-variant/30">
              <h2 id="calificacion" className="text-headline-sm text-primary font-bold">Calificación de tu bus</h2>
              <p className="text-body-sm text-on-surface-variant">Promedio de las reseñas que dejaron los estudiantes al bajar.</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="text-center shrink-0 w-24">
                  <div className="text-headline-lg font-extrabold text-on-surface tabular leading-none">
                    {profile.rating.average !== null ? profile.rating.average.toFixed(1) : '—'}
                  </div>
                  <div className="mt-1"><Stars value={profile.rating.average ?? 0} size={15} /></div>
                  <div className="text-label-sm text-on-surface-variant mt-0.5">{profile.rating.count} reseñas</div>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = profile.distribution[n - 1];
                    const pct = profile.rating.count ? (c / profile.rating.count) * 100 : 0;
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-label-sm text-on-surface-variant w-3 tabular">{n}</span>
                        <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-label-sm text-on-surface-variant w-4 text-right tabular">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {profile.topTags.length > 0 && (
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex flex-wrap gap-1.5">
                  {profile.topTags.map(({ id, count }) => <TagChip key={id} id={id} count={count} />)}
                </div>
              )}
            </section>

            <section aria-labelledby="resenas" className="flex flex-col gap-3">
              <h2 id="resenas" className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Reseñas recientes</h2>
              {profile.reviews.length === 0 && (
                <p className="text-body-sm text-on-surface-variant bg-surface-card rounded-2xl p-4 border border-outline-variant/30">
                  Todavía no tienes reseñas.
                </p>
              )}
              {profile.reviews.map(({ review, routeName, busNumber }) => (
                <article key={review.id} className="bg-surface-card rounded-2xl p-4 shadow-level-1 border border-outline-variant/30">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={review.rating} size={16} />
                    <span className="text-label-sm text-on-surface-variant">
                      {new Date(review.createdAt).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant mt-1">{routeName} • Bus #{busNumber}</p>
                  <p className={`text-body-md mt-2 ${review.comment ? 'text-on-surface' : 'text-on-surface-variant italic'}`}>
                    {review.comment || 'Sin comentario.'}
                  </p>
                  {review.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.tags.map((t) => <TagChip key={t} id={t} />)}
                    </div>
                  )}
                </article>
              ))}
            </section>
          </>
        )}

        <button
          type="button"
          onClick={() => { logout(); navigate('/'); }}
          className="mt-2 w-full min-h-[48px] rounded-2xl border border-alert-coral/40 bg-surface-card text-alert-coral font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-alert-coral/10 active:scale-[0.985] transition-all shadow-xs"
        >
          <Icon name="logout" className="text-[20px]" /> Cerrar sesión
        </button>
      </main>

      <BottomNav items={driverNavItems} />
    </div>
  );
}

function TagChip({ id, count }: { id: string; count?: number }) {
  const tag = TAGS.get(id);
  const negative = NEGATIVE.has(id);
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-label-sm font-semibold border ${
        negative
          ? 'bg-alert-coral/10 text-alert-coral border-alert-coral/30'
          : 'bg-secondary-container text-on-secondary-container border-secondary/30'
      }`}
    >
      {tag ? `${tag.emoji} ${tag.label}` : id}
      {count !== undefined && <span className="ml-1 opacity-80">×{count}</span>}
    </span>
  );
}
