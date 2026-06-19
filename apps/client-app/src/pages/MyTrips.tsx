import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI, reviewsAPI } from '../services/api';
import { MapPin, Ticket, QrCode, CreditCard, Compass, User, RefreshCw, Info, ShieldCheck, Star, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { shareTicketPdf } from '../utils/pdfUtils';
import SEO from '../components/SEO';

export default function MyTripsPage() {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { addNotification } = useNotifications();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'رحلاتي وحجوزاتي | دي-رايد' : 'My Bookings | D-Ride';
  const seoDescription = isAr
    ? 'إدارة تذاكر حافلات دي-رايد، وتذاكر الركوب، وتتبع السائق وتقييم رحلتك.'
    : 'Manage your active commutes, boarding passes, and rate your trips on D-Ride.';
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming');



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

  // Custom Confirmation Modal state hooks
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirmClosing, setIsConfirmClosing] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const handleCloseConfirmModal = () => {
    setIsConfirmClosing(true);
    setTimeout(() => {
      setShowConfirmModal(false);
      setIsConfirmClosing(false);
      setConfirmModalData(null);
    }, 280);
  };

  // Info/Alert Card Modal (replaces browser alert())
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isInfoClosing, setIsInfoClosing] = useState(false);
  const [infoModalData, setInfoModalData] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showInfoAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setInfoModalData({ title, message, type });
    setShowInfoModal(true);
  };

  const handleCloseInfoModal = () => {
    setIsInfoClosing(true);
    setTimeout(() => {
      setShowInfoModal(false);
      setIsInfoClosing(false);
      setInfoModalData(null);
    }, 280);
  };

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
      showInfoAlert(
        isAr ? 'شكراً لك!' : 'Thank You!',
        isAr ? 'شكراً لك على تقييمك! ⭐' : 'Thank you for your feedback! ⭐',
        'success'
      );
      handleCloseReviewModal();
      fetchBookings();
    } catch (err: any) {
      showInfoAlert(
        isAr ? 'خطأ' : 'Error',
        err.message || (isAr ? 'فشل إرسال التقييم' : 'Failed to submit review'),
        'error'
      );
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
        // Exclude pending and unpaid bookings from My Trips page
        const paidOrFinalized = data.filter(
          (b: any) => b.status !== 'PENDING_PAYMENT' && b.status !== 'PENDING'
        );
        setBookings(paidOrFinalized);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = (id: string) => {
    const targetBooking = bookings.find(b => b._id === id);
    const departureTime = targetBooking?.tripId?.departureTime ? new Date(targetBooking.tripId.departureTime) : null;
    const now = new Date();
    
    let warningMessage: string;
    if (departureTime) {
      const diffMs = departureTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours > 2) {
        warningMessage = isAr 
          ? 'إشعار استرداد الأموال: نظراً لأن موعد الرحلة بعد أكثر من ساعتين، فأنت مؤهل لاسترداد كامل قيمة التذكرة إلى وسيلة الدفع الأصلية مع خصم رسوم إدارية بسيطة. هل أنت متأكد من رغبتك في إلغاء حجز هذه الرحلة؟'
          : 'Refund Notice: Since departure is more than 2 hours away, you are eligible for a full refund to your original payment method minus a small administrative fee. Are you sure you want to cancel this trip booking?';
      } else {
        warningMessage = isAr
          ? 'تنبيه هام: متبقي أقل من ساعتين على انطلاق الرحلة. وفقاً لسياسة الإلغاء لدينا، فإن التذاكر غير قابلة للاسترداد أو التعديل إذا تم إلغاؤها خلال أقل من ساعتين من موعد الرحلة. هل أنت متأكد من رغبتك في إلغاء حجز هذه الرحلة؟'
          : 'IMPORTANT WARNING: Departure is in less than 2 hours. According to our policy, tickets are non-refundable and non-modifiable if cancelled within 2 hours of departure. Are you sure you want to cancel this trip booking?';
      }
    } else {
      warningMessage = isAr
        ? 'هل أنت متأكد من رغبتك في إلغاء حجز هذه الرحلة؟'
        : 'Are you sure you want to cancel this trip booking?';
    }

    setConfirmModalData({
      title: isAr ? 'تأكيد إلغاء الحجز' : 'Cancel Seat Reservation',
      message: warningMessage,
      onConfirm: async () => {
        try {
          await bookingsAPI.cancel(id);
          const routeName = targetBooking?.tripId?.routeId?.name || 'your D-Ride commute';
          addNotification(
            isAr ? 'تم إلغاء الحجز ❌' : 'Booking Cancelled ❌', 
            isAr 
              ? `تم إلغاء حجز مقعدك لرحلة "${routeName}" بنجاح.` 
              : `Your seat reservation for "${routeName}" was successfully cancelled.`
          );
          fetchBookings();
        } catch {
          showInfoAlert(
            isAr ? 'خطأ' : 'Error',
            isAr ? 'عذراً، فشل إلغاء الحجز.' : 'Failed to cancel booking. Please try again.',
            'error'
          );
        }
      }
    });
    setShowConfirmModal(true);
  };

  const now = new Date();

  const upcomingBookings = bookings.filter((booking: any) => {
    const departureTime = booking.tripId?.departureTime ? new Date(booking.tripId.departureTime) : null;
    const isCancelled = booking.status === 'CANCELLED' || booking.status === 'REFUNDED' || booking.tripId?.status === 'CANCELLED';
    const isPast = departureTime ? departureTime <= now : true;
    const isCompletedOrBoarded = booking.status === 'BOARDED' || booking.status === 'COMPLETED' || booking.tripId?.status === 'COMPLETED';

    return !isCancelled && !isPast && !isCompletedOrBoarded;
  });

  const previousBookings = bookings.filter((booking: any) => {
    const departureTime = booking.tripId?.departureTime ? new Date(booking.tripId.departureTime) : null;
    const isCancelled = booking.status === 'CANCELLED' || booking.status === 'REFUNDED' || booking.tripId?.status === 'CANCELLED';
    const isPast = departureTime ? departureTime <= now : true;
    const isCompletedOrBoarded = booking.status === 'BOARDED' || booking.status === 'COMPLETED' || booking.tripId?.status === 'COMPLETED';

    return isCancelled || isPast || isCompletedOrBoarded;
  });

  const displayedBookings = activeTab === 'upcoming' ? upcomingBookings : previousBookings;

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} />



      <section className="section bookings-page-container">
        <div className="section-header">
          <div className="section-badge">{t('yourCommuteBadge')}</div>
          <h1 className="section-title">{t('myBookingsTitle')}</h1>
          <p className="section-subtitle">
            {t('myBookingsSub')}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
          <div className="sorting-tabs-container">
            <button 
              className={`sorting-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              {t('upcomingTrips')} ({upcomingBookings.length})
            </button>
            <button 
              className={`sorting-tab-btn ${activeTab === 'previous' ? 'active' : ''}`}
              onClick={() => setActiveTab('previous')}
            >
              {t('previousTrips')} ({previousBookings.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading tickets...</div>
        ) : displayedBookings.length === 0 ? (
          <div className="features-grid" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="feature-card glass" style={{ flexDirection: 'column', textAlign: 'center', padding: '2.5rem', width: '100%' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><Ticket size={48} color="var(--text-muted)" /></div>
              <h3 className="feature-title">
                {activeTab === 'upcoming' ? t('noTickets') : t('noPreviousTrips')}
              </h3>
              <p className="feature-desc">
                {activeTab === 'upcoming' 
                  ? t('startBooking') 
                  : (isAr ? 'سيتم عرض تفاصيل رحلاتك المكتملة أو الملغاة هنا.' : 'Your completed, cancelled, or past trip bookings will be displayed here.')
                }
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            {displayedBookings.map((booking: any) => {
              const dateObj = booking.tripId?.departureTime ? new Date(booking.tripId.departureTime) : null;
              const formattedDate = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A';
              const formattedTime = dateObj ? dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A';
              const isFlipped = !!flippedBookings[booking._id];

              return (
                <div key={booking._id}>
                  {/* ── DESKTOP: 3D Flip Ticket ── */}
                  <div className="ticket-container desktop-ticket-only">
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
                            color: (booking.status === 'CANCELLED' || booking.tripId?.status === 'CANCELLED') ? 'var(--danger)' : 'var(--success)', 
                            fontWeight: 'bold',
                            background: 'var(--surface-hover)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)'
                          }}>
                            {booking.tripId?.status === 'CANCELLED' ? t('tripCancelled') : booking.status}
                          </span>
                        </div>

                        <div className="pass-body" style={{ flexWrap: 'wrap', gap: '1.5rem 1rem', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
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
                        </div>

                        {booking.pickupCheckpoint && (
                          <div 
                            className="pass-boarding-footer" 
                            title={language === 'ar' ? "اضغط للملاحة عبر خرائط جوجل" : "Click to navigate via Google Maps"}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              background: 'rgba(245, 183, 49, 0.05)', 
                              border: '1px dashed rgba(245, 183, 49, 0.2)', 
                              borderRadius: '8px', 
                              padding: '8px 12px',
                              marginTop: 'auto',
                              alignSelf: 'stretch',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const coords = booking.pickupCheckpoint?.location?.coordinates || booking.pickupCheckpoint?.coordinates;
                              if (coords && coords.length >= 2) {
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank');
                              } else {
                                showInfoAlert(
                                  isAr ? 'غير متوفر' : 'Unavailable',
                                  isAr ? 'إحداثيات موقع المحطة غير متوفرة.' : 'Station location coordinates are not available.',
                                  'info'
                                );
                              }
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(245, 183, 49, 0.12)';
                              e.currentTarget.style.borderColor = 'var(--primary)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(245, 183, 49, 0.05)';
                              e.currentTarget.style.borderColor = 'rgba(245, 183, 49, 0.2)';
                            }}
                          >
                            <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                              {t('boardingCPShort')}:
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'underline' }}>
                              {booking.pickupCheckpoint.name} 📍
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pass-divider">
                        <div className="pass-cutout-top"></div>
                        <div className="pass-cutout-bottom"></div>
                      </div>

                      <div className="pass-sidebar">
                        <div 
                          className="pass-qr-mock" 
                          title="Scan Ticket QR at Boarding" 
                          style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => handleShowQrModal(booking)}
                        >
                          <QrCode size={48} color="var(--text-primary)" strokeWidth={1.2} />
                        </div>
                        
                        <div className="pass-sidebar-info">
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {t('passId')}: #{booking._id.slice(-6).toUpperCase()}
                          </div>
                          {booking.boardingNumber && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: 'var(--primary)', 
                              fontWeight: 'bold', 
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
                            style={{ padding: '4px 0', marginTop: '2px' }}
                          >
                            <RefreshCw size={12} /> {t('optionsBtn')}
                          </button>
                        </div>
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
                          {booking.status === 'CONFIRMED' && booking.tripId?.status !== 'CANCELLED' && (
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
                              {booking.pickupCheckpoint && (
                                <button 
                                  onClick={() => {
                                    const coords = booking.pickupCheckpoint?.location?.coordinates || booking.pickupCheckpoint?.coordinates;
                                    if (coords && coords.length >= 2) {
                                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank');
                                    } else {
                                      showInfoAlert(
                                        isAr ? 'غير متوفر' : 'Unavailable',
                                        isAr ? 'إحداثيات موقع المحطة غير متوفرة.' : 'Station location coordinates are not available.',
                                        'info'
                                      );
                                    }
                                  }}
                                  className="auth-button"
                                  style={{ 
                                    background: 'var(--surface-hover)', 
                                    color: 'var(--primary)',
                                    border: '1px solid var(--primary)',
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
                                  📍 Navigate to Station
                                </button>
                              )}
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
                          {booking.status === 'PENDING_PAYMENT' && booking.tripId?.status !== 'CANCELLED' && (
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
                          {(booking.status === 'BOARDED' || booking.status === 'COMPLETED') && booking.tripId?.status !== 'CANCELLED' && (
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
                          {(booking.status === 'CANCELLED' || booking.tripId?.status === 'CANCELLED') && (
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

                  {/* ── MOBILE: Premium Wallet Boarding Pass ── */}
                  <div className="mobile-trip-card premium-mobile-ticket">
                    {/* Header */}
                    <div className="ticket-header">
                      <div className="route-info">
                        <Compass className="route-icon" size={16} />
                        <span className="route-name">
                          {booking.tripId?.routeId?.name || 'Standard Route'}
                        </span>
                      </div>
                      <span className={`status-badge ${(booking.status === 'CANCELLED' || booking.tripId?.status === 'CANCELLED') ? 'cancelled' : booking.status.toLowerCase()}`}>
                        {booking.tripId?.status === 'CANCELLED' ? t('tripCancelled') : booking.status}
                      </span>
                    </div>

                    {/* Journey */}
                    {(() => {
                      const startStop = booking.tripId?.routeId?.checkpoints?.find((c: any) => c.type === 'START') || booking.tripId?.routeId?.checkpoints?.[0];
                      const endStop = booking.tripId?.routeId?.checkpoints?.find((c: any) => c.type === 'END') || booking.tripId?.routeId?.checkpoints?.[booking.tripId?.routeId?.checkpoints?.length - 1];
                      return (
                        <div className="ticket-journey">
                          <div className="journey-point">
                            <span className="label">{t('pickup') || 'Pickup'}</span>
                            <span className="value" title={booking.pickupCheckpoint?.name || startStop?.name || 'N/A'}>
                              {booking.pickupCheckpoint?.name || startStop?.name || 'N/A'}
                            </span>
                            <span className="time">{formattedTime}</span>
                          </div>
                          
                          <div className="journey-arrow">
                            <div className="line"></div>
                            <Compass className="bus-icon" size={14} />
                          </div>

                          <div className="journey-point dest">
                            <span className="label">{isAr ? 'الوجهة' : 'Destination'}</span>
                            <span className="value" title={endStop?.name || (isAr ? 'نهاية الخط' : 'Route End')}>
                              {endStop?.name || (isAr ? 'نهاية الخط' : 'Route End')}
                            </span>
                            <span className="time">{formattedTime}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Details Grid */}
                    <div className="ticket-details-grid">
                      <div className="grid-item">
                        <span className="label">{t('dateLabel')}</span>
                        <span className="value">{formattedDate}</span>
                      </div>
                      <div className="grid-item">
                        <span className="label">{t('seatLabelShort')}</span>
                        <span className="value highlight">#{booking.seatNumbers?.join(', ') || booking.seatNumber || 'N/A'}</span>
                      </div>
                      <div className="grid-item">
                        <span className="label">{t('fareLabelShort')}</span>
                        <span className="value">{booking.amountEGP} EGP</span>
                      </div>
                      <div className="grid-item">
                        <span className="label">{isAr ? 'تذكرة' : 'ID'}</span>
                        <span className="value">#{booking._id?.slice(-6).toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Notched Tear Line */}
                    <div className="ticket-tear-line">
                      <div className="notch left"></div>
                      <div className="dashed-border"></div>
                      <div className="notch right"></div>
                    </div>

                    {/* Express Boarding Code Banner */}
                    {booking.boardingNumber && (
                      <div className="boarding-code-banner">
                        <span>{isAr ? 'رمز الصعود السريع' : 'Express Boarding Code'}:</span>
                        <strong>#{booking.boardingNumber}</strong>
                      </div>
                    )}

                    {/* Crew Info */}
                    <div className="ticket-crew-info">
                      <div className="crew-item">
                        <User size={12} />
                        <span><strong>{t('driverLabel')}:</strong> {booking.tripId?.driver?.name || booking.tripId?.driverId?.name || 'Captain'}</span>
                      </div>
                      <div className="crew-item">
                        <Compass size={12} />
                        <span><strong>{t('vehicleLabel')}:</strong> {booking.tripId?.vehicle?.model || booking.tripId?.vehicleId?.model || 'Shuttle'}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ticket-actions">
                      {booking.status === 'CONFIRMED' && booking.tripId?.status !== 'CANCELLED' && (
                        <>
                          <button
                            onClick={() => handleShowQrModal(booking)}
                            className="btn-ticket-icon"
                            title="View QR Code"
                          >
                            <QrCode size={16} />
                          </button>
                          {booking.pickupCheckpoint && (
                            <button
                              onClick={() => {
                                const coords = booking.pickupCheckpoint?.location?.coordinates || booking.pickupCheckpoint?.coordinates;
                                if (coords && coords.length >= 2) {
                                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank');
                                }
                              }}
                              className="btn-ticket-icon"
                              title="Navigate to Pick-up"
                            >
                              <Compass size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => shareTicketPdf(booking, user)}
                            className="btn-ticket-icon"
                            title="Share PDF"
                          >
                            <Share2 size={16} />
                          </button>
                          <button
                            onClick={() => handleCancel(booking._id)}
                            className="btn-ticket-cancel"
                            title={t('cancelSeat')}
                          >
                            ✕
                          </button>
                          
                          <Link
                            to={`/track?vehicleId=${booking.tripId?.vehicleId || 'mock-vehicle-123'}&tripId=${booking.tripId?._id || ''}`}
                            className="btn-ticket-main"
                          >
                            {t('trackLive')} 📍
                          </Link>
                        </>
                      )}

                      {(booking.status === 'BOARDED' || booking.status === 'COMPLETED') && booking.tripId?.status !== 'CANCELLED' && (
                        <>
                          <button
                            onClick={() => shareTicketPdf(booking, user)}
                            className="btn-ticket-icon"
                            title="Share PDF"
                          >
                            <Share2 size={16} />
                          </button>
                          {!booking.review ? (
                            <button
                              onClick={() => handleOpenReviewModal(booking._id)}
                              className="btn-ticket-main"
                            >
                              Rate Trip <Star size={14} fill="var(--text-on-primary)" />
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginInlineStart: 'auto' }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} size={14} fill={star <= booking.review.rating ? '#f5b731' : 'none'} stroke="#f5b731" />
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {(booking.status === 'CANCELLED' || booking.tripId?.status === 'CANCELLED') && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, width: '100%', textAlign: 'center' }}>
                          {isAr ? 'لا توجد إجراءات متاحة' : 'No Actions Available'}
                        </div>
                      )}

                      {booking.status === 'PENDING_PAYMENT' && booking.tripId?.status !== 'CANCELLED' && (
                        <Link
                          to={`/checkout?tripId=${booking.tripId?._id}`}
                          className="btn-ticket-main"
                          style={{ width: '100%' }}
                        >
                          {t('payNow')} <CreditCard size={14} />
                        </Link>
                      )}
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

      {/* ── CARD CONFIRMATION MODAL ────── */}
      {showConfirmModal && confirmModalData && (
        <div className={`qr-modal-overlay ${isConfirmClosing ? 'closing' : ''}`} onClick={handleCloseConfirmModal}>
          <div className={`qr-modal-content ${isConfirmClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <button 
              onClick={handleCloseConfirmModal}
              className="qr-modal-close-btn"
            >
              ✕
            </button>

            <h3 className="qr-modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              ⚠️ {confirmModalData.title}
            </h3>
            
            <p className="qr-modal-subtitle" style={{ fontSize: '0.92rem', lineHeight: '1.5', margin: '1.25rem 0', color: 'var(--text-secondary)' }}>
              {confirmModalData.message}
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
              <button
                onClick={handleCloseConfirmModal}
                className="auth-button"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  background: 'var(--surface-elevated, rgba(255,255,255,0.05))',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              
              <button
                onClick={async () => {
                  await confirmModalData.onConfirm();
                  handleCloseConfirmModal();
                }}
                className="auth-button"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  background: 'var(--danger, #ef4444)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.25)'
                }}
              >
                {isAr ? 'نعم، إلغاء الحجز' : 'Yes, Cancel Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INFO / ALERT CARD MODAL ────── */}
      {showInfoModal && infoModalData && (
        <div className={`qr-modal-overlay ${isInfoClosing ? 'closing' : ''}`} onClick={handleCloseInfoModal}>
          <div className={`qr-modal-content ${isInfoClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <button 
              onClick={handleCloseInfoModal}
              className="qr-modal-close-btn"
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                background: infoModalData.type === 'success'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : infoModalData.type === 'error'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(245, 183, 49, 0.12)',
                boxShadow: infoModalData.type === 'success'
                  ? '0 0 20px rgba(34, 197, 94, 0.15)'
                  : infoModalData.type === 'error'
                    ? '0 0 20px rgba(239, 68, 68, 0.15)'
                    : '0 0 20px rgba(245, 183, 49, 0.15)',
              }}>
                {infoModalData.type === 'success' ? '✅' : infoModalData.type === 'error' ? '❌' : 'ℹ️'}
              </div>

              <h3 className="qr-modal-title" style={{ marginBottom: '0.5rem' }}>
                {infoModalData.title}
              </h3>

              <p className="qr-modal-subtitle" style={{
                fontSize: '0.92rem',
                lineHeight: '1.6',
                margin: '0.75rem 0 1.5rem',
                color: 'var(--text-secondary)'
              }}>
                {infoModalData.message}
              </p>

              <button
                onClick={handleCloseInfoModal}
                className="auth-button"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  background: infoModalData.type === 'success'
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : infoModalData.type === 'error'
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : 'linear-gradient(135deg, var(--primary), var(--primary-dark, #d4a017))',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                  transition: 'opacity 0.2s'
                }}
              >
                {isAr ? 'حسناً' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
