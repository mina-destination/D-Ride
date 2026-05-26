import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import logo from '../assets/d-ride-logo.jpeg';
import { useNotifications } from '../context/NotificationContext';
import { useTranslation } from '../context/LanguageContext';

export default function PaymentCallbackPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

  useEffect(() => {
    // Paymob redirects with `success=true` or `success=false`
    const isSuccess = searchParams.get('success') === 'true';
    
    // In a real app, we might also want to verify the transaction status with our backend 
    // by passing the order ID or transaction ID here to make sure it wasn't tampered with.
    // For now, we trust the webhook already updated the DB and we just show the UI based on URL.

    if (isSuccess) {
      setStatus('success');
      addNotification(t('paymentSuccessNotificationTitle'), t('paymentSuccessNotificationDesc'));
    } else {
      setStatus('failed');
    }
  }, [searchParams, addNotification, t]);

  return (
    <div className="auth-page">
      <div className="auth-card glass" style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
        </div>

        {status === 'loading' && <p>{t('verifyingPayment')}</p>}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2>{t('paymentSuccessful')}</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '2rem' }}>
              {t('paymentSuccessDesc')}
            </p>
            <button onClick={() => navigate('/my-trips')} className="auth-button">
              {t('viewMyTrips')}
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
            <h2>{t('paymentFailed')}</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '2rem' }}>
              {t('paymentFailedDesc')}
            </p>
            <button onClick={() => navigate('/')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              {t('returnToHome')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
