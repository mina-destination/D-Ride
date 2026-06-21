import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { Wallet, AlertCircle } from 'lucide-react';
import { Card, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function WalletPage() {
  const { language } = useTranslation();
  const navigate = useNavigate();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'المحفظة الرقمية | دي-رايد' : 'Digital Wallet | D-Ride';
  const seoDescription = isAr
    ? 'إدارة الرصيد والمدفوعات الخاصة بك في دي-رايد.'
    : 'Manage your prepaid D-Ride balance.';

  return (
    <div className="payment-page-container min-h-[85vh] pb-12 flex items-center justify-center">
      <SEO title={seoTitle} description={seoDescription} />
      
      <div className="max-w-[500px] w-full px-6 mx-auto">
        <Card className="text-center p-8 bg-white/[0.02] border-border/60 shadow-xl rounded-2xl">
          <CardContent className="p-0 flex flex-col items-center gap-6">
            <div className="bg-amber-500/10 rounded-full w-16 h-16 flex items-center justify-center border border-amber-500/20">
              <Wallet size={32} className="text-amber-500" />
            </div>
            
            <div>
              <CardTitle className="text-xl font-bold text-white mb-2">
                {isAr ? 'المحفظة الرقمية غير متوفرة' : 'Digital Wallet Unavailable'}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                {isAr 
                  ? 'تم إيقاف خدمة المحفظة الرقمية مؤقتاً لتحديث أنظمة الدفع الخاصة بنا. يرجى دفع قيمة رحلاتك مباشرة باستخدام بطاقة الائتمان.' 
                  : 'The Digital Wallet service has been deactivated temporarily during our payment infrastructure upgrades. Please complete your bookings using Credit Cards directly.'}
              </CardDescription>
            </div>

            <div className="warning-box-opaque w-full flex items-center gap-2.5 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-left">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="text-xs font-semibold font-sans">
                {isAr 
                  ? 'إذا كان لديك رصيد متبقٍ، يرجى التواصل مع الدعم الفني للاسترداد.' 
                  : 'If you have any remaining balance, please contact support for immediate refund details.'}
              </span>
            </div>

            <Button
              onClick={() => navigate('/')}
              className="w-full bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold h-11 rounded-xl"
            >
              {isAr ? 'العودة للرئيسية' : 'Return to Home'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
