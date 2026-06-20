import { useState, useEffect } from 'react';
import { partnersAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import { Globe, ArrowRight, Award, ShieldCheck, Zap } from 'lucide-react';
import { cleanGoogleDriveLink } from '../utils/google-drive';
import SEO from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export default function PartnersPage() {
  const { language } = useTranslation();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'شركاء النجاح | دي-رايد' : 'Our Valued Partners | D-Ride';
  const seoDescription = isAr
    ? 'تصفح شراكاتنا الاستراتيجية مع كبرى الجامعات، المؤسسات، وبوابات الدفع الإلكتروني الوطنية في مصر (مثل بيموب).'
    : 'Explore our strategic collaborations with leading Egypt institutions, universities, and secure payment networks like Paymob.';

  useEffect(() => {
    setLoading(true);
    partnersAPI.getActive()
      .then((data) => {
        setPartners(data || []);
      })
      .catch((err) => {
        console.error('Failed to load partners:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="page-container flex-col justify-start" style={{ overflowX: 'clip' as any }}>
      <SEO title={seoTitle} description={seoDescription} />
      {/* Floating neon background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div className="max-w-[1200px] w-full flex flex-col items-center text-center">
        {/* Header Section */}
        <div className="mb-16 animate-fade-in-up">
          <span className="hero-badge mx-auto mb-4">
            <span className="hero-badge-dot" />
            {isAr ? 'التعاون الاستراتيجي' : 'Trusted Collaborations'}
          </span>
          <h1 className="hero-title text-5xl mb-5 leading-tight">
            {isAr ? 'شركاء ' : 'Our Valued '}<span className="hero-title-accent">{isAr ? 'النجاح' : 'Partners'}</span>
          </h1>
          <p className="hero-subtitle text-lg max-w-[700px] mx-auto opacity-85">
            {isAr
              ? 'نحن نعمل بالشراكة مع المؤسسات والجامعات وشبكات الدفع الرائدة في مصر لتقديم رحلة نقل جماعي ذكية ومتكاملة تفوق التوقعات.'
              : 'We work in partnership with Egypt\'s leading organizations, academic institutions, and secure payment networks to deliver a state-of-the-art smart transit journey.'
            }
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center my-16">
            <div className="app-loading-spinner" />
            <p className="mt-6 text-[var(--text-secondary)]">
              {isAr ? 'جاري تحميل شركائنا الموثوقين...' : 'Loading our trusted partners...'}
            </p>
          </div>
        ) : (
          <>
            {/* Partners Grid */}
            {partners.length === 0 ? (
              <Card className="max-w-[500px] w-full bg-white/[0.03] backdrop-blur-xl border-white/10">
                <CardContent className="p-12 text-center">
                  <ShieldCheck size={48} className="text-[var(--text-muted)] mb-4 mx-auto" />
                  <h3 className="text-[var(--text-primary)] mb-2">
                    {isAr ? 'لا يوجد شركاء نشطين حالياً' : 'No active partners found'}
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm">
                    {isAr ? 'يرجى مراجعة المسؤولين لتفعيل قائمة الشركاء.' : 'Please check back later or contact administrators to register collaborations.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full mb-20">
                {partners.map((partner) => (
                  <div
                    key={partner._id || partner.id}
                    className="partner-grid-card"
                  >
                    {/* Glowing highlight border effect on hover */}
                    <div className="partner-grid-card-accent" />

                    {/* Logo wrapper */}
                    <div className="partner-grid-logo-wrapper">
                      <img
                        src={cleanGoogleDriveLink(partner.logoUrl)}
                        alt={partner.name}
                        className="partner-grid-logo"
                      />
                    </div>

                    {/* Content */}
                    <div className="w-full text-center mb-6">
                      <h3 className="text-[var(--text-primary)] text-xl font-bold mb-2">
                        {partner.name}
                      </h3>
                      <Badge className="bg-[var(--surface-hover)] text-[var(--text-muted)] text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-[var(--primary)]" />
                        {isAr ? 'شريك معتمد' : 'Verified Partner'}
                      </Badge>
                    </div>

                    {/* Link Action */}
                    {partner.websiteUrl ? (
                      <Button asChild className={`w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <a
                          href={partner.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe size={14} />
                          {isAr ? 'زيارة الموقع الإلكتروني' : 'Visit Website'}
                          <ArrowRight size={14} className={isAr ? 'rotate-180' : ''} />
                        </a>
                      </Button>
                    ) : (
                      <div className="w-full text-center text-sm text-[var(--text-muted)] py-2.5 px-5 bg-[var(--surface-hover)] rounded-xl">
                        {isAr ? 'الخدمة مدمجة بالكامل' : 'Fully Integrated Service'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Core Values Section */}
            <div className="w-full border-t border-[var(--border)] pt-16 mt-8">
              <h2 className="section-title text-3xl mb-12">
                {isAr ? 'لماذا نثق بشركائنا؟' : 'Why We Value Partnerships'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
                <div className="flex gap-5">
                  <div className="feature-icon shrink-0 w-12 h-12 bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Award size={24} />
                  </div>
                  <div>
                    <h3 className={`text-[var(--text-primary)] text-xl font-bold mb-2 ${isAr ? 'text-right' : 'text-left'}`}>
                      {isAr ? 'الاعتماد الأكاديمي والمهني' : 'Academic Excellence'}
                    </h3>
                    <p className={`text-[var(--text-secondary)] text-sm leading-relaxed ${isAr ? 'text-right' : 'text-left'}`}>
                      {isAr
                        ? 'الربط المباشر مع الجامعات الكبرى في مصر لتسهيل حركة الطلاب والأساتذة من وإلى الحرم الجامعي يومياً بكل سلاسة وأمان.'
                        : 'Direct integrations with Egypt\'s top universities to facilitate smooth, daily campus commute options for students and staff.'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="feature-icon shrink-0 w-12 h-12 bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className={`text-[var(--text-primary)] text-xl font-bold mb-2 ${isAr ? 'text-right' : 'text-left'}`}>
                      {isAr ? 'حلول دفع آمنة وسريعة' : 'Secure Financial Integration'}
                    </h3>
                    <p className={`text-[var(--text-secondary)] text-sm leading-relaxed ${isAr ? 'text-right' : 'text-left'}`}>
                      {isAr
                        ? 'التعاون مع شبكات الدفع الإلكتروني الوطنية مثل بي-موب لضمان معاملات مالية آمنة بنسبة 100% وحماية كاملة للبيانات.'
                        : 'Partnering with premium payment gateways like Paymob Egypt to ensure fast, secure transactions for all bookings.'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="feature-icon shrink-0 w-12 h-12 bg-blue-500/10 text-blue-400">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h3 className={`text-[var(--text-primary)] text-xl font-bold mb-2 ${isAr ? 'text-right' : 'text-left'}`}>
                      {isAr ? 'تكنولوجيا النقل الذكي' : 'Next-Gen Infrastructure'}
                    </h3>
                    <p className={`text-[var(--text-secondary)] text-sm leading-relaxed ${isAr ? 'text-right' : 'text-left'}`}>
                      {isAr
                        ? 'تحديث مستمر للشبكات لضمان وصول التنبيهات الفورية وتحديث الخرائط ومسارات الرحلات بأعلى دقة ممكنة.'
                        : 'Deploying high-velocity networks to guarantee instant notifications, smooth navigation tracking, and route scaling.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
