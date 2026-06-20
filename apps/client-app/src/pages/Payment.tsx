import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { bookingsAPI, paymobAPI, walletAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { Steps } from '../components/ui/steps';
import { Lock, Bus, Calendar, MapPin, Ticket, Tag, Receipt, ShieldCheck, CreditCard } from 'lucide-react';

const cleanStopName = (name: string) => {
  if (!name) return '';
  return name.replace(/\s*\([\d.,\s-]+\)/g, '').trim();
};

export default function PaymentPage() {
  const { t, isRtl, language } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'بوابة الدفع الآمنة | دي-رايد' : 'Secure Payment Gateway | D-Ride';
  const seoDescription = isAr
    ? 'أكمل عملية دفع حجز تذكرة الحافلة الخاصة بك بأمان باستخدام بطاقة الائتمان عبر بوابة بيموب مصر.'
    : 'Complete your premium bus ticket reservation payment securely using credit card via Paymob Egypt.';

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET'>('CARD');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const isSubmitting = useRef(false);

  // Promo Code States
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoStatus, setPromoStatus] = useState<'success' | 'error' | null>(null);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim() || applyingPromo) return;
    setApplyingPromo(true);
    setPromoMessage(null);
    setPromoStatus(null);
    try {
      const updated = await bookingsAPI.applyPromo(booking._id || booking.id, promoCodeInput);
      const data = updated.data ?? updated;
      setBooking(data);
      setPromoCodeInput('');
      setPromoStatus('success');
      setPromoMessage(t('promoCodeApplied'));
    } catch (err: any) {
      setPromoStatus('error');
      setPromoMessage(err?.message || t('promoCodeInvalid'));
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleRemovePromo = async () => {
    setApplyingPromo(true);
    setPromoMessage(null);
    setPromoStatus(null);
    try {
      const updated = await bookingsAPI.applyPromo(booking._id || booking.id, null);
      const data = updated.data ?? updated;
      setBooking(data);
      setPromoStatus(null);
      setPromoMessage(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove promo code');
    } finally {
      setApplyingPromo(false);
    }
  };

  useEffect(() => {
    if (!bookingId) return;

    setLoading(true);
    bookingsAPI.getById(bookingId)
      .then(res => {
        const data = res.data ?? res;
        setBooking(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    walletAPI.getBalance()
      .then(res => {
        setWalletBalance(res.walletBalance);
      })
      .catch(err => {
        console.error('Failed to load wallet balance:', err);
      });
  }, []);

  const handleCheckout = async () => {
    if (!booking || processing || isSubmitting.current) return;

    isSubmitting.current = true;
    setProcessing(true);
    try {
      if (paymentMethod === 'WALLET') {
        await bookingsAPI.payWithWallet(booking._id || booking.id);
        alert(isAr ? 'تم تأكيد الحجز بنجاح باستخدام المحفظة!' : 'Booking successfully confirmed using wallet!');
        navigate('/my-trips');
      } else {
        // Initialize Paymob Checkout
        const paymobResult = await paymobAPI.checkout({
          bookingId: booking._id || booking.id,
          amountCents: booking.amountEGP * 100,
          paymentMethod,
        });

        // Redirect or navigate
        if (paymobResult.redirectUrl) {
          window.location.href = paymobResult.redirectUrl;
        } else if (paymobResult.iframeUrl) {
          window.location.href = paymobResult.iframeUrl;
        } else {
          navigate('/my-trips');
        }
      }
    } catch (error) {
      alert((isRtl ? 'فشل إتمام عملية الدفع: ' : 'Payment failed: ') + ((error as any)?.message || 'Unknown error'));
    } finally {
      setProcessing(false);
      isSubmitting.current = false;
    }
  };

  if (!bookingId) {
    return (
      <div className="auth-page">
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-card solid-checkout-card">{t('noBookingSelected')}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="payment-page-container">
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-container" style={{ maxWidth: '600px', width: '100%', padding: '0 1rem', margin: '0 auto' }}>
          <div className="auth-card solid-checkout-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', justifyContent: 'center' }}>
              <Bus size={48} color="var(--text-secondary)" />
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>{t('loadingBookingDetails')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="auth-page">
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-card solid-checkout-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>{t('bookingDetailsNotFound')}</p>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>{t('returnToHome')}</button>
        </div>
      </div>
    );
  }

  const trip = booking.tripId;
  const seatNumbers = booking.seatNumbers || [];

  return (
    <div className="payment-page-container">
      <SEO title={seoTitle} description={seoDescription} />
      <div className="auth-container" style={{ maxWidth: '1200px', width: '100%', padding: '0 1.5rem', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
            {t('secureRidePayment')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            {t('fleetDesc')}
          </p>
        </div>

        {/* Visual Stepper */}
        <div style={{
          maxWidth: '600px',
          margin: '0 auto 3.5rem auto',
          padding: '0 1.5rem'
        }}>
          <Steps
            current={processing ? 2 : 1}
            isRtl={isRtl}
            items={[
              { title: <span className="stepper-label">{t('configureCommuteStepper')}</span> },
              { title: <span className="stepper-label">{t('selectPaymentStepper')}</span> },
              { title: <span className="stepper-label">{t('confirmSeatStepper')}</span> }
            ]}
          />
        </div>

        <div className="payment-cards-wrapper">
          
          {/* Card 1: Reservation Summary & Pricing Dossier */}
          <div className="premium-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
            
            {/* Ticket Top header */}
            <div className="ticket-header-responsive">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="var(--success)" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('reservationDossier')}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  background: 'rgba(52, 211, 153, 0.15)',
                  color: '#34d399',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  textTransform: 'uppercase'
                }}>
                  {t('statusReady')}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t('passId')}: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>#{bookingId?.slice(-6).toUpperCase()}</strong>
              </div>
            </div>

            {/* Ticket Body Content */}
            <div className="ticket-body-responsive">
              
              {/* Route details grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                width: '100%'
              }}>
                {/* Route Line Card */}
                <div style={{
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="var(--primary)" /> {t('routeLineLabel')}
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    {isRtl ? (trip?.routeId?.nameAr || trip?.routeId?.name || t('standardRoute')) : (trip?.routeId?.name || t('standardRoute'))}
                  </span>
                </div>

                {/* Departure Card */}
                <div style={{
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} color="var(--primary)" /> {t('departureSchedule')}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                    {trip?.departureTime ? new Date(trip.departureTime).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </span>
                </div>

                {/* Assigned Seats Card */}
                <div style={{
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Ticket size={12} color="var(--primary)" style={{ flexShrink: 0 }} /> {t('assignedSeats')}
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--primary-interactive)', fontSize: '0.95rem' }}>
                    {seatNumbers.length > 0 ? seatNumbers.map((s: any) => `#${s}`).join(', ') : (isRtl ? 'لا يوجد' : 'None')}
                  </span>
                </div>
              </div>

              {/* Stations Timeline */}
              <div style={{
                background: 'var(--surface)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border)',
                marginTop: '0.25rem',
                position: 'relative'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                  padding: '0 10px',
                  marginBottom: '12px'
                }}>
                  {/* The connector bar behind the dots */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '20px',
                    right: '20px',
                    height: '2px',
                    background: 'repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)',
                    transform: 'translateY(-50%)',
                    zIndex: 0
                  }} />

                  {/* Small Bus Icon in the exact center of the timeline connector */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '55%',
                    transform: 'translate(-50%, -50%)',
                    background: 'var(--surface)',
                    padding: '0 10px',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Bus size={14} color="var(--primary)" style={{ transform: isRtl ? 'scaleX(-1)' : 'none' }} />
                  </div>

                  {/* Pickup dot */}
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    border: '3px solid var(--surface)',
                    boxShadow: '0 0 0 2px var(--primary)',
                    zIndex: 1
                  }} />

                  {/* Dropoff dot */}
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#EF4444',
                    border: '3px solid var(--surface)',
                    boxShadow: '0 0 0 2px #EF4444',
                    zIndex: 1
                  }} />
                </div>

                {/* Checkpoint text info row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  {/* Pickup label and value */}
                  <div style={{ flex: 1, textAlign: isRtl ? 'right' : 'left', minWidth: 0 }}>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      {t('pickupHub')}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', wordBreak: 'break-word' }}>
                      {cleanStopName(isRtl ? (booking.pickupCheckpoint.nameAr || booking.pickupCheckpoint.name) : booking.pickupCheckpoint.name)}
                    </div>
                    {(() => {
                      const baseTime = trip?.departureTime ? new Date(trip.departureTime).getTime() : 0;
                      const timeToUse = booking.pickupCheckpoint.localizedDepartureTime 
                        ? new Date(booking.pickupCheckpoint.localizedDepartureTime)
                        : (booking.pickupCheckpoint.minutesFromStart !== undefined && baseTime
                            ? new Date(baseTime + booking.pickupCheckpoint.minutesFromStart * 60000)
                            : null);
                      if (!timeToUse) return null;
                      return (
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
                          {timeToUse.toLocaleString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Dropoff label and value */}
                  <div style={{ flex: 1, textAlign: isRtl ? 'left' : 'right', minWidth: 0 }}>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      {t('dropoffHub')}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', wordBreak: 'break-word' }}>
                      {cleanStopName(isRtl ? (booking.dropoffCheckpoint.nameAr || booking.dropoffCheckpoint.name) : booking.dropoffCheckpoint.name)}
                    </div>
                    {(() => {
                      const baseTime = trip?.departureTime ? new Date(trip.departureTime).getTime() : 0;
                      const timeToUse = booking.dropoffCheckpoint.localizedArrivalTime 
                        ? new Date(booking.dropoffCheckpoint.localizedArrivalTime)
                        : (booking.dropoffCheckpoint.minutesFromStart !== undefined && baseTime
                            ? new Date(baseTime + booking.dropoffCheckpoint.minutesFromStart * 60000)
                            : null);
                      if (!timeToUse) return null;
                      return (
                        <div style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600, marginTop: '2px' }}>
                          {timeToUse.toLocaleString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Promo Code Area */}
              <div style={{ borderTop: '1px dashed var(--border)', padding: '1.25rem 0 0.25rem 0', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Tag size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <span>{t('promoCodeLabel')}</span>
                </div>

                {booking.promoCodeId ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(245, 183, 49, 0.08)', border: '1px dashed var(--primary)', padding: '10px 14px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>🎫</span>
                      <div>
                        <strong style={{ color: 'var(--primary)', letterSpacing: '0.5px' }}>{booking.promoCode?.code || 'APPLIED'}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {t('promoCodeApplied')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleRemovePromo}
                      disabled={applyingPromo}
                      className="btn-link"
                      style={{ color: '#EF4444', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      {applyingPromo ? '...' : t('removePromoCode')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder={t('enterPromoCode')}
                        value={promoCodeInput}
                        onChange={(e) => {
                          setPromoCodeInput(e.target.value.toUpperCase());
                          setPromoMessage(null);
                          setPromoStatus(null);
                        }}
                        disabled={applyingPromo}
                        style={{
                          flex: 1,
                          background: 'var(--surface)',
                          border: promoStatus === 'error' ? '1px solid #EF4444' : (promoStatus === 'success' ? '1px solid var(--success)' : '1px solid var(--border)'),
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: 'var(--text-primary)',
                          textTransform: 'uppercase',
                          outline: 'none',
                          fontSize: '0.9rem'
                        }}
                      />
                      <button
                        onClick={handleApplyPromo}
                        disabled={applyingPromo || !promoCodeInput.trim()}
                        style={{
                          background: 'var(--primary)',
                          color: 'black',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontWeight: 'bold',
                          cursor: (applyingPromo || !promoCodeInput.trim()) ? 'not-allowed' : 'pointer',
                          opacity: (applyingPromo || !promoCodeInput.trim()) ? 0.6 : 1,
                          transition: 'opacity 0.2s',
                          fontSize: '0.85rem'
                        }}
                      >
                        {applyingPromo ? '...' : t('applyPromoCode')}
                      </button>
                    </div>
                    {promoMessage && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.78rem',
                        color: promoStatus === 'error' ? '#EF4444' : 'var(--success)',
                        fontWeight: 500
                      }}>
                        {promoMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Billing breakdown */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Receipt size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <span>{t('billingDetails')}</span>
                </div>

                {(() => {
                  const discount = booking.discountEGP || 0;
                  const originalAmount = booking.amountEGP + discount;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('seatReservationCost', { count: seatNumbers.length })}</span>
                        <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{originalAmount} {isRtl ? 'ج.م' : 'EGP'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('vatIncluded')}</span>
                        <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{Math.round(originalAmount * 0.14)} {isRtl ? 'ج.م' : 'EGP'}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('processingFee')}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{t('freeProcessing')}</span>
                      </div>

                      {discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                          <span style={{ color: 'var(--primary)' }}>{t('promoDiscount', { code: booking.promoCode?.code || 'PROMO' })}</span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>-{discount} {isRtl ? 'ج.م' : 'EGP'}</span>
                        </div>
                      )}

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(135deg, rgba(245, 183, 49, 0.08) 0%, rgba(245, 183, 49, 0.02) 100%)',
                        border: '1px solid rgba(245, 183, 49, 0.25)',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        marginTop: '1.25rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        transition: 'transform 0.2s',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('totalCharge')}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={12} color="var(--success)" /> {t('vatIncluded')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em', textShadow: '0 0 1px rgba(245, 183, 49, 0.1)' }}>
                            {booking.amountEGP} {isRtl ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>

          {/* Card 2: Select Payment Method & Action triggers */}
          <div className="premium-card">
            <div className="premium-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span>{t('selectPaymentMethod')}</span>
            </div>
            
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {t('pciDssHelper')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Credit Card Option */}
              <div 
                className={`payment-card-option ${paymentMethod === 'CARD' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setPaymentMethod('CARD')}
              >
                <div className="payment-card-radio">
                  {paymentMethod === 'CARD' && <div className="payment-card-radio-inner" />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💳</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{t('creditCardOptionTitle')}</strong>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {t('creditCardOptionDesc')}
                  </span>
                </div>
              </div>

              {/* D-Ride Wallet Option */}
              <div 
                className={`payment-card-option ${paymentMethod === 'WALLET' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setPaymentMethod('WALLET')}
              >
                <div className="payment-card-radio">
                  {paymentMethod === 'WALLET' && <div className="payment-card-radio-inner" />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>👛</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        {isRtl ? 'محفظة دي-رايد مسبقة الدفع' : 'D-Ride Prepaid Wallet'}
                      </strong>
                    </div>
                    {walletBalance !== null && (
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold', 
                        color: walletBalance >= booking.amountEGP ? '#0f9d58' : '#ea4335',
                        background: 'var(--surface-hover)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)'
                      }}>
                        {isRtl ? 'الرصيد: ' : 'Balance: '}{walletBalance} EGP
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {isRtl 
                      ? 'ادفع فوراً باستخدام رصيد حسابك مسبق الدفع.' 
                      : 'Pay instantly using your D-Ride prepaid wallet account balance.'}
                  </span>
                </div>
              </div>
            </div>

            {paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < booking.amountEGP && (
              <div 
                className="warning-box-opaque"
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  ⚠️ {isRtl ? 'رصيد المحفظة غير كافٍ' : 'Insufficient Wallet Balance'}
                </div>
                <div>
                  {isRtl 
                    ? `رصيد محفظتك الحالي هو ${walletBalance} ج.م، بينما تكلفة الرحلة هي ${booking.amountEGP} ج.م. يرجى شحن محفظتك للمتابعة.`
                    : `Your current wallet balance is ${walletBalance} EGP, but this trip costs ${booking.amountEGP} EGP. Please top up your wallet to proceed.`}
                </div>
                <button
                  onClick={() => navigate('/wallet')}
                  className="auth-button"
                  style={{ 
                    padding: '8px 12px', 
                    fontSize: '0.8rem', 
                    background: 'var(--primary)', 
                    color: 'black',
                    alignSelf: 'flex-start',
                    marginTop: '4px',
                    width: 'auto',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {isRtl ? 'شحن المحفظة الآن ➔' : 'Top Up Wallet Now ➔'}
                </button>
              </div>
            )}

            {/* Redirection disclaimer instruction box */}
            <div 
              className="success-box-opaque"
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                lineHeight: 1.4,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                marginBottom: '2rem'
              }}
            >
              {paymentMethod === 'CARD' ? (
                <>
                  <div>🔒 <strong>{t('securePaymobCheckout')}</strong>: {t('paymobRedirectionDisclaimer')}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t('supportedCardSchemes')}</div>
                </>
              ) : (
                <>
                  <div>🔒 <strong>{isRtl ? 'دفع آمن بالكامل' : '100% Secure Internal Payment'}</strong>: {isRtl ? 'سيتم خصم قيمة الرحلة من رصيد محفظتك فوراً.' : 'Fare will be deducted from your prepaid balance instantly.'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{isRtl ? 'لا توجد رسوم خفية أو إضافية' : 'Zero transaction fees apply'}</div>
                </>
              )}
            </div>

            {/* Action Checkout buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <button 
                onClick={handleCheckout} 
                className="auth-button" 
                disabled={
                  processing || 
                  (paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < booking.amountEGP)
                }
                style={{ padding: '1rem' }}
              >
                {processing 
                  ? (isRtl ? 'جاري معالجة الدفع...' : 'Processing Payment...') 
                  : paymentMethod === 'WALLET'
                    ? (isRtl ? `تأكيد الدفع من المحفظة (${booking.amountEGP} ج.م)` : `Confirm & Pay from Wallet (${booking.amountEGP} EGP)`)
                    : t('payViaPaymob', { amount: booking.amountEGP })
                }
              </button>
              
              <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textAlign: 'center', margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <Lock size={12} /> {t('encryptedOnlineCheckoutInfo')}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
