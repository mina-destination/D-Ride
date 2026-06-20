import { useTranslation } from '../context/LanguageContext';
import { Bus, ShieldCheck, Zap } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import SEO from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';

export default function AboutPage() {
  const { language } = useTranslation();
  const isAr = language === 'ar';

  const seoTitle = isAr ? 'من نحن | دي-رايد' : 'About Us | D-Ride';
  const seoDescription = isAr
    ? 'تعرف على قصة دي-رايد، المنصة الرائدة للنقل الجماعي الذكي في مصر التي تربط الإسكندرية، القاهرة، شرم الشيخ، دهب، نويبع وطابا بأسطول حديث ومريح.'
    : 'Learn about D-Ride, Egypt\'s smart transportation service connecting Alexandria, Cairo, Sharm, Dahab, Nuweiba, and Taba with premium passenger convenience.';

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
            {isAr ? 'من نحن' : 'Our Story'}
          </span>
          <h1 className="hero-title text-5xl mb-5 leading-tight">
            {isAr ? 'حول ' : 'About '}<span className="hero-title-accent">D-Ride</span>
          </h1>
          <p className="hero-subtitle text-lg max-w-[700px] mx-auto opacity-85">
            {isAr
              ? 'دي-رايد هي المنصة الرائدة للنقل الجماعي الذكي في مصر، نسعى لإعادة تعريف رحلتك اليومية بمستويات غير مسبوقة من الراحة والتكنولوجيا.'
              : 'D-Ride is Egypt\'s leading smart mass-transit platform, redefining daily commutes with modern tech, real-time telemetry, and premium comfort.'
            }
          </p>
        </div>

        {/* Mission Section (Glass Card) */}
        <Card className="w-full mb-12 bg-white/[0.03] backdrop-blur-xl border-white/10 rounded-2xl">
          <CardContent className={`p-10 ${isAr ? 'text-right' : 'text-left'}`}>
            <div className={`flex gap-6 ${isAr ? 'flex-row-reverse' : 'flex-row'} flex-wrap`}>
              <div className="flex-1 min-w-[280px] flex flex-col justify-center">
                <h2 className="text-[var(--text-primary)] text-3xl font-extrabold mb-4">
                  {isAr ? 'رسالتنا ورؤيتنا' : 'Our Mission & Vision'}
                </h2>
                <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem] mb-4">
                  {isAr
                    ? 'نسعى جاهدين لحل أزمة النقل اليومية في القاهرة الكبرى من خلال تقديم شبكة حافلات ذكية ومريحة وموثوقة بنسبة 100%. نجمع بين تكنولوجيا التتبع المباشر وحلول الدفع الرقمية الآمنة لنوفر لعملائنا تجربة نقل متكاملة وبأسعار معقولة.'
                    : 'We aim to ease the daily transport bottleneck in Greater Cairo by delivering a highly reliable, 100% scheduled minibus network. By integrating live telemetry, digital ticket passes, and secure payment solutions, we empower commuters with a stress-free and cost-efficient transit alternative.'
                  }
                </p>
                <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem] m-0">
                  {isAr
                    ? 'رؤيتنا هي أن نصبح الخيار الأول والذكي للنقل الجماعي في المدن الكبرى بالشرق الأوسط وأفريقيا، مع الحفاظ على البيئة وتقليل التكدس المروري.'
                    : 'Our vision is to become the premier smart transit provider across major metropolitan areas in the Middle East and Africa, advocating for environment-friendly commutes and reduced traffic congestion.'
                  }
                </p>
              </div>
              <div className="w-full max-w-[300px] mx-auto flex items-center justify-center rounded-xl overflow-hidden bg-[var(--primary)]/5 border border-[var(--border)] p-8">
                <img src={logo} alt="D-Ride Logo" className="max-w-full h-auto rounded-lg" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Core Values Grid */}
        <h2 className="section-title text-3xl mb-10">
          {isAr ? 'القيم الأساسية التي نؤمن بها' : 'Our Core Values'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full mb-16">
          {/* Comfort */}
          <Card className={`bg-white/[0.03] backdrop-blur-xl border-white/10 rounded-xl ${isAr ? 'text-right' : 'text-left'}`}>
            <CardContent className="p-8">
              <div className={`w-12 h-12 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-5 ${isAr ? 'ml-auto' : 'mr-auto'}`}>
                <Bus size={24} />
              </div>
              <h3 className="text-[var(--text-primary)] text-xl font-bold mb-2">
                {isAr ? 'أقصى درجات الراحة' : 'Premium Comfort'}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed m-0">
                {isAr
                  ? 'حافلاتنا حديثة ومكيفة، ومقاعدنا مصممة بعناية لتضمن لك رحلة مريحة وهادئة تتيح لك الاسترخاء أو إنجاز عملك أثناء الطريق.'
                  : 'All our minibuses are fully air-conditioned and cleaned daily, equipped with ergonomic seating, USB ports, and free WiFi.'
                }
              </p>
            </CardContent>
          </Card>

          {/* Technology */}
          <Card className={`bg-white/[0.03] backdrop-blur-xl border-white/10 rounded-xl ${isAr ? 'text-right' : 'text-left'}`}>
            <CardContent className="p-8">
              <div className={`w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5 ${isAr ? 'ml-auto' : 'mr-auto'}`}>
                <Zap size={24} />
              </div>
              <h3 className="text-[var(--text-primary)] text-xl font-bold mb-2">
                {isAr ? 'التكنولوجيا والسرعة' : 'Smart Technology'}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed m-0">
                {isAr
                  ? 'تتبع حافلتك مباشرة على الخريطة بفضل تقنيات تحديد المواقع المتقدمة، واحجز مقعدك واحصل على تذكرتك الرقمية بضغطة زر.'
                  : 'Track your shuttle in real-time, view live ETAs for every checkpoint, and book or cancel trips seamlessly within seconds.'
                }
              </p>
            </CardContent>
          </Card>

          {/* Safety */}
          <Card className={`bg-white/[0.03] backdrop-blur-xl border-white/10 rounded-xl ${isAr ? 'text-right' : 'text-left'}`}>
            <CardContent className="p-8">
              <div className={`w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 ${isAr ? 'ml-auto' : 'mr-auto'}`}>
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-[var(--text-primary)] text-xl font-bold mb-2">
                {isAr ? 'الأمان التام والاعتمادية' : 'Absolute Safety'}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed m-0">
                {isAr
                  ? 'سائقونا مدربون ومؤهلون بمستويات عالية، ونضمن الأمان الكامل بفضل المراقبة وتأكيد الحجز برمز الاستجابة السريعة عند الصعود.'
                  : 'Drivers undergo thorough background checks and training, and trips are secured via unique QR ticket check-ins.'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Operating Partners Callout */}
        <div className="border-t border-[var(--border)] w-full pt-12 text-center">
          <h3 className="text-[var(--text-primary)] text-xl font-extrabold mb-4">
            {isAr ? 'شراكات موثوقة لحمايتك' : 'Backed by Trusted Partnerships'}
          </h3>
          <p className="text-[var(--text-secondary)] text-sm max-w-[600px] mx-auto mb-6">
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
