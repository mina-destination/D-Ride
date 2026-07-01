import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI, reviewsAPI } from '../services/api';
import { MapPin, Ticket, QrCode, CreditCard, Navigation2, User, Bus, RefreshCw, Info, ShieldCheck, Star, Share2, Calendar, Snowflake, Wifi, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { shareTicketPdf } from '../utils/pdfUtils';
import SEO from '../components/SEO';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';

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
  
  // Expanded state tracker for mobile ticket details
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});
  
  const toggleExpand = (id: string) => {
    setExpandedTickets(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
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

  const shareLiveTracking = async (booking: any) => {
    const origin = window.location.origin;
    const url = `${origin}/family-tracking?code=${booking._id}`;
    const routeName = booking.tripId?.routeId?.name || 'shuttle bus';
    const text = isAr 
      ? `أنا على متن حافلة دي-رايد (خط: ${routeName}). تتبع مسار رحلتي مباشرة هنا: ${url}`
      : `I'm riding on D-Ride (${routeName} shuttle)! Follow my live journey here: ${url}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Track My D-Ride',
          text,
          url,
        });
      } catch (err) {
        console.warn('Web Share failed, copying link to clipboard:', err);
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showInfoAlert(
          isAr ? 'تم نسخ الرابط 📋' : 'Link Copied 📋',
          isAr 
            ? 'تم نسخ رابط التتبع لعائلتك بنجاح.' 
            : 'Live tracking link copied to clipboard successfully!',
          'success'
        );
      })
      .catch(() => {
        alert(isAr ? 'فشل نسخ الرابط' : 'Failed to copy tracking link.');
      });
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
                            <Navigation2 size={18} style={{ color: 'var(--primary)' }} />
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
                                onClick={() => shareLiveTracking(booking)}
                                className="auth-button"
                                style={{ 
                                  background: 'rgba(245, 183, 49, 0.08)', 
                                  color: 'var(--primary)',
                                  border: '1px solid rgba(245, 183, 49, 0.3)',
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
                                📡 {isAr ? 'مشاركة تتبع الرحلة' : 'Share Live Tracking'}
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
                              <button 
                                onClick={() => shareLiveTracking(booking)}
                                className="auth-button"
                                style={{ 
                                  background: 'rgba(245, 183, 49, 0.08)', 
                                  color: 'var(--primary)',
                                  border: '1px solid rgba(245, 183, 49, 0.3)',
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
                                📡 {isAr ? 'مشاركة تتبع الرحلة' : 'Share Live Tracking'}
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

                  {/* ── MOBILE: Timeline Card (Stitch Design) ── */}
                  <div className="mobile-trip-card timeline-card" onClick={() => toggleExpand(booking._id)}>
                    {(() => {
                      const startStop = booking.tripId?.routeId?.checkpoints?.find((c: any) => c.type === 'START') || booking.tripId?.routeId?.checkpoints?.[0];
                      const endStop = booking.tripId?.routeId?.checkpoints?.find((c: any) => c.type === 'END') || booking.tripId?.routeId?.checkpoints?.[booking.tripId?.routeId?.checkpoints?.length - 1];
                      const pickupName = booking.pickupCheckpoint?.name || startStop?.name || (isAr ? 'نقطة البداية' : 'Terminal Start');
                      const dropoffName = booking.dropoffCheckpoint?.name || endStop?.name || (isAr ? 'نقطة النهاية' : 'Route End');
                      const isCancelled = booking.status === 'CANCELLED' || booking.tripId?.status === 'CANCELLED';
                      const seatCount = booking.seatNumbers?.length || (booking.seatNumber ? 1 : 0);

                      return (
                        <>
                          {/* Header Row: Name + Seats Badge */}
                          <div className="tc-header">
                            <div className="tc-header-left">
                              <div className="tc-bus-icon"><Bus size={18} /></div>
                              <span className="tc-route-name">{booking.tripId?.routeId?.name || (isAr ? 'خط قياسي' : 'Standard Route')}</span>
                            </div>
                            <span className={`tc-seats-badge ${seatCount <= 3 ? 'low' : ''}`}>
                              {seatCount > 0 ? `${seatCount} ${isAr ? 'مقعد' : 'SEAT'}` : (isAr ? 'متاح' : 'AVAIL')}
                            </span>
                          </div>

                          {/* Date Row */}
                          <div className="tc-date-row">
                            <span className="tc-date-text"><Calendar size={12} /> {formattedDate}</span>
                            <span className="tc-date-sep">•</span>
                            <span className="tc-amenity-icon"><Snowflake size={13} /></span>
                            <span className="tc-amenity-icon"><Wifi size={13} /></span>
                          </div>

                          {/* Vertical Timeline */}
                          <div className="tc-timeline">
                            <div className="tc-timeline-start">
                              <div className="tc-tl-track">
                                <div className="tc-tl-dot green"></div>
                                <div className="tc-tl-line"></div>
                              </div>
                              <div className="tc-tl-content">
                                <div className="tc-tl-row">
                                  <span className="tc-time-badge green">{formattedTime}</span>
                                  <span className="tc-tl-badge green">{isAr ? 'صعود' : 'BOARDING'}</span>
                                </div>
                                <span className="tc-station-name">{pickupName}</span>
                              </div>
                            </div>

                            <div className="tc-timeline-duration">
                              <div className="tc-duration-badge">
                                <Clock size={12} />
                                <span>{isAr ? 'رحلة' : 'ride'}</span>
                              </div>
                            </div>

                            <div className="tc-timeline-end">
                              <div className="tc-tl-track">
                                <div className="tc-tl-dot red"></div>
                              </div>
                              <div className="tc-tl-content">
                                <div className="tc-tl-row">
                                  <span className="tc-time-badge red">{formattedTime}</span>
                                  <span className="tc-tl-badge red">{isAr ? 'نزول' : 'DROPOFF'}</span>
                                </div>
                                <span className="tc-station-name">{dropoffName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Pickup Info Bar */}
                          {booking.pickupCheckpoint && (
                            <div className="tc-pickup-bar" onClick={e => e.stopPropagation()}>
                              <span className="tc-pickup-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={12} style={{ color: 'var(--primary)' }} />
                                {isAr ? 'نقطة الصعود' : 'Pickup Stop'}
                              </span>
                              <span className="tc-pickup-sep">|</span>
                              <span className="tc-pickup-detail">
                                <User size={12} />
                                {booking.tripId?.driver?.name || booking.tripId?.driverId?.name || (isAr ? 'الكابتن' : 'Captain')}
                              </span>
                            </div>
                          )}

                          {/* Bottom: Fare + Action */}
                          <div className="tc-bottom">
                            <div className="tc-fare-section">
                              <span className="tc-fare-label">{isAr ? 'السعر' : 'FARE'}</span>
                              <span className="tc-fare-value">{booking.amountEGP}<span className="tc-fare-currency"> EGP</span></span>
                            </div>
                            {booking.status === 'CONFIRMED' && !isCancelled && (
                              <Link to={`/track?vehicleId=${booking.tripId?.vehicleId || 'mock-vehicle-123'}&tripId=${booking.tripId?._id || ''}`} className="tc-action-btn primary" onClick={e => e.stopPropagation()}>
                                <MapPin size={15} /> {t('trackLive')}
                              </Link>
                            )}
                            {(booking.status === 'BOARDED' || booking.status === 'COMPLETED') && !isCancelled && (
                              <button className="tc-action-btn" onClick={e => { e.stopPropagation(); handleOpenReviewModal(booking._id); }}>
                                {booking.review ? <><Star size={15} fill="#FFD700" stroke="#FFD700" /> {booking.review.rating}/5</> : <><Star size={15} /> {isAr ? 'تقييم' : 'Rate'}</>}
                              </button>
                            )}
                            {booking.status === 'PENDING_PAYMENT' && !isCancelled && (
                              <Link to={`/checkout?tripId=${booking.tripId?._id}`} className="tc-action-btn primary" onClick={e => e.stopPropagation()}>
                                <CreditCard size={15} /> {t('payNow')}
                              </Link>
                            )}
                            {isCancelled && (
                              <span className="tc-cancelled-tag">{isAr ? 'ملغي' : 'CANCELLED'}</span>
                            )}
                          </div>

                          {/* Expanded Details */}
                          {expandedTickets[booking._id] && (
                            <div className="tc-expanded" onClick={e => e.stopPropagation()}>
                              <div className="tc-expanded-divider"></div>

                              {booking.boardingNumber && (
                                <div className="tc-boarding-row" onClick={() => handleShowQrModal(booking)}>
                                  <div className="tc-bc-left">
                                    <span className="tc-bc-label">{isAr ? 'رقم الصعود' : 'BOARDING NO'}</span>
                                    <span className="tc-bc-value">#{booking.boardingNumber}</span>
                                  </div>
                                  <div className="tc-bc-qr"><QrCode size={20} /></div>
                                </div>
                              )}

                              <div className="tc-expanded-grid">
                                <div className="tc-expanded-item">
                                  <User size={14} />
                                  <span>{booking.tripId?.driver?.name || booking.tripId?.driverId?.name || (isAr ? 'الكابتن' : 'Captain')}</span>
                                </div>
                                <div className="tc-expanded-item">
                                  <Bus size={14} />
                                  <span>{booking.tripId?.vehicle?.model || booking.tripId?.vehicleId?.model || 'Shuttle'}</span>
                                </div>
                              </div>

                              <div className="tc-expanded-actions">
                                {booking.status === 'CONFIRMED' && (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); handleShowQrModal(booking); }} className="tc-icon-btn"><QrCode size={18} /></button>
                                    {booking.pickupCheckpoint && (
                                      <button onClick={(e) => { e.stopPropagation(); const coords = booking.pickupCheckpoint?.location?.coordinates || booking.pickupCheckpoint?.coordinates; if (coords && coords.length >= 2) window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank'); }} className="tc-icon-btn"><MapPin size={18} /></button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); shareTicketPdf(booking, user); }} className="tc-icon-btn"><Share2 size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); shareLiveTracking(booking); }} className="tc-icon-btn" style={{ color: 'var(--primary)' }} title={isAr ? 'مشاركة التتبع الحي' : 'Share Live Tracking'}>📡</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleCancel(booking._id); }} className="tc-icon-btn danger">✕</button>
                                  </>
                                )}
                                {(booking.status === 'BOARDED' || booking.status === 'COMPLETED') && (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); shareTicketPdf(booking, user); }} className="tc-icon-btn"><Share2 size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); shareLiveTracking(booking); }} className="tc-icon-btn" style={{ color: 'var(--primary)' }} title={isAr ? 'مشاركة التتبع الحي' : 'Share Live Tracking'}>📡</button>
                                    {!booking.review && (
                                      <button onClick={(e) => { e.stopPropagation(); handleOpenReviewModal(booking._id); }} className="tc-icon-btn"><Star size={18} /></button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── QR CODE BOARDING PASS MODAL ────── */}
      {showQrModal && qrValue && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[10008] flex items-center justify-center p-4 qr-modal-overlay ${isQrClosing ? 'closing' : ''}`} onClick={handleCloseQrModal}>
          <Card className={`max-w-[420px] w-full p-8 bg-[#121224] text-white border border-white/10 shadow-2xl relative qr-modal-content ${isQrClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <Button 
              onClick={handleCloseQrModal}
              className="absolute top-4 right-4 bg-white/5 border-none text-muted-foreground hover:bg-white/10 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-bold transition-all duration-200"
            >
              ✕
            </Button>

            <CardHeader className="text-center p-0 mb-6 flex flex-col gap-2">
              <CardTitle className="text-xl font-bold text-amber-500 flex items-center justify-center gap-2">
                {isAr ? 'رمز الصعود QR' : 'Boarding Pass QR'} 🎫
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {isAr 
                  ? 'قم بتقديم رمز QR هذا لسائق دي-رايد عند صعود الحافلة.' 
                  : 'Present this QR code to the D-Ride driver upon boarding the minibus.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 flex flex-col gap-5">
              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-2xl mx-auto flex items-center justify-center shadow-lg w-52 h-52">
                <img src={qrValue} alt="Ticket QR Code" className="w-full h-full object-contain" />
              </div>

              <div className="bg-white/[0.02] border border-border/40 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{isAr ? 'رقم التذكرة:' : 'Ticket ID:'}</span>
                  <span className="font-mono font-bold text-white">#{activeBookingId?.toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{isAr ? 'حالة التحقق:' : 'Verification Status:'}</span>
                  <span className="font-bold" style={{ 
                    color: bookings.find(b => b._id === activeBookingId)?.status === 'BOARDED' 
                      ? '#22c55e' 
                      : '#f5b731' 
                  }}>
                    {bookings.find(b => b._id === activeBookingId)?.status === 'BOARDED' 
                      ? (isAr ? 'تم الصعود والتحقق ✅' : 'Boarded & Checked In ✅') 
                      : (isAr ? 'جاهز للصعود 🕒' : 'Ready to Board 🕒')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── RATE & REVIEW TRIP MODAL ────── */}
      {showReviewModal && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[10008] flex items-center justify-center p-4 qr-modal-overlay ${isReviewClosing ? 'closing' : ''}`} onClick={handleCloseReviewModal}>
          <Card className={`max-w-[420px] w-full p-8 bg-[#121224] text-white border border-white/10 shadow-2xl relative qr-modal-content ${isReviewClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <Button 
              onClick={handleCloseReviewModal}
              className="absolute top-4 right-4 bg-white/5 border-none text-muted-foreground hover:bg-white/10 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-bold transition-all duration-200"
            >
              ✕
            </Button>

            <CardHeader className="text-center p-0 mb-4 flex flex-col gap-2">
              <CardTitle className="text-xl font-bold text-amber-500 flex items-center justify-center gap-2">
                {isAr ? 'تقييم رحلتك' : 'Rate Your Trip'} <Star size={20} className="fill-amber-500 text-amber-500" />
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {isAr 
                  ? 'كيف كانت تجربتك؟ يساعدنا تقييمك في تحسين خدماتنا.' 
                  : 'How was your journey? Your rating helps us improve our service.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 flex flex-col gap-5">
              {/* Stars Selector Container */}
              <div className="flex gap-2 justify-center py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none transition-transform active:scale-95 duration-100 p-1"
                  >
                    <Star
                      size={32}
                      className={`text-amber-500 transition-all ${
                        star <= (hoverRating || rating) ? 'fill-amber-500 scale-110' : 'fill-none scale-100'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Comment Area */}
              <div className="flex flex-col gap-1.5 text-left">
                <Label htmlFor="review-comment" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isAr ? 'أضف تعليقاً (اختياري):' : 'Leave a comment (optional):'}
                </Label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={isAr ? 'شاركنا تفاصيل تجربتك...' : 'Share details of your experience...'}
                  rows={3}
                  className="w-full bg-white/[0.03] border border-border/40 focus:border-amber-500/50 rounded-xl p-3 text-sm text-white placeholder-muted-foreground resize-none outline-none transition-colors"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="w-full bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold py-5 h-12 rounded-xl"
              >
                {submittingReview 
                  ? (isAr ? 'جاري الإرسال...' : 'Submitting...') 
                  : (isAr ? 'إرسال التقييم' : 'Submit Feedback')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CARD CONFIRMATION MODAL ────── */}
      {showConfirmModal && confirmModalData && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[10008] flex items-center justify-center p-4 qr-modal-overlay ${isConfirmClosing ? 'closing' : ''}`} onClick={handleCloseConfirmModal}>
          <Card className={`max-w-[440px] w-full p-8 bg-[#121224] text-white border border-white/10 shadow-2xl relative qr-modal-content ${isConfirmClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <Button 
              onClick={handleCloseConfirmModal}
              className="absolute top-4 right-4 bg-white/5 border-none text-muted-foreground hover:bg-white/10 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-bold transition-all duration-200"
            >
              ✕
            </Button>

            <CardHeader className="text-center p-0 mb-4 flex flex-col gap-2">
              <CardTitle className="text-lg font-bold text-amber-500 flex items-center justify-center gap-2">
                ⚠️ {confirmModalData.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex flex-col gap-5">
              <p className="text-xs text-muted-foreground leading-relaxed text-center">
                {confirmModalData.message}
              </p>

              <div className="flex gap-3 mt-2">
                <Button
                  onClick={handleCloseConfirmModal}
                  variant="outline"
                  className="flex-1 bg-white/5 border-border text-white hover:bg-white/10 font-bold py-3 h-10 rounded-xl"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                
                <Button
                  onClick={async () => {
                    await confirmModalData.onConfirm();
                    handleCloseConfirmModal();
                  }}
                  className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold py-3 h-10 rounded-xl border-none"
                >
                  {isAr ? 'نعم، إلغاء الحجز' : 'Yes, Cancel Trip'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── INFO / ALERT CARD MODAL ────── */}
      {showInfoModal && infoModalData && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[10008] flex items-center justify-center p-4 qr-modal-overlay ${isInfoClosing ? 'closing' : ''}`} onClick={handleCloseInfoModal}>
          <Card className={`max-w-[420px] w-full p-8 bg-[#121224] text-white border border-white/10 shadow-2xl relative qr-modal-content ${isInfoClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <Button 
              onClick={handleCloseInfoModal}
              className="absolute top-4 right-4 bg-white/5 border-none text-muted-foreground hover:bg-white/10 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-bold transition-all duration-200"
            >
              ✕
            </Button>

            <CardContent className="p-0 flex flex-col items-center gap-4 text-center">
              <div 
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md ${
                  infoModalData.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10'
                    : infoModalData.type === 'error'
                      ? 'bg-red-500/10 text-red-500 shadow-red-500/10'
                      : 'bg-amber-500/10 text-amber-500 shadow-amber-500/10'
                }`}
              >
                {infoModalData.type === 'success' ? '✓' : infoModalData.type === 'error' ? '✕' : 'i'}
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-white">
                  {infoModalData.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {infoModalData.message}
                </p>
              </div>

              <Button
                onClick={handleCloseInfoModal}
                className={`w-full font-bold py-3 h-11 rounded-xl mt-2 ${
                  infoModalData.type === 'success'
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 border-none'
                    : infoModalData.type === 'error'
                      ? 'bg-red-500 text-white hover:bg-red-600 border-none'
                      : 'bg-amber-500 text-black hover:bg-amber-600 border-none'
                }`}
              >
                {isAr ? 'حسناً' : 'OK'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
