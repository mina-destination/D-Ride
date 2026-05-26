import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI, reviewsAPI } from '../services/api';
import { MessageCircle, MapPin, Ticket, QrCode, CreditCard, Compass, User, RefreshCw, Info, ShieldCheck, Star, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { shareTicketPdf } from '../utils/pdfUtils';

export default function MyTripsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
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

  // Review Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Modal closing transition animation states
  const [isQrClosing, setIsQrClosing] = useState(false);
  const [isReviewClosing, setIsReviewClosing] = useState(false);

  const handleCloseQrModal = () => {
    setIsQrClosing(true);
    setTimeout(() => {
      setShowQrModal(false);
      setIsQrClosing(false);
    }, 280);
  };

  const handleCloseReviewModal = () => {
    setIsReviewClosing(true);
    setTimeout(() => {
      setShowReviewModal(false);
      setIsReviewClosing(false);
    }, 280);
  };

  const handleOpenReviewModal = (bookingId: string) => {
    setReviewBookingId(bookingId);
    setRating(5);
    setHoverRating(0);
    setComment('');
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewBookingId || rating < 1) return;
    try {
      setSubmittingReview(true);
      await reviewsAPI.submitReview({
        bookingId: reviewBookingId,
        rating,
        comment,
      });
      alert('Thank you for your feedback! ⭐');
      handleCloseReviewModal();
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

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
        const targetBooking = bookings.find(b => b._id === id);
        const routeName = targetBooking?.tripId?.routeId?.name || 'your D-Ride commute';
        addNotification('Booking Cancelled ❌', `Your seat reservation for "${routeName}" was successfully cancelled.`);
        fetchBookings();
      } catch {
        alert('Failed to cancel');
      }
    }
  };

  return (
    <>


      {/* ── WhatsApp Push Notification Simulation Toast ────── */}
      {showWhatsAppToast && recentBooking && (
        <div className="whatsapp-toast">
          <div className="whatsapp-toast-avatar">
            <MessageCircle size={24} color="#075E54" />
          </div>
          <div className="whatsapp-toast-content">
            <div className="whatsapp-toast-header">
              <span className="whatsapp-toast-title">
                WhatsApp Dispatch • D-Ride Hub
              </span>
              <button 
                onClick={() => setShowWhatsAppToast(false)}
                className="whatsapp-toast-close"
              >
                ✕
              </button>
            </div>
            <p className="whatsapp-toast-body">
              Hi <strong>{user?.name || 'Rider'}</strong>! Your ticket is confirmed. Assigned <strong>Seat #{recentBooking.seatNumbers?.join(', ') || recentBooking.seatNumber || 1}</strong> on route <strong>{recentBooking.tripId?.routeId?.name}</strong>. Pickup from <strong>{recentBooking.pickupCheckpoint?.name || 'Route Start'}</strong>.
            </p>
            <div className="whatsapp-toast-actions">
              <Link 
                to={`/track?vehicleId=${recentBooking.tripId?.vehicleId || 'mock-vehicle-123'}&tripId=${recentBooking.tripId?._id || ''}`}
                onClick={() => setShowWhatsAppToast(false)}
                className="whatsapp-toast-link"
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
                            color: booking.status === 'CANCELLED' ? 'var(--danger)' : 'var(--success)', 
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
                        {booking.boardingNumber && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: 'var(--primary)', 
                            fontWeight: 'bold', 
                            marginBottom: '0.5rem',
                            background: 'rgba(245, 183, 49, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(245, 183, 49, 0.25)',
                            display: 'inline-block'
                          }}>
                            Code: #{booking.boardingNumber}
                          </div>
                        )}
                        
                        <button 
                          onClick={() => toggleFlip(booking._id)}
                          className="btn-ghost"
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
                            <span className="pass-value" style={{ fontSize: '0.9rem' }}>
                              {booking.tripId?.driver?.name || 'Captain Ahmed'}
                            </span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '120px' }}>
                            <span className="pass-label">{t('vehicleLabel')}</span>
                            <span className="pass-value" style={{ fontSize: '0.9rem' }}>
                              {booking.tripId?.vehicle 
                                ? `${booking.tripId.vehicle.model} (${booking.tripId.vehicle.plateNumber || ''})` 
                                : 'Toyota HiAce (DR-20)'}
                            </span>
                          </div>
                          <div className="pass-info-block" style={{ minWidth: '90px' }}>
                            <span className="pass-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ShieldCheck size={12} style={{ color: 'var(--success)' }} /> {t('statusLabel')}
                            </span>
                            <span className="pass-value" style={{ fontSize: '0.9rem', color: 'var(--success)' }}>Verified</span>
                          </div>
                          {booking.boardingNumber && (
                            <div className="pass-info-block" style={{ minWidth: '90px' }}>
                              <span className="pass-label">
                                Boarding Code
                              </span>
                              <span className="pass-value" style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                                #{booking.boardingNumber}
                              </span>
                            </div>
                          )}
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
                                to={`/track?vehicleId=${booking.tripId?.vehicleId || 'mock-vehicle-123'}&tripId=${booking.tripId?._id || ''}`}
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
                                onClick={() => shareTicketPdf(booking, user)}
                                className="auth-button"
                                style={{ 
                                  background: 'var(--surface-hover)', 
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border)',
                                  padding: '0.45rem 0.8rem',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  textAlign: 'center',
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Share2 size={12} /> Share PDF
                              </button>
                              <button 
                                onClick={() => handleCancel(booking._id)}
                                className="btn-danger-outline"
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
                          {(booking.status === 'BOARDED' || booking.status === 'COMPLETED') && (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <button 
                                onClick={() => shareTicketPdf(booking, user)}
                                className="auth-button"
                                style={{ 
                                  background: 'var(--surface-hover)', 
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border)',
                                  padding: '0.45rem 0.8rem',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  textAlign: 'center',
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Share2 size={12} /> Share PDF
                              </button>
                              {booking.review ? (
                                <div style={{ 
                                  background: 'rgba(245, 183, 49, 0.05)',
                                  border: '1px solid rgba(245, 183, 49, 0.2)',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: '100%'
                                }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>YOUR FEEDBACK</span>
                                  <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star 
                                        key={star} 
                                        size={14} 
                                        fill={star <= booking.review.rating ? '#f5b731' : 'none'} 
                                        stroke="#f5b731" 
                                      />
                                    ))}
                                  </div>
                                  {booking.review.comment && (
                                    <p style={{ 
                                      fontSize: '0.75rem', 
                                      color: 'var(--text-secondary)', 
                                      fontStyle: 'italic', 
                                      textAlign: 'center',
                                      margin: '4px 0 0 0',
                                      wordBreak: 'break-word',
                                      maxWidth: '150px'
                                    }}>
                                      "{booking.review.comment}"
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleOpenReviewModal(booking._id)}
                                  className="auth-button"
                                  style={{ 
                                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', 
                                    color: 'var(--text-on-primary)',
                                    padding: '0.45rem 0.8rem',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    border: 'none',
                                    boxShadow: '0 4px 10px rgba(245, 183, 49, 0.2)'
                                  }}
                                >
                                  Rate Trip <Star size={14} fill="var(--text-on-primary)" />
                                </button>
                              )}
                            </div>
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
        <div className={`qr-modal-overlay ${isQrClosing ? 'closing' : ''}`} onClick={handleCloseQrModal}>
          <div className={`qr-modal-content ${isQrClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <button 
              onClick={handleCloseQrModal}
              className="qr-modal-close-btn"
            >
              ✕
            </button>

            <h3 className="qr-modal-title">
              Boarding Pass QR 🎫
            </h3>
            <p className="qr-modal-subtitle">
              Present this QR code to the D-Ride driver upon boarding the minibus.
            </p>

            {/* QR Code Container */}
            <div className="qr-modal-qr-container">
              <img src={qrValue} alt="Ticket QR Code" />
            </div>

            <div className="qr-modal-info-panel">
              <div className="qr-modal-info-row">
                <span>Ticket ID:</span>
                <strong className="qr-modal-info-value monospace">
                  #{activeBookingId?.toUpperCase()}
                </strong>
              </div>
              <div className="qr-modal-info-row">
                <span>Verification Status:</span>
                <strong className="qr-modal-info-value" style={{ 
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

      {/* ── RATE & REVIEW TRIP MODAL ────── */}
      {showReviewModal && (
        <div className={`qr-modal-overlay ${isReviewClosing ? 'closing' : ''}`} onClick={handleCloseReviewModal}>
          <div className={`qr-modal-content ${isReviewClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <button 
              onClick={handleCloseReviewModal}
              className="qr-modal-close-btn"
            >
              ✕
            </button>

            <h3 className="qr-modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Rate Your Trip <Star size={22} fill="var(--primary)" color="var(--primary)" />
            </h3>
            <p className="qr-modal-subtitle">
              How was your journey? Your rating helps us improve our service.
            </p>

            {/* Stars Selector Container */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '1.5rem 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '4px',
                    transition: 'transform 0.15s ease'
                  }}
                  className="star-btn"
                >
                  <Star
                    size={36}
                    fill={star <= (hoverRating || rating) ? 'var(--primary)' : 'none'}
                    stroke="var(--primary)"
                    style={{
                      transform: star <= (hoverRating || rating) ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.1s ease, fill 0.1s ease'
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Comment Area */}
            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label 
                htmlFor="review-comment" 
                style={{ 
                  display: 'block', 
                  fontSize: '0.85rem', 
                  color: 'var(--text-secondary)', 
                  marginBottom: '0.5rem',
                  fontWeight: 600
                }}
              >
                Leave a comment (optional):
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Share details of your experience..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview}
              className="auth-button"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                color: 'var(--text-on-primary)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(245, 183, 49, 0.25)',
                transition: 'opacity 0.2s'
              }}
            >
              {submittingReview ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
