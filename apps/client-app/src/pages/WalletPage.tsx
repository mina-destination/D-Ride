import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { paymobAPI } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  AlertCircle, 
  Plus,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function WalletPage() {
  const { t, isRtl } = useTranslation();
  const { addNotification } = useNotifications();
  const [walletData, setWalletData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET'>('CARD');
  const [walletNumber, setWalletNumber] = useState('');
  const [error, setError] = useState('');
  const [isTopupLoading, setIsTopupLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await paymobAPI.getWallet();
      setWalletData(data);
    } catch (err: any) {
      console.error(err);
      setError(isRtl ? 'فشل تحميل بيانات المحفظة' : 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, [isRtl]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);


  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      setError(isRtl ? 'يرجى إدخال مبلغ شحن صحيح' : 'Please enter a valid top-up amount');
      return;
    }

    if (paymentMethod === 'WALLET' && !walletNumber.match(/^01[0125][0-9]{8}$/)) {
      setError(isRtl ? 'يرجى إدخال رقم محفظة هاتف صحيح (مثال: 01012345678)' : 'Please enter a valid Egyptian mobile wallet number (e.g. 01012345678)');
      return;
    }

    try {
      setIsTopupLoading(true);
      const res = await paymobAPI.initializeWalletTopup({
        amountEGP: amount,
        paymentMethod,
        walletNumber: paymentMethod === 'WALLET' ? walletNumber : undefined,
      });

      if (res && res.iframeUrl) {
        addNotification('Topup Initiated 💳', `You are being redirected to complete your wallet topup of ${amount} EGP.`);
        // In local development or sandbox, we might simulate success or redirect to callback.
        // Redirect passenger to the payment window.
        window.location.href = res.iframeUrl;
      } else {
        throw new Error('No redirection link returned');
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 
        (isRtl ? 'فشل بدء عملية الشحن. يرجى المحاولة لاحقاً.' : 'Failed to initialize top-up. Please try again.')
      );
    } finally {
      setIsTopupLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Wallet size={36} style={{ color: 'var(--primary-color)' }} />
            {t('myWallet')}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', margin: 0 }}>
            {isRtl 
              ? 'إدارة الرصيد والمدفوعات الفورية لرحلات دي-رايد.' 
              : 'Manage your prepaid credit and make instant, frictionless ride bookings.'}
          </p>
        </div>
        <button 
          onClick={fetchWallet} 
          className="btn btn-secondary" 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {isRtl ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }} className="wallet-grid">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', flexWrap: 'wrap' }} className="wallet-top-section">
          {/* Card & Balance */}
          <div className="card glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px', position: 'relative', overflow: 'hidden' }}>
            {/* Background design elements */}
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, var(--primary-color) 0%, transparent 70%)', opacity: 0.15, pointerEvents: 'none' }} />
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {t('brandName')} Cash Card
                </span>
                <Wallet size={24} style={{ color: 'var(--primary-color)' }} />
              </div>
              
              <div style={{ marginTop: '2.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>
                  {t('walletBalanceLabel')}
                </span>
                <strong style={{ fontSize: '2.8rem', color: 'var(--text-primary)', display: 'block', lineHeight: 1.2, marginTop: '0.2rem' }}>
                  {walletData ? walletData.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} <span style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--primary-color)' }}>EGP</span>
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--success)' }}>
                <TrendingUp size={16} />
                <span>{isRtl ? 'آمن وفوري' : 'Frictionless Booking Enabled'}</span>
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                •••• •••• •••• DRIDE
              </span>
            </div>
          </div>

          {/* Top-up Form */}
          <div className="card glass" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} style={{ color: 'var(--primary-color)' }} />
              {isRtl ? 'شحن رصيد المحفظة' : 'Top Up Wallet'}
            </h3>
            
            <form onSubmit={handleTopupSubmit}>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {isRtl ? 'مبلغ الشحن (بالجنيه المصري)' : 'Top-Up Amount (EGP)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="10"
                    placeholder="e.g. 200"
                    className="form-control"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    style={{ fontSize: '1.1rem', fontWeight: 600, paddingLeft: isRtl ? '15px' : '45px', paddingRight: isRtl ? '45px' : '15px' }}
                    required
                  />
                  <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: isRtl ? 'auto' : '18px', right: isRtl ? '18px' : 'auto', color: 'var(--text-muted)', fontWeight: 700 }}>
                    EGP
                  </span>
                </div>
              </div>

              {/* Payment Method Selectors */}
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('paymentMethod')}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`payment-method-btn ${paymentMethod === 'CARD' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('CARD')}
                    style={{ flex: 1, padding: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
                  >
                    <CreditCard size={18} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Credit Card</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-method-btn ${paymentMethod === 'WALLET' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('WALLET')}
                    style={{ flex: 1, padding: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
                  >
                    <Wallet size={18} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Mobile Wallet</span>
                  </button>
                </div>
              </div>

              {/* Wallet phone number input */}
              {paymentMethod === 'WALLET' && (
                <div className="form-group animate-fade-in" style={{ marginBottom: '1.2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                    {t('walletInputLabel')}
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 01012345678"
                    className="form-control"
                    value={walletNumber}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                    {t('walletInputDesc')}
                  </small>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-cta"
                disabled={isTopupLoading}
                style={{ width: '100%', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}
              >
                {isTopupLoading ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    {isRtl ? 'جاري التحضير...' : 'Initializing Paymob...'}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    {isRtl ? 'شحن المحفظة الآن' : 'Load Balance Now'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Ledger Transaction History */}
        <div className="card glass" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} style={{ color: 'var(--primary-color)' }} />
            {t('transactionHistory')}
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div className="app-loading-spinner" style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ color: 'var(--text-muted)' }}>{isRtl ? 'جاري تحميل المعاملات...' : 'Loading transactions...'}</p>
            </div>
          ) : !walletData?.transactions || walletData.transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed var(--border)', borderRadius: '8px' }}>
              <AlertCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                {isRtl ? 'لا توجد معاملات سابقة مسجلة في محفظتك.' : 'No transactions recorded on your account.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.8rem', textAlign: isRtl ? 'right' : 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{isRtl ? 'المعاملة' : 'Type'}</th>
                    <th style={{ padding: '0.8rem', textAlign: isRtl ? 'right' : 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{isRtl ? 'طريقة الدفع' : 'Method'}</th>
                    <th style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{isRtl ? 'التاريخ' : 'Date'}</th>
                    <th style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{isRtl ? 'الحالة' : 'Status'}</th>
                    <th style={{ padding: '0.8rem', textAlign: isRtl ? 'left' : 'right', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{isRtl ? 'القيمة' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {walletData.transactions.map((tx: any) => {
                    const isCredit = tx.paymentMethod !== 'WALLET_BALANCE';
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }} className="table-row-hover">
                        {/* Transaction Name/Type */}
                        <td style={{ padding: '1rem 0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isCredit ? (
                              <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>
                                <ArrowDownLeft size={16} />
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}>
                                <ArrowUpRight size={16} />
                              </span>
                            )}
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                                {isCredit 
                                  ? (isRtl ? 'شحن المحفظة' : 'Wallet Load Deposit') 
                                  : (isRtl ? 'حجز مقعد' : 'Trip Seat Reservation')}
                              </strong>
                              {!isCredit && tx.booking?.routeName && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {tx.booking.routeName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        {/* Payment Method */}
                        <td style={{ padding: '1rem 0.8rem', fontSize: '0.85rem', fontWeight: 600 }}>
                          {tx.paymentMethod === 'WALLET_BALANCE' 
                            ? (isRtl ? 'رصيد المحفظة' : 'Wallet Balance') 
                            : tx.paymentMethod}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '1rem 0.8rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(tx.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '1rem 0.8rem', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            background: tx.status === 'SUCCESS' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: tx.status === 'SUCCESS' ? 'var(--success)' : 'var(--error)'
                          }}>
                            {tx.status}
                          </span>
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '1rem 0.8rem', textAlign: isRtl ? 'left' : 'right', fontWeight: 700, fontSize: '1rem', color: isCredit ? 'var(--success)' : 'var(--error)' }}>
                          {isCredit ? '+' : '-'}{tx.amountEGP.toFixed(2)} EGP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
