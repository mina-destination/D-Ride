import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';
import { Calendar, Clock, MapPin, Users, ChevronRight, LogOut, RefreshCw, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import Header from '../components/Header';

export default function MyTripsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage, isRtl } = useTranslation();

  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await driverAPI.getMyTrips();
      const nonCancelledTrips = (data || []).filter((x: any) => x.status !== 'CANCELLED');
      setTrips(nonCancelledTrips);
    } catch (error) {
      console.error('Failed to load driver trips', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const filteredTrips = trips.filter((t) => {
    const isCompletedOrCancelled = t.status === 'COMPLETED' || t.status === 'CANCELLED';
    return activeTab === 'active' ? !isCompletedOrCancelled : isCompletedOrCancelled;
  });

  return (
    <div className="app-container fade-in-up">
      {/* Top Header */}
      <Header 
        onRefresh={fetchTrips} 
        loadingRefresh={loading} 
      />

      <div className="content-container">
        {/* Tab Controls */}
        <div style={{
          display: 'flex',
          background: 'var(--surface)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border)'
        }}>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'active' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
              border: 'none'
            }}
          >
            {t('currentActive')}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'past' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'past' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
              border: 'none'
            }}
          >
            {t('pastShifts')}
          </button>
        </div>

        {/* Loading / Empty / List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{t('loadingAssignments')}</span>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {t('noTripsFound')}
            </p>
            <button
              onClick={fetchTrips}
              className="btn btn-secondary btn-block"
              style={{ padding: '10px 16px', fontSize: '13px' }}
            >
              {t('refreshAssignments')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredTrips.map((trip) => {
              const routeName = trip.routeId?.name || t('assignedRoute');
              const dateObj = new Date(trip.departureTime);
              const formattedDate = dateObj.toLocaleDateString(language === 'ar' ? 'ar-EG' : undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              });
              const formattedTime = dateObj.toLocaleTimeString(language === 'ar' ? 'ar-EG' : undefined, {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={trip._id}
                  className="glass-card interactive trip-card"
                  onClick={() => navigate(`/trips/${trip._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <span className={`status-tag ${trip.status.toLowerCase().replace('_', '-')}`}>
                        {trip.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <Calendar size={14} />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  <h3 className="title-outfit" style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={18} style={{ color: 'var(--primary)' }} />
                    {routeName}
                  </h3>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '12px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} style={{ color: 'var(--text-muted)' }} />
                      <span>{formattedTime}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={15} style={{ color: 'var(--text-muted)' }} />
                      <span>{t('bookedCount', { booked: trip.bookedSeats, available: trip.availableSeats })}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)', fontWeight: 600, gap: '2px' }}>
                      <span>{t('view')}</span>
                      <ChevronRight size={16} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
