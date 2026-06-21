import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { useNotifications } from '../context/NotificationContext';
import { useTranslation } from '../context/LanguageContext';
import api from '../services/api';
import SEO from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

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
      // Check for linked bookings (e.g. return booking in round-trip)
      const returnBookingId = sessionStorage.getItem('dride_returnBookingId');
      sessionStorage.removeItem('dride_returnBookingId');

      api.post('/paymob/confirm', {
        bookingId,
        linkedBookingIds: returnBookingId ? [returnBookingId] : undefined,
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
  }, [searchParams, addNotification, t, isAr]);

  return (
    <div className="auth-page">
      <SEO title={seoTitle} description={seoDescription} />
      <Card className="max-w-[500px] w-full text-center bg-[#121224]/80 backdrop-blur-xl border-white/10 shadow-2xl">
        <CardContent className="p-10">
          {status === 'loading' && <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{t('verifyingPayment')}</h1>}

          {status === 'success' && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                {t('paymentSuccessful')}
              </h1>
              <p className="text-[var(--text-secondary)] mt-4 mb-8">
                {t('paymentSuccessDesc')}
              </p>
              <Button
                onClick={() => navigate('/my-trips')}
                className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold"
              >
                {t('viewMyTrips')}
              </Button>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">{t('paymentFailed')}</h1>
              <p className="text-[var(--text-secondary)] mt-4 mb-8">
                {t('paymentFailedDesc')}
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="w-full border-white/10 text-[var(--text-primary)] hover:bg-white/5"
              >
                {t('returnToHome')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
