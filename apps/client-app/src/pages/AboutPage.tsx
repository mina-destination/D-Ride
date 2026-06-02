import { useTranslation } from '../context/LanguageContext';
import { Bus, ShieldCheck, Zap } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';

export default function AboutPage() {
  const { language } = useTranslation();
  const isAr = language === 'ar';

  return (
    <div className="page-container" style={{ flexDirection: 'column', overflowX: 'clip' as any }}>
      {/* Floating neon background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div style={{
        maxWidth: '1000px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Header Section */}
        <div style={{ marginBottom: '3.5rem' }} className="animate-fade-in-up">
          <span className="hero-badge" style={{ margin: '0 auto 1rem' }}>
            <span className="hero-badge-dot" />
            {isAr ? 'من نحن' : 'Our Story'}
          </span>
          <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '1.25rem', lineHeight: '1.2' }}>
            {isAr ? 'حول ' : 'About '}<span className="hero-title-accent">D-Ride</span>
          </h1>
          <p className="hero-subtitle" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto', opacity: 0.85 }}>
            {isAr 
              ? 'دي-رايد هي المنصة الرائدة للنقل الجماعي الذكي في مصر، نسعى لإعادة تعريف رحلتك اليومية بمستويات غير مسبوقة من الراحة والتكنولوجيا.'
              : 'D-Ride is Egypt\'s leading smart mass-transit platform, redefining daily commutes with modern tech, real-time telemetry, and premium comfort.'
            }
          </p>
        </div>

        {/* Mission Section (Glass Card) */}
        <div className="glass" style={{
          padding: '2.5rem',
          borderRadius: 'var(--radius-2xl)',
          width: '100%',
          marginBottom: '3rem',
          textAlign: isAr ? 'right' : 'left',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexDirection: isAr ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
            <div style={{
              flex: 1,
              minWidth: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>
                {isAr ? 'رسالتنا ورؤيتنا' : 'Our Mission & Vision'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '1rem' }}>
                {isAr
                  ? 'نسعى جاهدين لحل أزمة النقل اليومية في القاهرة الكبرى من خلال تقديم شبكة حافلات ذكية ومريحة وموثوقة بنسبة 100%. نجمع بين تكنولوجيا التتبع المباشر وحلول الدفع الرقمية الآمنة لنوفر لعملائنا تجربة نقل متكاملة وبأسعار معقولة.'
                  : 'We aim to ease the daily transport bottleneck in Greater Cairo by delivering a highly reliable, 100% scheduled minibus network. By integrating live telemetry, digital ticket passes, and secure payment solutions, we empower commuters with a stress-free and cost-efficient transit alternative.'
                }
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem', margin: 0 }}>
                {isAr
                  ? 'رؤيتنا هي أن نصبح الخيار الأول والذكي للنقل الجماعي في المدن الكبرى بالشرق الأوسط وأفريقيا، مع الحفاظ على البيئة وتقليل التكدس المروري.'
                  : 'Our vision is to become the premier smart transit provider across major metropolitan areas in the Middle East and Africa, advocating for environment-friendly commutes and reduced traffic congestion.'
                }
              </p>
            </div>
            <div style={{
              width: '100%',
              maxWidth: '300px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              background: 'rgba(245, 183, 49, 0.05)',
              border: '1px solid var(--border)',
              padding: '2rem'
            }}>
              <img src={logo} alt="D-Ride Logo" style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius-md)' }} />
            </div>
          </div>
        </div>

        {/* Core Values Grid */}
        <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '2.5rem' }}>
          {isAr ? 'القيم الأساسية التي نؤمن بها' : 'Our Core Values'}
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          width: '100%',
          marginBottom: '4rem'
        }}>
          {/* Comfort */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)', textAlign: isAr ? 'right' : 'left' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(245, 183, 49, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              marginLeft: isAr ? 'auto' : '0',
              marginRight: isAr ? '0' : 'auto'
            }}>
              <Bus size={24} />
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {isAr ? 'أقصى درجات الراحة' : 'Premium Comfort'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>
              {isAr
                ? 'حافلاتنا حديثة ومكيفة، ومقاعدنا مصممة بعناية لتضمن لك رحلة مريحة وهادئة تتيح لك الاسترخاء أو إنجاز عملك أثناء الطريق.'
                : 'All our minibuses are fully air-conditioned and cleaned daily, equipped with ergonomic seating, USB ports, and free WiFi.'
              }
            </p>
          </div>

          {/* Technology */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)', textAlign: isAr ? 'right' : 'left' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              marginLeft: isAr ? 'auto' : '0',
              marginRight: isAr ? '0' : 'auto'
            }}>
              <Zap size={24} />
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {isAr ? 'التكنولوجيا والسرعة' : 'Smart Technology'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>
              {isAr
                ? 'تتبع حافلتك مباشرة على الخريطة بفضل تقنيات تحديد المواقع المتقدمة، واحجز مقعدك واحصل على تذكرتك الرقمية بضغطة زر.'
                : 'Track your shuttle in real-time, view live ETAs for every checkpoint, and book or cancel trips seamlessly within seconds.'
              }
            </p>
          </div>

          {/* Safety */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)', textAlign: isAr ? 'right' : 'left' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              marginLeft: isAr ? 'auto' : '0',
              marginRight: isAr ? '0' : 'auto'
            }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {isAr ? 'الأمان التام والاعتمادية' : 'Absolute Safety'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>
              {isAr
                ? 'سائقونا مدربون ومؤهلون بمستويات عالية، ونضمن الأمان الكامل بفضل المراقبة وتأكيد الحجز برمز الاستجابة السريعة عند الصعود.'
                : 'Drivers undergo thorough background checks and training, and trips are secured via unique QR ticket check-ins.'
              }
            </p>
          </div>
        </div>

        {/* Operating Partners Callout */}
        <div style={{
          borderTop: '1px solid var(--border)',
          width: '100%',
          paddingTop: '3rem',
          textAlign: 'center'
        }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
            {isAr ? 'شراكات موثوقة لحمايتك' : 'Backed by Trusted Partnerships'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 1.5rem' }}>
            {isAr
              ? 'نعمل يداً بيد مع كبرى الجامعات المصرية لتوفير حلول النقل الآمنة للطلاب، وبوابات الدفع الوطنية مثل Paymob لضمان حماية بياناتك المصرفية.'
              : 'D-Ride works with prominent universities for student commutes and processes all ticket bookings via secure Paymob payment tunnels.'
            }
          </p>
        </div>

      </div>
    </div>
  );
}
