import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api, { bookingsAPI, paymobAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Lock, Bus } from 'lucide-react';

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET' | 'CASH' | 'WALLET_BALANCE'>('CARD');
  const [walletNumber, setWalletNumber] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
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

    paymobAPI.getWallet()
      .then(res => {
        const data = res.data ?? res;
        setWalletBalance(data.walletBalance);
      })
      .catch(err => console.error("Failed to load wallet balance:", err));

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

    if (paymentMethod === 'WALLET' && !walletNumber.match(/^01[0125][0-9]{8}$/)) {
      alert('Please enter a valid Egyptian mobile wallet number (e.g. 01012345678).');
      return;
    }

    setProcessing(true);
    try {
      // Initialize Paymob Checkout
      const paymobResult = await paymobAPI.checkout({
        bookingId: booking._id || booking.id,
        amountCents: booking.amountEGP * 100,
        paymentMethod,
        walletNumber: paymentMethod === 'WALLET' ? walletNumber : undefined,
      });

      // Redirect or navigate
      if (paymentMethod === 'CASH') {
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
      <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="auth-container" style={{ maxWidth: '600px', width: '100%', padding: '0 1rem' }}>
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
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div className="auth-container" style={{ maxWidth: '600px', width: '100%', padding: '0 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
          <h1 style={{ color: 'var(--text-primary)', marginTop: '1rem', fontSize: '2rem', fontWeight: 800 }}>
            Booking Payment
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Cairo Commuter Minibus Fleet (14-Seater)
          </p>
        </div>

        {/* Visual Stepper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          position: 'relative',
          padding: '0 1.5rem'
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '6px' }}>Configure Commute</span>
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>Select Payment</span>
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: processing ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '6px' }}>Confirm Seat</span>
          </div>
        </div>

        <div className="auth-card solid-checkout-card" style={{ borderRadius: '20px', padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700 }}>
            Reservation Details
          </h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Route</span>
            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{trip?.routeId?.name || 'Standard Route'}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Departure</span>
            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {trip?.departureTime ? new Date(trip.departureTime).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'N/A'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Selected Seats</span>
            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
              {seatNumbers.length > 0 ? seatNumbers.map((s: any) => `#${s}`).join(', ') : 'None Selected'}
            </span>
          </div>

          {booking.pickupCheckpoint && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Pickup Station</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{booking.pickupCheckpoint.name}</span>
            </div>
          )}

          {booking.dropoffCheckpoint && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Dropoff Station</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{booking.dropoffCheckpoint.name}</span>
            </div>
          )}

          {/* Cost breakdown */}
          <div style={{
            background: 'var(--surface-hover)',
            borderRadius: '12px',
            padding: '1.25rem',
            margin: '1.5rem 0',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Seat Reservation ({seatNumbers.length} Seat(s))</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {booking.amountEGP} EGP
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>VAT (14% Included)</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {Math.round(booking.amountEGP * 0.14)} EGP
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Booking Fee</span>
              <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                0.00 EGP (FREE)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Total Fare</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                {booking.amountEGP} EGP
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h4 style={{ color: 'var(--text-primary)', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700 }}>
              Payment Method 💳
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={`payment-method-btn ${paymentMethod === 'CARD' ? 'active' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
              >
                <span style={{ fontSize: '1.2rem' }}>💳</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Card / Visa</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('WALLET')}
                className={`payment-method-btn ${paymentMethod === 'WALLET' ? 'active' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
              >
                <span style={{ fontSize: '1.2rem' }}>📱</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Mobile Wallet</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('WALLET_BALANCE')}
                className={`payment-method-btn ${paymentMethod === 'WALLET_BALANCE' ? 'active' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
              >
                <span style={{ fontSize: '1.2rem' }}>💰</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Prepaid Wallet</span>
                {walletBalance !== null && (
                  <span style={{ fontSize: '0.62rem', color: 'var(--primary)' }}>
                    ({walletBalance} EGP)
                  </span>
                )}
              </button>
              {allowCashOnDelivery && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`payment-method-btn ${paymentMethod === 'CASH' ? 'active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💵</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Cash on Board</span>
                </button>
              )}
            </div>

            {paymentMethod === 'WALLET' && (
              <div style={{
                marginBottom: '1.25rem',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                padding: '14px',
                borderRadius: '10px',
                animation: 'slideDownFade 0.3s ease'
              }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Mobile Wallet Number (Vodafone, Orange, Etisalat Cash)
                </label>
                <input
                  type="text"
                  value={walletNumber}
                  onChange={(e) => setWalletNumber(e.target.value)}
                  placeholder="e.g. 01012345678"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-hover)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                  Standard 11-digit Egyptian mobile number.
                </p>
              </div>
            )}

            {paymentMethod === 'WALLET_BALANCE' && (
              <div 
                className="success-box-opaque"
                style={{
                  marginBottom: '1.25rem',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.85rem'
                }}
              >
                💰 <strong>D-Ride Prepaid Wallet</strong>: Deducts <strong>{booking.amountEGP} EGP</strong> instantly from your wallet balance. Booking confirmation is instantaneous.
                {walletBalance !== null && walletBalance < booking.amountEGP && (
                  <div style={{ color: 'var(--error)', marginTop: '8px', fontWeight: 'bold' }}>
                    ⚠️ Insufficient Balance! Please top up your wallet or choose another payment method.
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <div 
                className="warning-box-opaque"
                style={{
                  marginBottom: '1.25rem',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.85rem'
                }}
              >
                🤝 <strong>Cash on Board</strong>: Pay directly to the minibus driver during boarding. Ticket confirmation is instant.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Total Fare</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              {booking.amountEGP} EGP
            </span>
          </div>

          <button 
            onClick={handleCheckout} 
            className="auth-button" 
            disabled={
              processing || 
              (paymentMethod === 'WALLET_BALANCE' && walletBalance !== null && walletBalance < booking.amountEGP)
            }
            style={{ marginTop: '2rem' }}
          >
            {processing 
              ? 'Processing Securely...' 
              : paymentMethod === 'CASH' 
                ? 'Confirm Booking (Cash)' 
                : paymentMethod === 'WALLET_BALANCE'
                  ? 'Pay with Wallet Balance'
                  : `Pay ${booking.amountEGP} EGP via Paymob`
            }
          </button>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Lock size={12} /> Secured via Paymob Egypt. Cards, Wallets, and Cash on Board supported.
          </p>
        </div>
      </div>
    </div>
  );
}
