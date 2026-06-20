import { useTranslation } from '../context/LanguageContext';
import { Shield, Lock, MapPin, Database, EyeOff } from 'lucide-react';
import SEO from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';

export default function PrivacyPage() {
  const { language } = useTranslation();
  const isAr = language === 'ar';

  const seoTitle = isAr ? 'سياسة الخصوصية | دي-رايد' : 'Privacy Policy | D-Ride';
  const seoDescription = isAr
    ? 'اعرف كيف تجمع منصة دي-رايد بياناتك الشخصية وتؤمن تعاملاتك المالية المتكاملة مع بوابة بيموب لحمايتها.'
    : 'Understand how D-Ride collects, stores, and secures your personal and payment data in compliance with PCI-DSS standards.';

  return (
    <div className="page-container flex-col justify-start" style={{ overflowX: 'clip' as any }}>
      <SEO title={seoTitle} description={seoDescription} />
      {/* Floating neon background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div className="max-w-[1000px] w-full flex flex-col items-center text-center">
        {/* Header Section */}
        <div className="mb-14 animate-fade-in-up">
          <span className="hero-badge mx-auto mb-4">
            <span className="hero-badge-dot" />
            {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </span>
          <h1 className="hero-title text-5xl mb-5 leading-tight">
            {isAr ? 'حماية ' : 'Protecting Your '}<span className="hero-title-accent">{isAr ? 'خصوصيتك' : 'Privacy'}</span>
          </h1>
          <p className="hero-subtitle text-lg max-w-[700px] mx-auto opacity-85">
            {isAr
              ? 'تلتزم منصة دي-رايد بحماية بياناتك الشخصية وضمان سرية تعاملاتك.'
              : 'D-Ride is committed to protecting your personal data and ensuring secure transactions.'
            }
          </p>
        </div>

        {/* Main Content (Glass Card) */}
        <Card className={`w-full mb-12 bg-white/[0.03] backdrop-blur-xl border-white/10 rounded-2xl ${isAr ? 'text-right' : 'text-left'}`}>
          <CardContent className="p-10 md:p-12">
            {/* Section 1: Data Storage & Protection */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <Database size={24} className="text-[var(--primary)]" />
                {isAr ? '1. جمع البيانات وتخزينها' : '1. Data Collection & Storage'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem]">
                {isAr
                  ? 'نقوم بجمع وتخزين المعلومات الضرورية فقط لتشغيل المنصة وتقديم خدمات النقل بشكل فعال، مثل اسمك، رقم الهاتف، والبريد الإلكتروني. يتم الاحتفاظ بهذه البيانات وتشفيرها بشكل آمن على خوادمنا السحابية المحمية، ولا يتم بيع أو مشاركة بياناتك الشخصية مع أي أطراف ثالثة لأغراض تسويقية.'
                  : 'We collect and store only the necessary information to operate the platform and deliver transit services effectively, such as your name, phone number, and email. This data is securely stored and encrypted on our protected cloud servers, and we never sell or share your personal data with third parties for marketing purposes.'
                }
              </p>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 2: Location Telemetry */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <MapPin size={24} className="text-blue-400" />
                {isAr ? '2. تتبع الموقع والاتصال عن بُعد' : '2. Location Tracking & Telemetry'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem] mb-4">
                {isAr
                  ? 'لتمكينك من تتبع الحافلات مباشرة على الخريطة ومعرفة أوقات الوصول المقدرة بدقة، نستخدم تقنيات تحديد المواقع وتتبع الموقع الجغرافي. يرجى ملاحظة ما يلي بخصوص تتبع الموقع:'
                  : 'To enable real-time shuttle tracking on the map and display accurate estimated arrival times (ETA), we utilize geolocation tracking technologies. Please note the following regarding location access:'
                }
              </p>
              <ul className={`text-[var(--text-secondary)] leading-loose text-[0.95rem] list-inside ${isAr ? 'pr-6 pl-0' : 'pl-6 pr-0'}`}>
                <li>{isAr ? 'نطلب إذن الوصول إلى موقع جهازك الجغرافي فقط أثناء استخدام التطبيق لمساعدتك في العثور على أقرب محطة.' : 'We request device location access only while using the application to help you locate the nearest transit stop.'}</li>
                <li>{isAr ? 'يتم تتبع حافلات دي-رايد وسائقيها باستمرار عبر نظام تتبع جغرافي نشط لضمان أمان وموثوقية الرحلة.' : 'D-Ride shuttles and drivers are tracked continuously via an active telemetry system to ensure safety and schedule reliability.'}</li>
                <li>{isAr ? 'لا نقوم بتتبع موقعك الجغرافي في الخلفية عند إغلاق التطبيق.' : 'We do not track your location in the background once the application is closed.'}</li>
              </ul>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 3: Paymob Security */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <Lock size={24} className="text-emerald-400" />
                {isAr ? '3. معالجة المدفوعات الآمنة (Paymob)' : '3. Secure Payments & Paymob Integration'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem]">
                {isAr
                  ? 'تتم جميع معاملات بطاقات الائتمان والدفع الرقمي عبر تكامل مباشر وآمن مع بوابة الدفع الوطنية Paymob. يتوافق معالج الدفع لدينا مع أعلى معايير أمان بيانات بطاقات الدفع (PCI-DSS). لا يملك طاقم دي-رايد أو خوادمها أي إمكانية للوصول إلى تفاصيل بطاقتك أو تخزينها؛ بل تتم معالجة المعاملة بالكامل وتشفيرها بواسطة نظام Paymob لحمايتك من أي محاولات احتيال.'
                  : 'All credit card transactions and digital payments are processed through a direct, secure integration with the national payment gateway Paymob. Our payment partner complies fully with Payment Card Industry Data Security Standards (PCI-DSS). D-Ride servers and staff do not access or store your full card details; the entire operation is encrypted and managed directly by Paymob to guard against any fraud.'
                }
              </p>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 4: Security Measures */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <Shield size={24} className="text-[var(--primary)]" />
                {isAr ? '4. تدابير حماية البيانات' : '4. Information Security Controls'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem]">
                {isAr
                  ? 'نحن نطبق مجموعة متنوعة من الإجراءات الأمنية والإدارية لضمان سلامة بياناتك الشخصية من الدخول غير المصرح به أو التعديل أو الإفشاء. يتم إرسال جميع المعلومات الحساسة عبر اتصال مشفر بالكامل بتقنية (SSL/TLS)، ويتم تقييد الوصول إلى البيانات الشخصية لركابنا إلا للموظفين المصرح لهم والذين يحتاجون إليها لتشغيل الخدمة.'
                  : 'We implement a robust suite of technical, administrative, and physical security measures designed to protect your personal data from unauthorized access, modification, or disclosure. All sensitive data transmission uses encrypted SSL/TLS layers, and access to passenger data is restricted strictly to authorized staff members who require it to run the service.'
                }
              </p>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 5: Your Rights */}
            <div>
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <EyeOff size={24} className="text-red-400" />
                {isAr ? '5. حقوقك والتحكم في بياناتك' : '5. Your Rights & Data Control'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem]">
                {isAr
                  ? 'لديك الحق الكامل في مراجعة بياناتك المسجلة لدينا، وتعديلها، أو طلب حذف حسابك وبياناتك الشخصية نهائياً من خوادمنا في أي وقت. يمكنك القيام بذلك عن طريق التواصل مع فريق خدمة العملاء لدينا وسنقوم بتلبية طلبك فوراً بما لا يتعارض مع القوانين والالتزامات التنظيمية السارية.'
                  : 'You hold full rights to view your registered profile, correct inaccuracies, or request the permanent deletion of your account and personal data from our servers. You may exercise this right at any time by contacting our support team, and we will fulfill your request promptly in compliance with applicable laws.'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support Section */}
        <div className="border-t border-[var(--border)] w-full pt-12 text-center">
          <h3 className="text-[var(--text-primary)] text-xl font-extrabold mb-4">
            {isAr ? 'تحديثات سياسة الخصوصية' : 'Updates to Our Policy'}
          </h3>
          <p className="text-[var(--text-secondary)] text-sm max-w-[600px] mx-auto">
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
