import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { bookingsAPI, paymobAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';

import { Lock, Bus } from 'lucide-react';

export default function PaymentPage() {
  const { t, isRtl } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod] = useState<'CARD'>('CARD');

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

  const handleCheckout = async () => {
    if (!booking) return;

    setProcessing(true);
    try {
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
    } catch (error) {
      alert((isRtl ? 'فشل بدء عملية الدفع: ' : 'Payment initialization failed: ') + ((error as any)?.message || 'Unknown error'));
      setProcessing(false);
    }
  };

  if (!bookingId) {
    return (
      <div className="auth-page">
        <div className="auth-card solid-checkout-card">{t('noBookingSelected')}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '6rem', paddingBottom: '4rem', width: '100%' }}>
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
    <div className="auth-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '6rem', paddingBottom: '4rem', width: '100%' }}>
      <div className="auth-container" style={{ maxWidth: '1200px', width: '100%', padding: '0 1.5rem', margin: '0 auto' }}>
        
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
          position: 'relative',
          padding: '0 1.5rem',
          maxWidth: '600px',
          margin: '0 auto 3rem auto'
        }}>
          {/* Progress Connecting Line */}
          <div style={{
            position: 'absolute',
            top: '35%',
            left: '15%',
            right: '15%',
            height: '2px',
            background: 'var(--border)',
            zIndex: 0,
            transform: 'translateY(-50%)'
          }} />
          <div style={{
            position: 'absolute',
            top: '35%',
            left: '15%',
            width: processing ? '70%' : '35%',
            height: '2px',
            background: 'var(--primary)',
            zIndex: 0,
            transform: 'translateY(-50%)',
            transition: 'all 0.3s ease'
          }} />

          {/* Step 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(46, 117, 89, 0.2)',
              color: '#2e7559',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '3px solid var(--background)',
            }}>
              ✓
            </div>
            <span className="stepper-label" style={{ color: 'var(--text-secondary)' }}>{t('configureCommuteStepper')}</span>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'var(--text-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '3px solid var(--background)',
              boxShadow: '0 0 10px rgba(245, 183, 49, 0.2)'
            }}>
              2
            </div>
            <span className="stepper-label" style={{ color: 'var(--text-primary)' }}>{t('selectPaymentStepper')}</span>
          </div>

          {/* Step 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: processing ? 'var(--primary)' : 'var(--surface-elevated)',
              color: processing ? 'var(--text-on-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '3px solid var(--background)',
              transition: 'all 0.3s'
            }}>
              3
            </div>
            <span className="stepper-label" style={{ color: processing ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t('confirmSeatStepper')}</span>
          </div>
        </div>

        <div className="split-layout-container">
          
          {/* Left Panel: Payment Method Selection */}
          <div className="main-panel">
            
            <div className="premium-card">
              <div className="premium-card-title">
                <span>💳</span> {t('selectPaymentMethod')}
              </div>
              
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {t('pciDssHelper')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Credit Card Card Option */}
                <div 
                  className={`payment-card-option active`}
                >
                  <div className="payment-card-radio">
                    <div className="payment-card-radio-inner" />
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
              </div>

              {/* Dynamic instruction box based on choice */}
              <div 
                className="success-box-opaque"
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div>🔒 <strong>{t('securePaymobCheckout')}</strong>: {t('paymobRedirectionDisclaimer')}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t('supportedCardSchemes')}</div>
              </div>
            </div>

          </div>

          {/* Right Panel: Summary & Checkout invoice */}
          <div className="sidebar-panel">
            
            {/* Reservation Summary */}
            <div className="premium-card">
              <div className="premium-card-title">
                <span>📋</span> {t('reservationDossier')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('routeLineLabel')}</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginTop: '2px' }}>
                    {isRtl ? (trip?.routeId?.nameAr || trip?.routeId?.name || t('standardRoute')) : (trip?.routeId?.name || t('standardRoute'))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('departureSchedule')}</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '2px' }}>
                    {trip?.departureTime ? new Date(trip.departureTime).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('assignedSeats')}</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1rem', marginTop: '2px' }}>
                    {seatNumbers.length > 0 ? seatNumbers.map((s: any) => `#${s}`).join(', ') : (isRtl ? 'لا يوجد' : 'None')}
                  </div>
                </div>

                {/* Stations Timeline */}
                <div className="checkpoint-timeline" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  {booking.pickupCheckpoint && (
                    <div className="checkpoint-timeline-item pickup">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">{t('pickupHub')}</span>
                      <span className="checkpoint-timeline-value">{isRtl ? (booking.pickupCheckpoint.nameAr || booking.pickupCheckpoint.name) : booking.pickupCheckpoint.name}</span>
                    </div>
                  )}
                  {booking.dropoffCheckpoint && (
                    <div className="checkpoint-timeline-item dropoff">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">{t('dropoffHub')}</span>
                      <span className="checkpoint-timeline-value">{isRtl ? (booking.dropoffCheckpoint.nameAr || booking.dropoffCheckpoint.name) : booking.dropoffCheckpoint.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="premium-card">
              <div className="premium-card-title">
                <span>🧾</span> {t('billingDetails')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('seatReservationCost', { count: seatNumbers.length })}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{booking.amountEGP} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('vatIncluded')}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(booking.amountEGP * 0.14)} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('processingFee')}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{t('freeProcessing')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('totalCharge')}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{booking.amountEGP} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>
              </div>
            </div>

            {/* Checkout Action Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={handleCheckout} 
                className="auth-button" 
                disabled={processing}
                style={{ padding: '1rem' }}
              >
                {processing 
                  ? t('processingPay') 
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
