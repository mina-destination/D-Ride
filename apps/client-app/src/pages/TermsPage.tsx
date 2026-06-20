import { useTranslation } from '../context/LanguageContext';
import { FileText, Ban, Calendar, UserCheck, CreditCard } from 'lucide-react';
import SEO from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';

export default function TermsPage() {
  const { language } = useTranslation();
  const isAr = language === 'ar';

  const seoTitle = isAr ? 'الشروط والأحكام | دي-رايد' : 'Terms of Service | D-Ride';
  const seoDescription = isAr
    ? 'راجع الشروط والأحكام الخاصة بمنصة دي-رايد، التزامات الركاب، سياسات حجز المقاعد، وسياسة الإلغاء واسترداد الأموال.'
    : 'Review the D-Ride terms of service, passenger obligations, seating policies, and cancellation/refund policies.';

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
            {isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}
          </span>
          <h1 className="hero-title text-5xl mb-5 leading-tight">
            {isAr ? 'شروط ' : 'Terms of '}<span className="hero-title-accent">{isAr ? 'الخدمة' : 'Service'}</span>
          </h1>
          <p className="hero-subtitle text-lg max-w-[700px] mx-auto opacity-85">
            {isAr
              ? 'يرجى قراءة شروط الخدمة بعناية قبل استخدام منصة دي-رايد وحجز رحلاتك.'
              : 'Please read our terms of service carefully before using the D-Ride platform and booking your rides.'
            }
          </p>
        </div>

        {/* Main Content (Glass Card) */}
        <Card className={`w-full mb-12 bg-white/[0.03] backdrop-blur-xl border-white/10 rounded-2xl ${isAr ? 'text-right' : 'text-left'}`}>
          <CardContent className="p-10 md:p-12">
            {/* Section 1: Intro */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <FileText size={24} className="text-[var(--primary)]" />
                {isAr ? '1. قبول الشروط والأحكام' : '1. Acceptance of Terms'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem]">
                {isAr
                  ? 'باستخدامك لمنصة دي-رايد (الموقع الإلكتروني أو التطبيق)، فإنك توافق تماماً على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا يجب عليك استخدام منصتنا أو الاستفادة من الخدمات المقدمة من خلالها.'
                  : 'By using the D-Ride platform (website or app), you fully agree to be bound by these Terms and Conditions. If you do not agree to any part of these terms, you should not use our platform or the services provided through it.'
                }
              </p>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 2: Account & User Obligations */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <UserCheck size={24} className="text-blue-400" />
                {isAr ? '2. حساب المستخدم والتزامات الراكب' : '2. User Accounts & Passenger Obligations'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem] mb-4">
                {isAr
                  ? 'لكي تتمكن من حجز الرحلات، يجب عليك إنشاء حساب برقم هاتف مصري صالح. أنت مسؤول بشكل كامل عن سرية بيانات حسابك وأي نشاط يتم من خلاله. كما يلتزم الركاب بالقواعد التالية أثناء الرحلة:'
                  : 'To book rides, you must register an account with a valid Egyptian phone number. You are solely responsible for maintaining account confidentiality and all activities therein. Passengers are also obligated to adhere to the following rules during transit:'
                }
              </p>
              <ul className={`text-[var(--text-secondary)] leading-loose text-[0.95rem] list-inside ${isAr ? 'pr-6 pl-0' : 'pl-6 pr-0'}`}>
                <li>{isAr ? 'التواجد في محطة التجمع المحددة قبل موعد وصول الحافلة بـ 5 دقائق على الأقل.' : 'Be present at the designated assembly stop at least 5 minutes before the scheduled arrival time.'}</li>
                <li>{isAr ? 'إبراز رمز الاستجابة السريعة (QR Code) الرقمي الصالح للسائق عند الصعود للتحقق من التذكرة.' : 'Present your valid digital QR Code ticket to the driver upon boarding for confirmation.'}</li>
                <li>{isAr ? 'الالتزام بالسلوك اللائق وعدم إزعاج الركاب الآخرين أو تعريض سلامة الرحلة للخطر.' : 'Maintain respectful behavior, avoiding disturbance to other passengers or compromising trip safety.'}</li>
                <li>{isAr ? 'يُمنع منعاً باتاً التدخين أو تناول الأطعمة ذات الروائح النفاذة داخل الحافلات.' : 'Smoking and eating strong-smelling foods inside the vehicles is strictly prohibited.'}</li>
              </ul>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 3: Seating & Booking Holds */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <Calendar size={24} className="text-[var(--primary)]" />
                {isAr ? '3. قواعد حجز المقاعد وحجز التذاكر' : '3. Seating Rules & Booking Holds'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem] mb-4">
                {isAr
                  ? 'تعتمد دي-رايد نظام المقاعد المحجوزة مسبقاً لضمان عدم وجود تكدس وتوفير رحلة مريحة لكل الركاب. يرجى مراجعة القواعد التالية لتأكيد حجزك:'
                  : 'D-Ride uses a pre-booked seating model to avoid overcrowding and guarantee a comfortable ride for everyone. Please review the following booking policies:'
                }
              </p>
              <ul className={`text-[var(--text-secondary)] leading-loose text-[0.95rem] list-inside ${isAr ? 'pr-6 pl-0' : 'pl-6 pr-0'}`}>
                <li>{isAr ? 'تأكيد الحجز يتم فقط بعد إتمام عملية الدفع الرقمي عبر القنوات المتاحة بالمنصة.' : 'Booking confirmation is completed only after successful digital payment through available payment channels.'}</li>
                <li>{isAr ? 'عند اختيار مقعد في رحلة، يتم حجز المقعد مؤقتاً لمدة 10 دقائق لتمكينك من إتمام الدفع. في حال انتهاء المهلة دون دفع، يُلغى الحجز المؤقت تلقائياً ويصبح المقعد متاحاً لآخرين.' : 'When selecting a seat, a temporary hold is placed for 10 minutes to allow payment completion. If unpaid within this limit, the hold is auto-released and made available to others.'}</li>
                <li>{isAr ? 'كل تذكرة مخصصة لراكب واحد فقط وتحتوي على رمز استجابة فريد غير قابل للمشاركة أو إعادة الاستخدام.' : 'Each ticket is designated for a single passenger and contains a unique QR code that cannot be shared or reused.'}</li>
              </ul>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 4: Cancellation & Refund Policy */}
            <div className="mb-10">
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <Ban size={24} className="text-red-400" />
                {isAr ? '4. سياسة الإلغاء واسترداد الأموال' : '4. Cancellation & Refund Policy'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem] mb-4">
                {isAr
                  ? 'نحن نتفهم تغير خطط السفر، ولذلك نوفر سياسة مرنة لإلغاء حجز الحافلة واسترداد التذاكر وفقاً للضوابط التالية:'
                  : 'We understand that plans can change. We offer a flexible shuttle reservation cancellation policy under the following terms:'
                }
              </p>
              <ul className={`text-[var(--text-secondary)] leading-loose text-[0.95rem] list-inside ${isAr ? 'pr-6 pl-0' : 'pl-6 pr-0'}`}>
                <li>
                  <strong>{isAr ? 'الإلغاء قبل أكثر من ساعتين من موعد انطلاق الرحلة:' : 'Cancellations more than 2 hours before departure:'}</strong>{' '}
                  {isAr ? 'يتم استرداد كامل قيمة التذكرة إلى وسيلة الدفع الأصلية مع خصم رسوم إدارية بسيطة.' : 'Full ticket value is refunded to your original payment method minus a small administrative fee.'}
                </li>
                <li>
                  <strong>{isAr ? 'الإلغاء خلال ساعتين من موعد الرحلة أو عدم الحضور (No-Show):' : 'Cancellations within 2 hours of departure or No-Show:'}</strong>{' '}
                  {isAr ? 'لا يمكن استرداد قيمة التذكرة أو تعديل موعد الرحلة في حال إلغائها خلال أقل من ساعتين من موعد انطلاقها المحدد.' : 'Tickets are non-refundable and non-modifiable if cancelled less than 2 hours before the scheduled departure time.'}
                </li>
                <li>
                  <strong>{isAr ? 'في حال إلغاء الرحلة من طرف دي-رايد:' : 'If a trip is cancelled by D-Ride:'}</strong>{' '}
                  {isAr ? 'يتم إشعار الراكب فوراً ويُعاد كامل مبلغ التذكرة تلقائياً ودون أي خصومات إلى المحفظة أو وسيلة الدفع الأصلية.' : 'Passengers are notified immediately, and the full ticket price is auto-refunded to the original payment method without any deductions.'}
                </li>
              </ul>
            </div>

            <hr className="border-t border-[var(--border)] my-8" />

            {/* Section 5: Payment Security */}
            <div>
              <h2 className={`text-[var(--text-primary)] text-2xl font-extrabold mb-4 flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                <CreditCard size={24} className="text-emerald-400" />
                {isAr ? '5. أمن المعاملات والمدفوعات' : '5. Payment & Transaction Security'}
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-[0.95rem]">
                {isAr
                  ? 'تتم معالجة جميع المعاملات المالية وحركات بطاقات الائتمان بأمان كامل من خلال بوابة الدفع الإلكتروني الوطنية المعتمدة Paymob. لا تقوم دي-رايد بتخزين أي معلومات سرية خاصة ببطاقات الدفع الخاصة بك على خوادمها.'
                  : 'All financial transactions and credit card processes are handled securely through the certified national payment gateway, Paymob. D-Ride does not store any sensitive card information or bank credentials on its servers.'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support Section */}
        <div className="border-t border-[var(--border)] w-full pt-12 text-center">
          <h3 className="text-[var(--text-primary)] text-xl font-extrabold mb-4">
            {isAr ? 'لديك استفسار حول الشروط؟' : 'Have Questions About Our Terms?'}
          </h3>
          <p className="text-[var(--text-secondary)] text-sm max-w-[600px] mx-auto">
            {isAr
              ? 'فريق الدعم الفني لدينا متواجد على مدار الساعة لمساعدتك. يمكنك التواصل معنا مباشرة من خلال قنوات المساعدة بالمنصة.'
              : 'Our support team is available 24/7 to assist you. Get in touch with us through the customer service channel on the platform.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
