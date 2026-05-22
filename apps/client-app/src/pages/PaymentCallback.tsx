import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import logo from '../assets/d-ride-logo.jpeg';

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

  useEffect(() => {
    // Paymob redirects with `success=true` or `success=false`
    const isSuccess = searchParams.get('success') === 'true';
    
    // In a real app, we might also want to verify the transaction status with our backend 
    // by passing the order ID or transaction ID here to make sure it wasn't tampered with.
    // For now, we trust the webhook already updated the DB and we just show the UI based on URL.

    if (isSuccess) {
      setStatus('success');
    } else {
      setStatus('failed');
    }
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-card glass" style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
        </div>

        {status === 'loading' && <p>Verifying payment...</p>}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2>Payment Successful!</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '2rem' }}>
              Your transaction has been processed and your seat is confirmed.
            </p>
            <button onClick={() => navigate('/my-trips')} className="auth-button">
              View My Trips
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
            <h2>Payment Failed</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '2rem' }}>
              We could not process your payment. Please try again.
            </p>
            <button onClick={() => navigate('/')} className="auth-button" style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
              Return to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
