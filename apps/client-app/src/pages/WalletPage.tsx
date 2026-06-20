import { useEffect, useState } from 'react';
import { walletAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Clock, 
  AlertCircle, 
  Plus, 
  Sparkles, 
  RefreshCw 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface Transaction {
  id: string;
  amountEGP: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export default function WalletPage() {
  const { language } = useTranslation();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'المحفظة الرقمية | دي-رايد' : 'Digital Wallet | D-Ride';
  const seoDescription = isAr
    ? 'إدارة الرصيد والمدفوعات الخاصة بك في دي-رايد مع خيارات شحن رصيد سريعة وآمنة.'
    : 'Manage your prepaid D-Ride balance, view transaction ledger records, and reload credit securely.';

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const presets = ['50', '100', '200', '500'];

  const fetchWalletDetails = () => {
    setLoading(true);
    walletAPI.getBalance()
      .then(res => {
        // Axios response interceptor unwraps payload.data
        // Result is `{ walletBalance: number, transactions: [...] }`
        setBalance(res.walletBalance ?? 0);
        setTransactions(res.transactions ?? []);
      })
      .catch(err => {
        console.error('Failed to load wallet details:', err);
        setErrorMsg(isAr ? 'فشل تحميل بيانات المحفظة. يرجى المحاولة مرة أخرى.' : 'Failed to load wallet details. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWalletDetails();
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg(isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر.' : 'Please enter a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await walletAPI.deposit(amountNum);
      // Backend returns `{ transactionId, paymentKey, iframeUrl, redirectUrl }` inside `data`
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else if (res.iframeUrl) {
        window.location.href = res.iframeUrl;
      } else {
        setErrorMsg(isAr ? 'فشل بدء معالجة الدفع.' : 'Failed to initialize payment checkout.');
        setSubmitting(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || (isAr ? 'حدث خطأ غير متوقع أثناء الاتصال ببوابة الدفع.' : 'An unexpected error occurred while contacting payment gateway.'));
      setSubmitting(false);
    }
  };

  const formatTransactionDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'WALLET_DEPOSIT':
        return isAr ? 'شحن المحفظة' : 'Wallet Deposit';
      case 'WALLET':
        return isAr ? 'دفع تذكرة (محفظة)' : 'Prepaid Fare Payment';
      case 'CARD':
        return isAr ? 'دفع بالبطاقة' : 'Card Payment';
      case 'ADMIN_REWARD':
        return isAr ? 'مكافأة إدارية' : 'Admin Reward';
      default:
        return method;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    const text = isAr 
      ? (s === 'SUCCESS' ? 'ناجحة' : s === 'FAILED' ? 'فشلت' : s === 'PENDING' ? 'معلقة' : 'مسترجعة') 
      : status;
      
    if (s === 'SUCCESS') {
      return <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] uppercase font-bold px-2 py-0.5">{text}</Badge>;
    } else if (s === 'FAILED') {
      return <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] uppercase font-bold px-2 py-0.5">{text}</Badge>;
    } else if (s === 'REFUNDED') {
      return <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] uppercase font-bold px-2 py-0.5">{text}</Badge>;
    } else {
      return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] uppercase font-bold px-2 py-0.5">{text}</Badge>;
    }
  };

  return (
    <div className="payment-page-container min-h-[85vh] pb-12">
      <SEO title={seoTitle} description={seoDescription} />
      
      <div className="max-w-[1000px] w-full px-6 mx-auto">
        
        {/* Header Title Section */}
        <div className="text-center mb-10 mt-4">
          <h1 className="text-white text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2.5">
            <Wallet size={32} className="text-amber-500" />
            {isAr ? 'محفظة دي-رايد الرقمية' : 'D-Ride Wallet'}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isAr ? 'قم بإيداع الأموال وحجز رحلاتك بلمسة واحدة.' : 'Securely load prepaid funds and book rides instantly.'}
          </p>
        </div>

        {errorMsg && (
          <div className="warning-box-opaque max-w-[680px] mx-auto mb-6 flex items-center gap-2.5 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="text-xs font-semibold">{errorMsg}</span>
          </div>
        )}

        {loading && balance === null ? (
          <Card className="max-w-[680px] mx-auto text-center p-16 bg-white/[0.02] border-border/60">
            <CardContent className="p-0 flex flex-col items-center">
              <div className="animate-pulse">
                <Wallet size={48} className="text-muted-foreground" />
              </div>
              <p className="mt-6 text-muted-foreground font-semibold text-sm">
                {isAr ? 'جاري تحميل تفاصيل المحفظة...' : 'Loading wallet details...'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Left side: Balance Banner & Top Up Form */}
            <div className="flex flex-col gap-6">
              
              {/* Premium Balance Card */}
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/3 border-amber-500/20 shadow-lg relative overflow-hidden p-6 transition-all duration-300 hover:border-amber-500/30">
                <div className="absolute -top-6 -right-6 opacity-5 rotate-[-15deg] pointer-events-none">
                  <Wallet size={160} className="text-amber-500" />
                </div>

                <CardContent className="p-0 relative z-10 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        {isAr ? 'الرصيد المتاح' : 'Available Balance'}
                      </span>
                      <h2 className="text-3xl font-black text-amber-500 mt-2">
                        {balance !== null ? balance.toFixed(2) : '0.00'}{' '}
                        <span className="text-lg font-bold text-white">EGP</span>
                      </h2>
                    </div>
                    <div className="bg-white/[0.02] rounded-full w-14 h-14 flex items-center justify-center border border-border">
                      <Sparkles size={24} className="text-amber-500" />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6 text-[11px] text-muted-foreground items-center">
                    <span>🔒</span>
                    <span>{isAr ? 'معالجة مالية مشفرة بالكامل ومتوافقة مع معايير PCI-DSS' : 'Fully encrypted & PCI-DSS compliant financial processing'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Deposit Card */}
              <Card className="p-6 bg-white/[0.02] border-border/60">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                    <Plus size={18} className="text-amber-500" />
                    <span>{isAr ? 'شحن رصيد المحفظة' : 'Top Up prepaid funds'}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    {isAr ? 'أدخل المبلغ الذي ترغب في إضافته إلى محفظتك مسبقة الدفع.' : 'Enter the amount in EGP you wish to load into your prepaid account.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0">
                  <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                    
                    {/* Preset Values Selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {presets.map(val => (
                        <Button
                          key={val}
                          type="button"
                          variant={depositAmount === val ? "default" : "outline"}
                          onClick={() => setDepositAmount(val)}
                          className={depositAmount === val ? "bg-amber-500 text-black hover:bg-amber-500/80 font-bold h-10 rounded-xl" : "bg-transparent border-border text-white hover:bg-white/5 font-semibold h-10 rounded-xl"}
                        >
                          +{val}
                        </Button>
                      ))}
                    </div>

                    {/* Manual input */}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min="10"
                          max="10000"
                          placeholder={isAr ? 'مبلغ مخصص (ج.م)' : 'Custom Amount (EGP)'}
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          required
                          disabled={submitting}
                          className="bg-transparent border-border focus-visible:ring-amber-500/20 pr-12 text-sm text-white animate-none"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold pointer-events-none">
                          EGP
                        </span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting || !depositAmount}
                      className="w-full bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold gap-2 py-5 mt-2 h-12 rounded-xl"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          {isAr ? 'جاري الانتقال لبوابة الدفع...' : 'Redirecting to payment gateway...'}
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} />
                          {isAr ? `شحن المحفظة الآن` : `Charge Wallet Now`}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </div>

            {/* Right side: Ledger Transactions History */}
            <Card className="p-6 bg-white/[0.02] border-border/60 flex flex-col min-h-[430px]">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                  <Clock size={18} className="text-amber-500" />
                  <span>{isAr ? 'سجل العمليات والمدفوعات' : 'Transaction History'}</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  onClick={fetchWalletDetails}
                  className="text-amber-500 hover:text-amber-400 hover:bg-white/5 text-xs font-semibold gap-1 px-2 py-1 h-auto"
                >
                  <RefreshCw size={12} /> {isAr ? 'تحديث' : 'Refresh'}
                </Button>
              </div>

              <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {transactions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-8">
                    <div className="text-4xl mb-2 opacity-55">👛</div>
                    <strong className="text-sm text-white">{isAr ? 'لا توجد عمليات بعد' : 'No transactions recorded yet'}</strong>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {isAr ? 'العمليات وشحن الرصيد ستظهر هنا.' : 'Your deposit and booking fare ledger records will list here.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
                    {transactions.map((tx) => {
                      const isCredit = tx.paymentMethod === 'WALLET_DEPOSIT' || tx.paymentMethod === 'ADMIN_REWARD';
                      const displayAmt = tx.amountEGP;

                      return (
                        <div
                          key={tx.id}
                          className="bg-white/[0.01] border border-border/40 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors duration-200 hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                              {isCredit ? (
                                <ArrowDownLeft size={16} className="text-emerald-500" />
                              ) : (
                                <ArrowUpRight size={16} className="text-amber-500" />
                              )}
                            </div>
                            
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white truncate max-w-[180px] sm:max-w-none">
                                {getMethodLabel(tx.paymentMethod)}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {formatTransactionDate(tx.createdAt)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className={`text-sm font-bold ${isCredit ? 'text-emerald-500' : 'text-white'}`}>
                              {isCredit ? '+' : '-'}{Math.abs(displayAmt)} EGP
                            </span>
                            {getStatusBadge(tx.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

      </div>
    </div>
  );
}
