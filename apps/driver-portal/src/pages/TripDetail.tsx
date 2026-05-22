import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';
import { ArrowLeft, Clock, MapPin, Play, CheckCircle, Navigation, ShieldCheck, QrCode, Camera, Globe } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useTranslation } from '../context/LanguageContext';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language, setLanguage, isRtl } = useTranslation();

  const [trip, setTrip] = useState<any>(null);
  const [manifest, setManifest] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const fetchTripDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      // Fetch trip
      const tripsList = await driverAPI.getMyTrips();
      const currentTrip = tripsList.find((t: any) => t._id === id);
      setTrip(currentTrip);

      if (currentTrip) {
        // Fetch bookings manifest
        const manifestData = await driverAPI.getTripManifest(id);
        setManifest(manifestData);
      }
    } catch (error) {
      console.error('Failed to load trip detail context', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripDetails();
  }, [id]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (scannerActive) {
      html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText: string) => {
          try {
            if (html5QrCode) {
              await html5QrCode.stop().catch(console.error);
            }
            setScannerActive(false);

            const parsed = JSON.parse(decodedText);
            if (!parsed.bookingId || !parsed.token) {
              setScanStatus({ type: 'error', message: t('invalidQrStructure') });
              return;
            }

            setActionLoading(true);
            setScanStatus({ type: null, message: '' });

            await driverAPI.verifyTicket(parsed.bookingId, parsed.token);
            setScanStatus({ type: 'success', message: t('passengerCheckedInSuccess') });

            await fetchTripDetails();
          } catch (err: any) {
            console.error(err);
            setScanStatus({ 
              type: 'error', 
              message: err.message || t('verificationFailed') 
            });
          } finally {
            setActionLoading(false);
          }
        },
        () => {}
      ).catch((err: any) => {
        console.error("Failed to start QR scanner:", err);
        setScanStatus({ type: 'error', message: t('cameraPermissionDenied') });
        setScannerActive(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [scannerActive]);

  const handleUpdateTripStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await driverAPI.updateTripStatus(id, newStatus);
      await fetchTripDetails();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckInPassenger = async (bookingId: string) => {
    try {
      setActionLoading(true);
      await driverAPI.checkInPassenger(bookingId);
      await fetchTripDetails();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to check in passenger');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 24px' }}>
        <span>{t('loadingTripFiles')}</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="content-container" style={{ textAlign: 'center', paddingTop: '40px' }}>
        <p>{t('tripNotFound')}</p>
        <button onClick={() => navigate('/trips')} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          {t('backToList')}
        </button>
      </div>
    );
  }

  const routeName = trip.routeId?.name || t('assignedRoute');
  const time = new Date(trip.departureTime).toLocaleTimeString(language === 'ar' ? 'ar-EG' : undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="app-container">
      {/* Top bar header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/trips')} 
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <ArrowLeft size={24} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
          </button>
          <h2 className="title-outfit" style={{ fontSize: '18px', margin: 0 }}>
            {t('tripDetails')}
          </h2>
        </div>
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={20} />
        </button>
      </div>

      <div className="content-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Route Card Overview */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span className={`status-tag ${trip.status.toLowerCase().replace('_', '-')}`}>
              {trip.status}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Clock size={15} />
              <span>{time}</span>
            </div>
          </div>

          <h3 className="title-outfit" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <MapPin size={20} style={{ color: 'var(--primary)' }} />
            {routeName}
          </h3>

          {/* Action Buttons for Trip Transition */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            {trip.status === 'SCHEDULED' && (
              <button
                className="btn btn-primary btn-block"
                onClick={() => handleUpdateTripStatus('BOARDING')}
                disabled={actionLoading}
              >
                <Play size={18} />
                {t('openBoardingGate')}
              </button>
            )}

            {trip.status === 'BOARDING' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handleUpdateTripStatus('IN_TRANSIT')}
                  disabled={actionLoading}
                >
                  <Navigation size={18} />
                  {t('startDriving')}
                </button>
              </div>
            )}

            {trip.status === 'IN_TRANSIT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="btn btn-primary btn-block"
                  style={{ background: 'var(--success)', color: 'var(--text-on-primary)' }}
                  onClick={() => handleUpdateTripStatus('COMPLETED')}
                  disabled={actionLoading}
                >
                  <CheckCircle size={18} />
                  {t('completeTripShift')}
                </button>
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => navigate(`/drive/${trip._id}`)}
                >
                  <Navigation size={18} style={{ color: 'var(--primary)' }} />
                  {t('openLiveMapNav')}
                </button>
              </div>
            )}

            {trip.status === 'COMPLETED' && (
              <div style={{
                textAlign: 'center',
                padding: '12px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                background: 'rgba(16, 185, 129, 0.05)',
                color: 'var(--success)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)'
              }}>
                {t('shiftCompletedSuccess')}
              </div>
            )}
          </div>
        </div>

        {/* Camera QR Scanner Panel */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--surface-elevated)' }}>
          <h4 className="title-outfit" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <QrCode size={18} style={{ color: 'var(--primary)' }} />
            {t('qrScannerEngine')}
          </h4>
          
          {scanStatus.type && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: 600,
              background: scanStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: scanStatus.type === 'success' ? 'var(--success)' : '#ef4444',
              border: `1px solid ${scanStatus.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
            }}>
              {scanStatus.message}
            </div>
          )}

          {scannerActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div id="qr-reader" style={{ width: '100%', maxWidth: '300px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }} />
              <button 
                className="btn btn-secondary btn-block" 
                onClick={() => setScannerActive(false)}
                style={{ maxWidth: '300px' }}
              >
                {t('closeCamera')}
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary btn-block"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => {
                setScanStatus({ type: null, message: '' });
                setScannerActive(true);
              }}
              disabled={actionLoading || (trip.status !== 'BOARDING' && trip.status !== 'SCHEDULED')}
            >
              <Camera size={18} />
              {trip.status !== 'BOARDING' && trip.status !== 'SCHEDULED' 
                ? t('boardingGateClosed') 
                : t('scanTicketQr')}
            </button>
          )}
        </div>

        {/* Passenger Manifest Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className="title-outfit" style={{ fontSize: '16px', margin: 0, color: 'var(--text-secondary)' }}>
            {t('passengerList', { count: manifest.length })}
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('totalCheckInRequired')}
          </span>
        </div>

        {/* Passenger Manifest Listing */}
        {manifest.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '30px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('noPassengersBooked')}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {manifest.map((booking) => {
              const passenger = booking.userId || {};
              const passengerName = passenger.name || 'Anonymous Passenger';
              const passengerPhone = passenger.phone || 'No phone';
              const seatNumbers = booking.seatNumbers?.join(', ') || 'N/A';

              return (
                <div key={booking._id} className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {passengerName}
                      </h5>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                        {t('phoneLabel')} <code>{passengerPhone}</code>
                      </p>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                        {t('seatsAssigned')} #{seatNumbers}
                      </p>
                    </div>

                    <div>
                      {booking.status === 'BOARDED' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 700, fontSize: '13px' }}>
                          <ShieldCheck size={18} />
                          <span>{t('onBoard')}</span>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderColor: 'var(--primary)'
                          }}
                          onClick={() => handleCheckInPassenger(booking._id)}
                          disabled={actionLoading}
                        >
                          {t('checkInBtn')}
                        </button>
                      )}
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
