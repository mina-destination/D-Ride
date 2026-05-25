import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api, { bookingsAPI, paymobAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Lock, Bus } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');
  const [allowCashOnDelivery, setAllowCashOnDelivery] = useState(true);

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



    api.get('/paymob/features')
      .then((res: any) => {
        const allowed = res ? (res.allowCashOnDelivery ?? res.data?.allowCashOnDelivery) : false;
        setAllowCashOnDelivery(!!allowed);
        if (!allowed) {
          setPaymentMethod(prev => prev === 'CASH' ? 'CARD' : prev);
        }
      })
      .catch(err => {
        console.error("Failed to load feature flags:", err);
        setAllowCashOnDelivery(true);
      });
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
      if (paymentMethod === 'CASH') {
        const routeName = booking.tripId?.routeId?.name || 'your commute';
        addNotification('Booking Confirmed 🎫', `Your seat reservation for "${routeName}" is confirmed. Please pay cash on board.`);
        navigate('/my-trips');
      } else if (paymobResult.redirectUrl) {
        window.location.href = paymobResult.redirectUrl;
      } else if (paymobResult.iframeUrl) {
        window.location.href = paymobResult.iframeUrl;
      } else {
        navigate('/my-trips');
      }
    } catch (error) {
      alert('Payment initialization failed: ' + ((error as any)?.message || 'Unknown error'));
      setProcessing(false);
    }
  };

  if (!bookingId) {
    return (
      <div className="auth-page">
        <div className="auth-card solid-checkout-card">No booking selected.</div>
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
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="auth-page">
        <div className="auth-card solid-checkout-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Booking details not found.</p>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>Return to Home</button>
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
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
          <h1 style={{ color: 'var(--text-primary)', marginTop: '1.25rem', fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
            Secure Ride Payment
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Cairo Commuter Minibus Fleet (14-Seater)
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
            <span className="stepper-label" style={{ color: 'var(--text-secondary)' }}>Configure Commute</span>
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
            <span className="stepper-label" style={{ color: 'var(--text-primary)' }}>Select Payment</span>
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
            <span className="stepper-label" style={{ color: processing ? 'var(--text-primary)' : 'var(--text-muted)' }}>Confirm Seat</span>
          </div>
        </div>

        <div className="split-layout-container">
          
          {/* Left Panel: Payment Method Selection */}
          <div className="main-panel">
            
            <div className="premium-card">
              <div className="premium-card-title">
                <span>💳</span> Select Payment Method
              </div>
              
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                All transaction gateways are end-to-end encrypted and comply with PCI-DSS standards.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Credit Card Card Option */}
                <div 
                  className={`payment-card-option ${paymentMethod === 'CARD' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('CARD')}
                >
                  <div className="payment-card-radio">
                    <div className="payment-card-radio-inner" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>💳</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Credit Card / Debit Card</strong>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Pay online instantly using Visa, Mastercard, or Meeza via the secure Paymob gateway.
                    </span>
                  </div>
                </div>

                {/* Cash Card Option */}
                {allowCashOnDelivery && (
                  <div 
                    className={`payment-card-option ${paymentMethod === 'CASH' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('CASH')}
                  >
                    <div className="payment-card-radio">
                      <div className="payment-card-radio-inner" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>💵</span>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Cash on Board</strong>
                      </div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Pay cash directly to the driver upon boarding. Note that ticket reservations are still instant.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic instruction box based on choice */}
              {paymentMethod === 'CARD' ? (
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
                  <div>🔒 <strong>Secure Paymob Checkout</strong>: You will be redirected to the secure Paymob processing page to enter card details.</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Supported schemes: Visa, Mastercard, Meeza, and international bank cards.</div>
                </div>
              ) : (
                <div 
                  className="warning-box-opaque"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    lineHeight: 1.4
                  }}
                >
                  🤝 <strong>Cash on Board</strong>: Please prepare exact change of <strong>{booking.amountEGP} EGP</strong> if possible to avoid delays during boarding check-in.
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Summary & Checkout invoice */}
          <div className="sidebar-panel">
            
            {/* Reservation Summary */}
            <div className="premium-card">
              <div className="premium-card-title">
                <span>📋</span> Reservation Dossier
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Route Line</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginTop: '2px' }}>
                    {trip?.routeId?.name || 'Standard Route'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Departure Schedule</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '2px' }}>
                    {trip?.departureTime ? new Date(trip.departureTime).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Assigned Seats</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1rem', marginTop: '2px' }}>
                    {seatNumbers.length > 0 ? seatNumbers.map((s: any) => `#${s}`).join(', ') : 'None'}
                  </div>
                </div>

                {/* Stations Timeline */}
                <div className="checkpoint-timeline" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  {booking.pickupCheckpoint && (
                    <div className="checkpoint-timeline-item pickup">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">Pickup Hub</span>
                      <span className="checkpoint-timeline-value">{booking.pickupCheckpoint.name}</span>
                    </div>
                  )}
                  {booking.dropoffCheckpoint && (
                    <div className="checkpoint-timeline-item dropoff">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">Dropoff Hub</span>
                      <span className="checkpoint-timeline-value">{booking.dropoffCheckpoint.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="premium-card">
              <div className="premium-card-title">
                <span>🧾</span> Billing Details
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Seat Reserv. ({seatNumbers.length})</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{booking.amountEGP} EGP</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>VAT (14% Included)</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(booking.amountEGP * 0.14)} EGP</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Processing Fee</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>0.00 EGP (FREE)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Total Charge</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{booking.amountEGP} EGP</span>
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
                  ? 'Processing Securely...' 
                  : paymentMethod === 'CASH' 
                    ? 'Confirm Booking (Cash)' 
                    : `Pay ${booking.amountEGP} EGP via Paymob`
                }
              </button>
              
              <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textAlign: 'center', margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <Lock size={12} /> Encrypted online checkouts. Cards and Cash accepted.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
