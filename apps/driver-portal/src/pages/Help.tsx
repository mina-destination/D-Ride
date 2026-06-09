import { useTranslation } from '../context/LanguageContext';
import { Phone, HelpCircle, ChevronDown, Compass, LifeBuoy, Globe } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/d-ride-logo.jpeg';

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '16px', 
        borderRadius: '12px',
        cursor: 'pointer',
        background: isOpen ? 'rgba(22, 22, 40, 0.8)' : 'rgba(14, 14, 27, 0.45)',
        borderColor: isOpen ? 'rgba(245, 183, 49, 0.3)' : 'rgba(255, 255, 255, 0.05)',
        transition: 'all 0.3s ease'
      }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <h5 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {question}
        </h5>
        <ChevronDown 
          size={16} 
          style={{ 
            color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease'
          }} 
        />
      </div>
      {isOpen && (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '10px 0 0 0', animation: 'fadeIn 0.2s ease' }}>
          {answer}
        </p>
      )}
    </div>
  );
}

export default function HelpPage() {
  const { t, language, setLanguage, isRtl } = useTranslation();

  const faqs = [
    {
      q: isRtl ? 'كيف أقوم بتسجيل دخول راكب باستخدام تذكرته؟' : 'How do I check in a passenger using their ticket?',
      a: isRtl 
        ? 'من لوحة التحكم، افتح بوابة الركوب للرحلة النشطة، ثم اضغط على زر الكاميرا لمسح رمز QR الخاص بتذكرة الراكب. يمكنك أيضاً النقر فوق "تسجيل الدخول" يدوياً بجوار اسم الراكب.'
        : 'From the Dashboard, open the boarding gate for your active trip, then tap the camera button to scan the passenger\'s ticket QR code. You can also click "Check In" manually next to the passenger\'s name.'
    },
    {
      q: isRtl ? 'ماذا أفعل إذا لم تعمل كاميرا مسح رمز QR؟' : 'What if the QR code scanner camera is not working?',
      a: isRtl
        ? 'إذا واجهت مشاكل في الكاميرا، يرجى استخدام زر "تسجيل الدخول" اليدوي بجوار اسم كل راكب في قائمة الركاب لتأكيد صعودهم يدوياً.'
        : 'If you encounter camera issues, please use the manual "Check In" button next to each passenger\'s name in the passenger list to confirm their boarding manually.'
    },
    {
      q: isRtl ? 'كيف أبدأ الرحلة الحية وأبث موقعي؟' : 'How do I start the live trip and stream my location?',
      a: isRtl
        ? 'بعد اكتمال صعود الركاب، انقر فوق "بدء القيادة". سيبدأ التطبيق تلقائياً في بث إحداثيات GPS الخاصة بك إلى مركز تحكم دي-رايد والركاب. تأكد من تمكين خدمات الموقع على هاتفك.'
        : 'After boarding is complete, click "Start Driving". The app will automatically begin broadcasting your GPS coordinates to the D-Ride operations console and passengers. Make sure location services are enabled on your device.'
    },
    {
      q: isRtl ? 'كيف أنهي وردية الرحلة بعد الوصول؟' : 'How do I complete a trip shift after arrival?',
      a: isRtl
        ? 'بمجرد وصولك إلى المحطة النهائية، انقر فوق زر "إنهاء الوردية والرحلة" لتأكيد إكمال الرحلة وحفظ البيانات بشكل آمن.'
        : 'Once you arrive at the terminal destination, click the "Complete Trip Shift" button to confirm the trip completion and save the record securely.'
    }
  ];

  return (
    <div className="app-container" style={{ direction: isRtl ? 'rtl' : 'ltr', paddingBottom: '80px' }}>
      {/* Top Header */}
      <div className="floating-header" style={{
        background: 'rgba(14, 14, 27, 0.45)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '100px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: '1rem',
        zIndex: 10,
        margin: '1rem 1rem 0 1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logo} alt="Logo" style={{ height: '32px', width: 'auto', borderRadius: '4px', objectFit: 'contain', boxShadow: '0 0 10px rgba(245, 183, 49, 0.3)', flexShrink: 0 }} />
          <h2 className="title-outfit" style={{ fontSize: '15px', margin: 0, color: 'var(--text-primary)' }}>
            {t('help')}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <Globe size={18} />
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Support Command Header */}
        <div className="glass-card" style={{
          padding: '1.5rem 1.25rem',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '4px',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)'
          }}>
            <LifeBuoy size={28} />
          </div>
          <h3 className="title-outfit" style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            {t('help')} & Support Command
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {isRtl 
              ? 'احصل على دعم فوري لرحلتك، وأبلغ عن حالات الطوارئ، وتصفح الإرشادات التوضيحية للسائقين.'
              : 'Access instant transit support, report emergency events, and browse the driver FAQs handbook.'}
          </p>
        </div>

        {/* Hotlines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 className="title-outfit" style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={14} style={{ color: 'var(--primary)' }} />
            {isRtl ? 'الاتصال السريع بالدعم' : 'Quick Connect Support'}
          </h4>

          {/* Emergency Hotline */}
          <a href="tel:19999" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="glass-card" style={{
              padding: '16px',
              borderRadius: '16px',
              border: '1px solid rgba(239, 67, 67, 0.15)',
              background: 'rgba(239, 67, 67, 0.03)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'transform 0.2s ease, border-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.borderColor = 'rgba(239, 67, 67, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(239, 67, 67, 0.15)';
            }}
            >
              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
                  🚨 {t('emergencyContact')}
                </h5>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  {t('emergencyDesc')}
                </p>
              </div>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#f87171',
                padding: '8px 16px',
                borderRadius: '100px',
                fontSize: '15px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Phone size={14} fill="currentColor" />
                19999
              </div>
            </div>
          </a>

          {/* Standard Fleet Support */}
          <a href="tel:+201012345678" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="glass-card" style={{
              padding: '16px',
              borderRadius: '16px',
              border: '1px solid rgba(245, 183, 49, 0.15)',
              background: 'rgba(245, 183, 49, 0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'transform 0.2s ease, border-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.borderColor = 'rgba(245, 183, 49, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(245, 183, 49, 0.15)';
            }}
            >
              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                  📞 {t('supportContact')}
                </h5>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  {t('supportDesc')}
                </p>
              </div>
              <div style={{
                background: 'rgba(245, 183, 49, 0.12)',
                color: 'var(--primary)',
                padding: '8px 16px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Phone size={12} fill="currentColor" />
                +201012345678
              </div>
            </div>
          </a>
        </div>

        {/* FAQs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 className="title-outfit" style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={14} style={{ color: 'var(--primary)' }} />
            {isRtl ? 'الأسئلة الشائعة للسائقين' : 'Driver FAQs Handbook'}
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {faqs.map((faq, idx) => (
              <FAQItem key={idx} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
