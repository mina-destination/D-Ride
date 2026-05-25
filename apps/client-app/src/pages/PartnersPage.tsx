import { useState, useEffect } from 'react';
import { partnersAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import { Globe, ArrowRight, Award, ShieldCheck, Zap } from 'lucide-react';
import { cleanGoogleDriveLink } from '../utils/google-drive';

export default function PartnersPage() {
  const { language } = useTranslation();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const isAr = language === 'ar';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '7rem 2rem 4rem',
      position: 'relative',
      zIndex: 1,
      background: 'var(--background)',
      overflow: 'hidden'
    }}>
      {/* Floating neon background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Header Section */}
        <div style={{ marginBottom: '4rem' }} className="animate-fade-in-up">
          <span className="hero-badge" style={{ margin: '0 auto 1rem' }}>
            <span className="hero-badge-dot" />
            {isAr ? 'التعاون الاستراتيجي' : 'Trusted Collaborations'}
          </span>
          <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '1.25rem', lineHeight: '1.2' }}>
            {isAr ? 'شركاء ' : 'Our Valued '}<span className="hero-title-accent">{isAr ? 'النجاح' : 'Partners'}</span>
          </h1>
          <p className="hero-subtitle" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto', opacity: 0.85 }}>
            {isAr 
              ? 'نحن نعمل بالشراكة مع المؤسسات والجامعات وشبكات الدفع الرائدة في مصر لتقديم رحلة نقل جماعي ذكية ومتكاملة تفوق التوقعات.'
              : 'We work in partnership with Egypt\'s leading organizations, academic institutions, and secure payment networks to deliver a state-of-the-art smart transit journey.'
            }
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4rem 0' }}>
            <div className="app-loading-spinner" style={{ borderColor: 'var(--primary) transparent var(--primary) transparent' }} />
            <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
              {isAr ? 'جاري تحميل شركائنا الموثوقين...' : 'Loading our trusted partners...'}
            </p>
          </div>
        ) : (
          <>
            {/* Partners Grid */}
            {partners.length === 0 ? (
              <div className="glass" style={{
                padding: '3rem',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                maxWidth: '500px',
                width: '100%'
              }}>
                <ShieldCheck size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {isAr ? 'لا يوجد شركاء نشطين حالياً' : 'No active partners found'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {isAr ? 'يرجى مراجعة المسؤولين لتفعيل قائمة الشركاء.' : 'Please check back later or contact administrators to register collaborations.'}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '2rem',
                width: '100%',
                marginBottom: '5rem'
              }}>
                {partners.map((partner) => (
                  <div
                    key={partner._id || partner.id}
                    className="glass"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '2.5rem 2rem',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-sm)',
                      background: 'var(--surface-elevated)',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.boxShadow = '0 12px 30px rgba(245, 183, 49, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    {/* Glowing highlight border effect on hover */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '4px',
                      height: '100%',
                      background: 'linear-gradient(to bottom, var(--primary), transparent)',
                      opacity: 0.7
                    }} />

                    {/* Logo wrapper */}
                    <div style={{
                      height: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1.5rem',
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem'
                    }}>
                      <img
                        src={cleanGoogleDriveLink(partner.logoUrl)}
                        alt={partner.name}
                        style={{
                          maxWidth: '120px',
                          maxHeight: '70px',
                          objectFit: 'contain',
                          filter: 'grayscale(15%) brightness(95%)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'grayscale(0%) brightness(100%)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'grayscale(15%) brightness(95%)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div style={{ width: '100%', textAlign: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        {partner.name}
                      </h3>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        background: 'var(--surface-hover)',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontWeight: 600
                      }}>
                        <ShieldCheck size={12} color="var(--primary)" />
                        {isAr ? 'شريك معتمد' : 'Verified Partner'}
                      </span>
                    </div>

                    {/* Link Action */}
                    {partner.websiteUrl ? (
                      <a
                        href={partner.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          padding: '0.6rem 1.2rem',
                          fontSize: '0.85rem',
                          borderRadius: 'var(--radius-md)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          textDecoration: 'none',
                          color: 'var(--text-on-primary)'
                        }}
                      >
                        <Globe size={14} />
                        {isAr ? 'زيارة الموقع الإلكتروني' : 'Visit Website'}
                        <ArrowRight size={14} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
                      </a>
                    ) : (
                      <div style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        padding: '0.6rem 1.2rem',
                        background: 'var(--surface-hover)',
                        borderRadius: 'var(--radius-md)'
                      }}>
                        {isAr ? 'الخدمة مدمجة بالكامل' : 'Fully Integrated Service'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Core Values Section */}
            <div style={{
              width: '100%',
              borderTop: '1px solid var(--border)',
              paddingTop: '4rem',
              marginTop: '2rem'
            }}>
              <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '3rem' }}>
                {isAr ? 'لماذا نثق بشركائنا؟' : 'Why We Value Partnerships'}
              </h2>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '2.5rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <div className="feature-icon" style={{ flexShrink: 0, width: '48px', height: '48px', background: 'rgba(245, 183, 49, 0.1)', color: 'var(--primary)' }}>
                    <Award size={24} />
                  </div>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: isAr ? 'right' : 'left' }}>
                      {isAr ? 'الاعتماد الأكاديمي والمهني' : 'Academic Excellence'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', textAlign: isAr ? 'right' : 'left' }}>
                      {isAr
                        ? 'الربط المباشر مع الجامعات الكبرى في مصر لتسهيل حركة الطلاب والأساتذة من وإلى الحرم الجامعي يومياً بكل سلاسة وأمان.'
                        : 'Direct integrations with Egypt\'s top universities to facilitate smooth, daily campus commute options for students and staff.'
                      }
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <div className="feature-icon" style={{ flexShrink: 0, width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: isAr ? 'right' : 'left' }}>
                      {isAr ? 'حلول دفع آمنة وسريعة' : 'Secure Financial Integration'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', textAlign: isAr ? 'right' : 'left' }}>
                      {isAr
                        ? 'التعاون مع شبكات الدفع الإلكتروني الوطنية مثل بي-موب لضمان معاملات مالية آمنة بنسبة 100% وحماية كاملة للبيانات.'
                        : 'Partnering with premium payment gateways like Paymob Egypt to ensure fast, secure transactions for all bookings.'
                      }
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <div className="feature-icon" style={{ flexShrink: 0, width: '48px', height: '48px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info)' }}>
                    <Zap size={24} />
                  </div>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: isAr ? 'right' : 'left' }}>
                      {isAr ? 'تكنولوجيا النقل الذكي' : 'Next-Gen Infrastructure'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', textAlign: isAr ? 'right' : 'left' }}>
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
