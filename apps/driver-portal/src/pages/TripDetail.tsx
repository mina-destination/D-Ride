import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';
import { ArrowLeft, Clock, MapPin, Play, CheckCircle, Navigation, ShieldCheck, QrCode, Camera, Globe } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import { Html5Qrcode } from 'html5-qrcode';
import { useTranslation } from '../context/LanguageContext';

function playChime(isSuccess: boolean) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (isSuccess) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120.00, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90.00, ctx.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {
    console.warn("Web Audio API sound playback failed", e);
  }
}

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
  const [confirmStatusModal, setConfirmStatusModal] = useState<string | null>(null);

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
              playChime(false);
              return;
            }

            setActionLoading(true);
            setScanStatus({ type: null, message: '' });

            await driverAPI.verifyTicket(parsed.bookingId, parsed.token);
            setScanStatus({ type: 'success', message: t('passengerCheckedInSuccess') });
            playChime(true);

            await fetchTripDetails();
          } catch (err: any) {
            console.error(err);
            setScanStatus({ 
              type: 'error', 
              message: err.message || t('verificationFailed') 
            });
            playChime(false);
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
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckInPassenger = async (bookingId: string) => {
    try {
      setActionLoading(true);
      await driverAPI.checkInPassenger(bookingId);
      playChime(true);
      await fetchTripDetails();
    } catch (error) {
      playChime(false);
      console.error(error);
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
      <div className="floating-header" style={{
        background: 'rgba(14, 14, 27, 0.45)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '100px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: '1rem',
        zIndex: 10,
        margin: '1rem 1rem 0 1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/trips')} 
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <ArrowLeft size={20} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
          </button>
          <img src={logo} alt="Logo" style={{ height: '32px', width: 'auto', borderRadius: '4px', objectFit: 'contain', boxShadow: '0 0 10px rgba(245, 183, 49, 0.3)', flexShrink: 0 }} />
          <h2 className="title-outfit" style={{ fontSize: '15px', margin: 0, color: 'var(--text-primary)' }}>
            {t('tripDetails')}
          </h2>
        </div>
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={18} />
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
                onClick={() => setConfirmStatusModal('BOARDING')}
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
                  onClick={() => setConfirmStatusModal('IN_TRANSIT')}
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
                  onClick={() => setConfirmStatusModal('COMPLETED')}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '300px', height: '280px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)' }}>
                {/* HTML5 QR reader target container */}
                <div id="qr-reader" style={{ width: '100%', height: '100%' }} />

                {/* Laser scan line overlay */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '2px',
                  background: 'var(--primary)',
                  boxShadow: '0 0 10px var(--primary)',
                  zIndex: 10,
                  animation: 'laser-scan 2s linear infinite',
                  pointerEvents: 'none'
                }} />

                {/* Scanning Corner Guides */}
                <div style={{ position: 'absolute', top: '15px', left: '15px', width: '18px', height: '18px', borderLeft: '3px solid var(--primary)', borderTop: '3px solid var(--primary)', zIndex: 10, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '15px', right: '15px', width: '18px', height: '18px', borderRight: '3px solid var(--primary)', borderTop: '3px solid var(--primary)', zIndex: 10, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '15px', left: '15px', width: '18px', height: '18px', borderLeft: '3px solid var(--primary)', borderBottom: '3px solid var(--primary)', zIndex: 10, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '15px', right: '15px', width: '18px', height: '18px', borderRight: '3px solid var(--primary)', borderBottom: '3px solid var(--primary)', zIndex: 10, pointerEvents: 'none' }} />
              </div>
              
              <button 
                className="btn btn-secondary btn-block" 
                onClick={() => setScannerActive(false)}
                style={{ maxWidth: '300px' }}
              >
                {t('closeCamera')}
              </button>

              <style>{`
                @keyframes laser-scan {
                  0% { top: 12%; }
                  50% { top: 88%; }
                  100% { top: 12%; }
                }
              `}</style>
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
                      <h5 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {passengerName}
                        {booking.boardingNumber && (
                          <span style={{
                            background: 'rgba(245, 183, 49, 0.15)',
                            color: 'var(--primary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(245, 183, 49, 0.3)',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}>
                            #{booking.boardingNumber}
                          </span>
                        )}
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

      {confirmStatusModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 6, 14, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '24px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <h4 className="title-outfit" style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>
              {t(`confirm${confirmStatusModal === 'BOARDING' ? 'OpenBoarding' : (confirmStatusModal === 'IN_TRANSIT' ? 'StartDriving' : 'CompleteTrip')}`)}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {confirmStatusModal === 'BOARDING' && "This will notify passengers that boarding has commenced and open the QR scanner ticket check-in gates."}
              {confirmStatusModal === 'IN_TRANSIT' && "This will notify passengers that the shuttle is in transit. Live GPS coordinates will begin streaming."}
              {confirmStatusModal === 'COMPLETED' && "This will permanently close the trip, complete the passenger shifts, and stop telemetry. This cannot be undone."}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                onClick={() => setConfirmStatusModal(null)} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => {
                  const targetStatus = confirmStatusModal;
                  setConfirmStatusModal(null);
                  handleUpdateTripStatus(targetStatus);
                }} 
                className="btn btn-primary" 
                style={{
                  flex: 1,
                  padding: '12px',
                  background: confirmStatusModal === 'COMPLETED' ? 'var(--danger)' : 'var(--primary)',
                  color: confirmStatusModal === 'COMPLETED' ? 'white' : 'var(--text-on-primary)'
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
