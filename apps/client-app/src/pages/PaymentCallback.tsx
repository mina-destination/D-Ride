import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { useNotifications } from '../context/NotificationContext';
import { useTranslation } from '../context/LanguageContext';
import api from '../services/api';
import SEO from '../components/SEO';

export default function PaymentCallbackPage() {
  const { t, language } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const processedRef = useRef(false);

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'تأكيد عملية الدفع | دي-رايد' : 'Payment Confirmation | D-Ride';
  const seoDescription = isAr
    ? 'تأكيد تفاصيل الدفع الخاصة بحجز رحلتك على دي-رايد.'
    : 'Confirming payment details for your D-Ride trip booking.';

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const isSuccess = searchParams.get('success') === 'true';
    const bookingId = searchParams.get('bookingId');
    const amountStr = searchParams.get('amount');
    const transactionId = searchParams.get('id');
    
    // In local development, the backend runs on localhost, so Paymob webhooks cannot reach it directly.
    // Therefore, we confirm the transaction on the backend directly via this redirect callback.
    if (isSuccess && bookingId) {
      api.post('/paymob/confirm', {
        bookingId,
        success: true,
        amount: amountStr ? parseFloat(amountStr) : undefined,
        transactionId: transactionId || undefined,
      })
      .then(() => {
        setStatus('success');
        addNotification(t('paymentSuccessNotificationTitle'), t('paymentSuccessNotificationDesc'));
      })
      .catch((err) => {
        console.error('Failed to confirm payment on backend:', err);
        setStatus('failed');
      });
    } else if (isSuccess) {
      setStatus('success');
      addNotification(t('paymentSuccessNotificationTitle'), t('paymentSuccessNotificationDesc'));
    } else {
      setStatus('failed');
    }
  }, [searchParams, addNotification, t]);

  return (
    <div className="auth-page">
      <SEO title={seoTitle} description={seoDescription} />
      <div className="auth-card glass" style={{ textAlign: 'center', maxWidth: '500px', paddingTop: '2.5rem' }}>
        {status === 'loading' && <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('verifyingPayment')}</h1>}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('paymentSuccessful')}</h1>
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
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('paymentFailed')}</h1>
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

