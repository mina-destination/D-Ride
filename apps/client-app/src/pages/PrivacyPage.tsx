import { useTranslation } from '../context/LanguageContext';
import { Shield, Lock, MapPin, Database, EyeOff } from 'lucide-react';
import SEO from '../components/SEO';

export default function PrivacyPage() {
  const { language } = useTranslation();
  const isAr = language === 'ar';

  const seoTitle = isAr ? 'سياسة الخصوصية | دي-رايد' : 'Privacy Policy | D-Ride';
  const seoDescription = isAr
    ? 'اعرف كيف تجمع منصة دي-رايد بياناتك الشخصية وتؤمن تعاملاتك المالية المتكاملة مع بوابة بيموب لحمايتها.'
    : 'Understand how D-Ride collects, stores, and secures your personal and payment data in compliance with PCI-DSS standards.';

  return (
    <div className="page-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', overflowX: 'clip' as any }}>
      <SEO title={seoTitle} description={seoDescription} />
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
            {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </span>
          <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '1.25rem', lineHeight: '1.2' }}>
            {isAr ? 'حماية ' : 'Protecting Your '}<span className="hero-title-accent">{isAr ? 'خصوصيتك' : 'Privacy'}</span>
          </h1>
          <p className="hero-subtitle" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto', opacity: 0.85 }}>
            {isAr 
              ? 'تلتزم منصة دي-رايد بحماية بياناتك الشخصية وضمان سرية تعاملاتك.'
              : 'D-Ride is committed to protecting your personal data and ensuring secure transactions.'
            }
          </p>
        </div>

        {/* Main Content (Glass Card) */}
        <div className="glass" style={{
          padding: '3rem 2.5rem',
          borderRadius: 'var(--radius-2xl)',
          width: '100%',
          marginBottom: '3rem',
          textAlign: isAr ? 'right' : 'left',
          position: 'relative'
        }}>
          {/* Section 1: Data Storage & Protection */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
              <Database size={24} style={{ color: 'var(--primary)' }} />
              {isAr ? '1. جمع البيانات وتخزينها' : '1. Data Collection & Storage'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
              {isAr
                ? 'نقوم بجمع وتخزين المعلومات الضرورية فقط لتشغيل المنصة وتقديم خدمات النقل بشكل فعال، مثل اسمك، رقم الهاتف، والبريد الإلكتروني. يتم الاحتفاظ بهذه البيانات وتشفيرها بشكل آمن على خوادمنا السحابية المحمية، ولا يتم بيع أو مشاركة بياناتك الشخصية مع أي أطراف ثالثة لأغراض تسويقية.'
                : 'We collect and store only the necessary information to operate the platform and deliver transit services effectively, such as your name, phone number, and email. This data is securely stored and encrypted on our protected cloud servers, and we never sell or share your personal data with third parties for marketing purposes.'
              }
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '2rem 0' }} />

          {/* Section 2: Location Telemetry */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
              <MapPin size={24} style={{ color: 'var(--info)' }} />
              {isAr ? '2. تتبع الموقع والاتصال عن بُعد' : '2. Location Tracking & Telemetry'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '1rem' }}>
              {isAr
                ? 'لتمكينك من تتبع الحافلات مباشرة على الخريطة ومعرفة أوقات الوصول المقدرة بدقة، نستخدم تقنيات تحديد المواقع وتتبع الموقع الجغرافي. يرجى ملاحظة ما يلي بخصوص تتبع الموقع:'
                : 'To enable real-time shuttle tracking on the map and display accurate estimated arrival times (ETA), we utilize geolocation tracking technologies. Please note the following regarding location access:'
              }
            </p>
            <ul style={{ 
              color: 'var(--text-secondary)', 
              lineHeight: '1.8', 
              fontSize: '0.95rem',
              paddingLeft: isAr ? 0 : '1.5rem',
              paddingRight: isAr ? '1.5rem' : 0,
              listStylePosition: 'inside'
            }}>
              <li>{isAr ? 'نطلب إذن الوصول إلى موقع جهازك الجغرافي فقط أثناء استخدام التطبيق لمساعدتك في العثور على أقرب محطة.' : 'We request device location access only while using the application to help you locate the nearest transit stop.'}</li>
              <li>{isAr ? 'يتم تتبع حافلات دي-رايد وسائقيها باستمرار عبر نظام تتبع جغرافي نشط لضمان أمان وموثوقية الرحلة.' : 'D-Ride shuttles and drivers are tracked continuously via an active telemetry system to ensure safety and schedule reliability.'}</li>
              <li>{isAr ? 'لا نقوم بتتبع موقعك الجغرافي في الخلفية عند إغلاق التطبيق.' : 'We do not track your location in the background once the application is closed.'}</li>
            </ul>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '2rem 0' }} />

          {/* Section 3: Paymob Security */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
              <Lock size={24} style={{ color: 'var(--success)' }} />
              {isAr ? '3. معالجة المدفوعات الآمنة (Paymob)' : '3. Secure Payments & Paymob Integration'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
              {isAr
                ? 'تتم جميع معاملات بطاقات الائتمان والدفع الرقمي عبر تكامل مباشر وآمن مع بوابة الدفع الوطنية Paymob. يتوافق معالج الدفع لدينا مع أعلى معايير أمان بيانات بطاقات الدفع (PCI-DSS). لا يملك طاقم دي-رايد أو خوادمها أي إمكانية للوصول إلى تفاصيل بطاقتك أو تخزينها؛ بل تتم معالجة المعاملة بالكامل وتشفيرها بواسطة نظام Paymob لحمايتك من أي محاولات احتيال.'
                : 'All credit card transactions and digital payments are processed through a direct, secure integration with the national payment gateway Paymob. Our payment partner complies fully with Payment Card Industry Data Security Standards (PCI-DSS). D-Ride servers and staff do not access or store your full card details; the entire operation is encrypted and managed directly by Paymob to guard against any fraud.'
              }
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '2rem 0' }} />

          {/* Section 4: Security Measures */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
              <Shield size={24} style={{ color: 'var(--primary)' }} />
              {isAr ? '4. تدابير حماية البيانات' : '4. Information Security Controls'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
              {isAr
                ? 'نحن نطبق مجموعة متنوعة من الإجراءات الأمنية والإدارية لضمان سلامة بياناتك الشخصية من الدخول غير المصرح به أو التعديل أو الإفشاء. يتم إرسال جميع المعلومات الحساسة عبر اتصال مشفر بالكامل بتقنية (SSL/TLS)، ويتم تقييد الوصول إلى البيانات الشخصية لركابنا إلا للموظفين المصرح لهم والذين يحتاجون إليها لتشغيل الخدمة.'
                : 'We implement a robust suite of technical, administrative, and physical security measures designed to protect your personal data from unauthorized access, modification, or disclosure. All sensitive data transmission uses encrypted SSL/TLS layers, and access to passenger data is restricted strictly to authorized staff members who require it to run the service.'
              }
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '2rem 0' }} />

          {/* Section 5: Your Rights */}
          <div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
              <EyeOff size={24} style={{ color: 'var(--error)' }} />
              {isAr ? '5. حقوقك والتحكم في بياناتك' : '5. Your Rights & Data Control'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
              {isAr
                ? 'لديك الحق الكامل في مراجعة بياناتك المسجلة لدينا، وتعديلها، أو طلب حذف حسابك وبياناتك الشخصية نهائياً من خوادمنا في أي وقت. يمكنك القيام بذلك عن طريق التواصل مع فريق خدمة العملاء لدينا وسنقوم بتلبية طلبك فوراً بما لا يتعارض مع القوانين والالتزامات التنظيمية السارية.'
                : 'You hold full rights to view your registered profile, correct inaccuracies, or request the permanent deletion of your account and personal data from our servers. You may exercise this right at any time by contacting our support team, and we will fulfill your request promptly in compliance with applicable laws.'
              }
            </p>
          </div>

        </div>

        {/* Support Section */}
        <div style={{
          borderTop: '1px solid var(--border)',
          width: '100%',
          paddingTop: '3rem',
          textAlign: 'center'
        }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
            {isAr ? 'تحديثات سياسة الخصوصية' : 'Updates to Our Policy'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto' }}>
            {isAr
              ? 'قد نقوم بتحديث سياسة الخصوصية الخاصة بنا بشكل دوري لمواكبة التغيرات في خدماتنا والقوانين السائدة. سيتم إخطار المستخدمين بأي تغييرات جوهرية من خلال إشعارات التطبيق أو البريد الإلكتروني.'
              : 'We may update our Privacy Policy periodically to reflect changes in our services or legal frameworks. Users will be notified of any significant changes via in-app notifications or email.'
            }
          </p>
        </div>

      </div>
    </div>
  );
}
