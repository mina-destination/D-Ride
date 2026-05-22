import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI } from '../services/api';
import { MessageCircle, MapPin, Ticket, QrCode, CreditCard, Compass, User, RefreshCw, Info, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from '../context/LanguageContext';

export default function MyTripsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // WhatsApp Push Simulation Toast States
  const [showWhatsAppToast, setShowWhatsAppToast] = useState(false);
  const [recentBooking, setRecentBooking] = useState<any>(null);

  // Flipped state tracker for 3D flip card effect
  const [flippedBookings, setFlippedBookings] = useState<Record<string, boolean>>({});
  
  // QR Modal States
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  const toggleFlip = (id: string) => {
    setFlippedBookings(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleShowQrModal = (booking: any) => {
    const tokenPayload = JSON.stringify({
      bookingId: booking._id,
      token: booking.qrVerificationToken || ''
    });

    QRCode.toDataURL(tokenPayload, { 
      width: 256, 
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })
      .then(url => {
        setQrValue(url);
        setActiveBookingId(booking._id);
        setShowQrModal(true);
      })
      .catch(err => {
        console.error('Failed to generate QR code:', err);
      });
  };

  const fetchBookings = () => {
    setLoading(true);
    bookingsAPI.getMyBookings()
      .then(data => {
        setBookings(data);
        // Find first confirmed booking to trigger simulation
        const confirmed = data.find((b: any) => b.status === 'CONFIRMED');
        if (confirmed) {
          setRecentBooking(confirmed);
          // Show simulated push notification after 2 seconds
          const timer = setTimeout(() => {
            setShowWhatsAppToast(true);
          }, 2000);
          return () => clearTimeout(timer);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this trip booking?')) {
      try {
        await bookingsAPI.cancel(id);
        fetchBookings();
      } catch (e) {
        alert('Failed to cancel');
      }
    }
  };

  return (
    <>
      {/* Dynamic Keyframes Injection */}
      <style>{`
        @keyframes slide-down {
          0% { transform: translate(-50%, -100px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>

      {/* ── WhatsApp Push Notification Simulation Toast ────── */}
      {showWhatsAppToast && recentBooking && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#075E54', // Official WhatsApp green
          color: 'white',
          padding: '16px 20px',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          maxWidth: '440px',
          width: '90%',
          animation: 'slide-down 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
          }}>
            <MessageCircle size={24} color="#075E54" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.7px', color: '#f5b731' }}>
                WhatsApp Dispatch • D-Ride Hub
              </span>
              <button 
                onClick={() => setShowWhatsAppToast(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '14px', opacity: 0.8 }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.4', color: '#eef2f3' }}>
              Hi <strong>{user?.name || 'Rider'}</strong>! Your ticket is confirmed. Assigned <strong>Seat #{recentBooking.seatNumbers?.join(', ') || recentBooking.seatNumber || 1}</strong> on route <strong>{recentBooking.tripId?.routeId?.name}</strong>. Pickup from <strong>{recentBooking.pickupCheckpoint?.name || 'Route Start'}</strong>.
            </p>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <Link 
                to={`/track?vehicleId=${recentBooking.tripId?.vehicleId || 'mock-vehicle-123'}`}
                onClick={() => setShowWhatsAppToast(false)}
                style={{ fontSize: '12px', fontWeight: 'bold', color: '#f5b731', textDecoration: 'none' }}
              >
                Track Live Ride <MapPin size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="section" style={{ paddingTop: '6rem' }}>
        <div className="section-header">
          <div className="section-badge">{t('yourCommuteBadge')}</div>
          <h2 className="section-title">{t('myBookingsTitle')}</h2>
          <p className="section-subtitle">
            {t('myBookingsSub')}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading tickets...</div>
        ) : bookings.length === 0 ? (
          <div className="features-grid">
            <div className="feature-card glass" style={{ flexDirection: 'column', textAlign: 'center', padding: '2.5rem' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><Ticket size={48} color="var(--text-muted)" /></div>
              <h3 className="feature-title">{t('noTickets')}</h3>
              <p className="feature-desc">
                {t('startBooking')}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            {bookings.map((booking: any) => {
              const dateObj = booking.tripId?.departureTime ? new Date(booking.tripId.departureTime) : null;
              const formattedDate = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A';
              const formattedTime = dateObj ? dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A';
              const isFlipped = !!flippedBookings[booking._id];

              return (
                <div key={booking._id} className="ticket-container">
                  <div className={`ticket-inner ${isFlipped ? 'flipped' : ''}`}>
                    
                    {/* ── TICKET FRONT FACE ────────────────────────── */}
                    <div className="ticket-front boarding-pass">
                      <div className="pass-main">
                        <div className="pass-header">
                          <span className="pass-route-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Compass size={18} style={{ color: 'var(--primary)' }} />
                            {booking.tripId?.routeId?.name || 'Standard Route'}
                          </span>
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: booking.status === 'CANCELLED' ? '#ff6b6b' : 'var(--success)', 
                            fontWeight: 'bold',
                            background: 'var(--surface-hover)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)'
                          }}>
                            {booking.status}
                          </span>
                        </div>

                        <div className="pass-body" style={{ flexWrap: 'wrap', gap: '1.5rem 1rem', justifyContent: 'flex-start' }}>
                          <div className="pass-info-block" style={{ minWidth: '80px' }}>
                            <span className="pass-label">{t('dateLabel')}</span>
                            <span className="pass-value">{formattedDate}</span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '80px' }}>
                            <span className="pass-label">{t('departureLabelShort')}</span>
                            <span className="pass-value">{formattedTime}</span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '60px' }}>
                            <span className="pass-label">{t('seatLabelShort')}</span>
                            <span className="pass-value" style={{ color: 'var(--primary)' }}>#{booking.seatNumbers?.join(', ') || booking.seatNumber || 'N/A'}</span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '80px' }}>
                            <span className="pass-label">{t('fareLabelShort')}</span>
                            <span className="pass-value">{booking.amountEGP} EGP</span>
                          </div>
                          {booking.pickupCheckpoint && (
                            <div className="pass-info-block" style={{ minWidth: '150px' }}>
                              <span className="pass-label">{t('boardingCPShort')}</span>
                              <span className="pass-value" style={{ color: 'var(--primary)' }}>📍 {booking.pickupCheckpoint.name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pass-divider">
                        <div className="pass-cutout-top"></div>
                        <div className="pass-cutout-bottom"></div>
                      </div>

                      <div className="pass-sidebar">
                        <div 
                          className="pass-qr-mock" 
                          title="Scan Ticket QR at Boarding" 
                          style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                          onClick={() => handleShowQrModal(booking)}
                        >
                          <QrCode size={48} color="var(--text-primary)" strokeWidth={1.2} />
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                          {t('passId')}: #{booking._id.slice(-6).toUpperCase()}
                        </div>
                        
                        <button 
                          onClick={() => toggleFlip(booking._id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s ease',
                            width: '100%',
                            justifyContent: 'center'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.color = 'var(--primary)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <RefreshCw size={12} /> {t('optionsBtn')}
                        </button>
                      </div>
                    </div>

                    {/* ── TICKET BACK FACE (Dossier & Actions) ─────── */}
                    <div className="ticket-back boarding-pass">
                      <div className="pass-main" style={{ background: 'var(--surface-elevated)' }}>
                        <div className="pass-header" style={{ borderColor: 'rgba(245,183,49,0.15)' }}>
                          <span className="pass-route-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                            <Info size={16} /> {t('telemetryTitle')}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {t('secureSystem')}
                          </span>
                        </div>

                        <div className="pass-body" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div className="pass-info-block" style={{ minWidth: '110px' }}>
                            <span className="pass-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <User size={12} /> {t('driverLabel')}
                            </span>
                            <span className="pass-value" style={{ fontSize: '0.9rem' }}>Captain Ahmed</span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '120px' }}>
                            <span className="pass-label">{t('vehicleLabel')}</span>
                            <span className="pass-value" style={{ fontSize: '0.9rem' }}>Toyota HiAce (DR-20)</span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '90px' }}>
                            <span className="pass-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ShieldCheck size={12} style={{ color: 'var(--success)' }} /> {t('statusLabel')}
                            </span>
                            <span className="pass-value" style={{ fontSize: '0.9rem', color: 'var(--success)' }}>Verified</span>
                          </div>
                        </div>
                      </div>

                      <div className="pass-divider" style={{ background: 'var(--surface-elevated)' }}>
                        <div className="pass-cutout-top"></div>
                        <div className="pass-cutout-bottom"></div>
                      </div>

                      <div className="pass-sidebar" style={{ background: 'var(--surface-elevated)' }}>
                        <div className="pass-actions" style={{ flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                          {booking.status === 'CONFIRMED' && (
                            <>
                              <Link 
                                to={`/track?vehicleId=${booking.tripId?.vehicleId || 'mock-vehicle-123'}`}
                                className="auth-button"
                                style={{ 
                                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', 
                                  color: 'var(--text-on-primary)',
                                  padding: '0.45rem 0.8rem',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  textAlign: 'center',
                                  width: '100%',
                                  display: 'block',
                                  border: 'none',
                                  boxShadow: '0 4px 10px rgba(245, 183, 49, 0.2)'
                                }}
                              >
                                {t('trackLive')}
                              </Link>
                              <button 
                                onClick={() => handleCancel(booking._id)}
                                style={{ 
                                  background: 'transparent', 
                                  border: '1px solid rgba(255,100,100,0.3)', 
                                  color: '#ff6b6b',
                                  padding: '0.45rem 0.8rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  width: '100%',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.1)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {t('cancelSeat')}
                              </button>
                            </>
                          )}
                          {booking.status === 'PENDING_PAYMENT' && (
                            <Link
                              to={`/checkout?tripId=${booking.tripId?._id}`}
                              className="auth-button"
                              style={{ 
                                width: '100%', 
                                fontSize: '0.8rem', 
                                padding: '0.45rem 0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                textAlign: 'center',
                                textDecoration: 'none',
                                background: 'var(--primary)',
                                color: 'black',
                                borderRadius: '6px',
                                fontWeight: '700'
                              }}
                            >
                              {t('payNow')} <CreditCard size={14} />
                            </Link>
                          )}
                          {booking.status === 'CANCELLED' && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>No Actions</span>
                          )}

                          <button 
                            onClick={() => toggleFlip(booking._id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              marginTop: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              justifyContent: 'center'
                            }}
                          >
                            <RefreshCw size={10} /> {t('backBtn')}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── QR CODE BOARDING PASS MODAL ────── */}
      {showQrModal && qrValue && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={() => setShowQrModal(false)}
        >
          <div style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '2.5rem 2rem 2rem 2rem',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            position: 'relative',
            animation: 'slide-down 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowQrModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>

            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Boarding Pass QR 🎫
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Present this QR code to the D-Ride driver upon boarding the minibus.
            </p>

            {/* QR Code Container */}
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '20px',
              display: 'inline-block',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              marginBottom: '1.5rem'
            }}>
              <img src={qrValue} alt="Ticket QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
            </div>

            <div style={{
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '14px',
              textAlign: 'left',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Ticket ID:</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  #{activeBookingId?.toUpperCase()}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Verification Status:</span>
                <strong style={{ 
                  color: bookings.find(b => b._id === activeBookingId)?.status === 'BOARDED' 
                    ? 'var(--success)' 
                    : 'var(--primary)' 
                }}>
                  {bookings.find(b => b._id === activeBookingId)?.status === 'BOARDED' 
                    ? 'Boarded & Checked In ✅' 
                    : 'Ready to Board 🕒'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
