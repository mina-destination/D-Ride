import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    searchRides: 'Search Rides',
    myTrips: 'My Trips',
    myWallet: 'My Wallet',
    walletBalanceLabel: 'Prepaid Wallet Balance',
    topUpBtn: 'Top Up Wallet',
    transactionHistory: 'Transaction History',
    profile: 'Profile',
    logout: 'Logout',
    brandName: 'D-Ride',
    howItWorks: 'How It Works',
    features: 'Features',
    routes: 'Routes',
    contactUs: 'Contact Us',
    signIn: 'Sign In',
    getStarted: 'Get Started',
    signOut: 'Sign Out',

    // Search Page
    whereTo: 'Where are we going today?',
    pickupPlaceholder: 'Search pickup stop (e.g. Maadi)...',
    dropoffPlaceholder: 'Search dropoff stop (e.g. Smart Village)...',
    findRides: 'Find Available Minibuses',
    routePath: 'Route path',
    departureTime: 'Departure Time',
    price: 'Price',
    bookSeat: 'Choose Seats & Checkout',
    noRides: 'No available rides found for this route.',

    // Seat / Checkout Page
    seatSelectionTitle: 'Toyota HiAce Seat Selection',
    fleetDesc: 'Cairo Commuter Minibus Fleet (14-Seater)',
    bookingSummary: 'Booking Summary',
    routeLabel: 'Route',
    departureLabel: 'Departure',
    boardingCp: 'Boarding Checkpoint 📍',
    boardingCpDesc: "Choose where the driver should pick you up. We've highlighted the closest checkpoint to you.",
    selectedPickup: 'Selected Pickup',
    selectSeats: 'Select Your Seats',
    availableLegend: 'Available',
    selectedLegend: 'Selected',
    occupiedLegend: 'Occupied',
    luggageLegend: 'Luggage Hold',
    selectedSlots: 'Selected Slots',
    paymentMethod: 'Payment Method 💳',
    cardPayment: '💳 Card',
    walletPayment: '📱 Wallet',
    cashPayment: '💵 Cash',
    walletInputLabel: 'Mobile Wallet Number (Vodafone, Orange, Etisalat Cash)',
    walletInputPlaceholder: 'e.g. 01012345678',
    walletInputDesc: 'Standard 11-digit Egyptian mobile number.',
    cashDesc: '🤝 Cash on Board: Pay directly to the minibus driver during boarding. Ticket confirmation is instant.',
    totalFare: 'Total Fare',
    processingPay: 'Processing Securely...',
    confirmCash: 'Confirm Booking (Cash)',
    payViaPaymob: 'Pay {amount} EGP via Paymob',
    securedPay: 'Secured via Paymob Egypt. Cards, Wallets, and Cash on Board supported.',

    // My Trips Page
    yourCommuteBadge: 'Your Commute',
    myBookingsTitle: 'My Bookings & Boarding Passes',
    myBookingsSub: 'Scan mock tickets or track your driver live on Egypt\'s premier mass-transit network.',
    noTickets: 'No Tickets Found',
    startBooking: 'Once you book your first ride, your boarding pass will appear here. Start by searching for a route.',
    dateLabel: 'Date',
    departureLabelShort: 'Departure',
    seatLabelShort: 'Seat',
    fareLabelShort: 'Fare',
    boardingCPShort: 'Boarding CP',
    scanQrHelper: 'Scan Ticket QR at Boarding',
    passId: 'PASS ID',
    optionsBtn: 'Options',
    telemetryTitle: 'Ride Telemetry & Dossier',
    secureSystem: 'SECURE SYSTEM',
    driverLabel: 'Driver',
    vehicleLabel: 'Vehicle',
    statusLabel: 'Status',
    trackLive: 'Track Live 📍',
    cancelSeat: 'Cancel Seat',
    payNow: 'Pay Now',
    backBtn: 'Back',
    boardingPassQrTitle: 'Boarding Pass QR 🎫',
    boardingPassQrDesc: 'Present this QR code to the D-Ride driver upon boarding the minibus.',
    ticketId: 'Ticket ID',
    verificationStatus: 'Verification Status',
    statusBoarded: 'Boarded & Checked In ✅',
    statusReady: 'Ready to Board 🕒',
  },
  ar: {
    // Navigation
    searchRides: 'البحث عن رحلات',
    myTrips: 'رحلاتي',
    myWallet: 'محفظتي',
    walletBalanceLabel: 'رصيد المحفظة مسبقة الدفع',
    topUpBtn: 'شحن المحفظة',
    transactionHistory: 'سجل المعاملات',
    profile: 'الملف الشخصي',
    logout: 'تسجيل الخروج',
    brandName: 'دي-رايد',
    howItWorks: 'كيف نعمل',
    features: 'المميزات',
    routes: 'المسارات',
    contactUs: 'اتصل بنا',
    signIn: 'تسجيل الدخول',
    getStarted: 'ابدأ الآن',
    signOut: 'تسجيل الخروج',

    // Search Page
    whereTo: 'إلى أين نحن ذاهبون اليوم؟',
    pickupPlaceholder: 'ابحث عن محطة الركوب (مثال: المعادي)...',
    dropoffPlaceholder: 'ابحث عن محطة النزول (مثال: القرية الذكية)...',
    findRides: 'البحث عن حافلات متوفرة',
    routePath: 'مسار الرحلة',
    departureTime: 'وقت المغادرة',
    price: 'السعر',
    bookSeat: 'اختر المقاعد والدفع',
    noRides: 'لم يتم العثور على رحلات متاحة لهذا المسار.',

    // Seat / Checkout Page
    seatSelectionTitle: 'حجز مقاعد تويوتا هايس',
    fleetDesc: 'أسطول حافلات القاهرة للركاب (١٤ مقعداً)',
    bookingSummary: 'ملخص الحجز',
    routeLabel: 'المسار',
    departureLabel: 'المغادرة',
    boardingCp: 'نقطة الركوب 📍',
    boardingCpDesc: 'اختر المكان الذي يجب أن يقلك السائق منه. لقد حددنا أقرب نقطة لك.',
    selectedPickup: 'نقطة الركوب المختارة',
    selectSeats: 'اختر مقاعدك',
    availableLegend: 'متاح',
    selectedLegend: 'محدد',
    occupiedLegend: 'محجوز',
    luggageLegend: 'مكان الحقائب',
    selectedSlots: 'المقاعد المحددة',
    paymentMethod: 'طريقة الدفع 💳',
    cardPayment: '💳 بطاقة',
    walletPayment: '📱 محفظة هاتف',
    cashPayment: '💵 نقداً',
    walletInputLabel: 'رقم محفظة الهاتف (فودافون، أورنج، اتصالات كاش)',
    walletInputPlaceholder: 'مثال: 01012345678',
    walletInputDesc: 'رقم هاتف محمول مصري مكون من ١١ رقماً.',
    cashDesc: '🤝 الدفع نقداً: ادفع مباشرة لسائق الحافلة عند الركوب. تأكيد التذكرة فوري.',
    totalFare: 'إجمالي الأجرة',
    processingPay: 'جاري المعالجة بأمان...',
    confirmCash: 'تأكيد الحجز (نقداً)',
    payViaPaymob: 'ادفع {amount} ج.م عبر بيموب',
    securedPay: 'مؤمن بواسطة بيموب مصر. نقبل البطاقات، محافظ الهاتف، والدفع نقداً عند الركوب.',

    // My Trips Page
    yourCommuteBadge: 'رحلاتك اليومية',
    myBookingsTitle: 'حجوزاتي وتذاكر الركوب',
    myBookingsSub: 'امسح التذاكر التجريبية أو تتبع السائق مباشرة على شبكة النقل الرائدة في مصر.',
    noTickets: 'لا توجد تذاكر حالياً',
    startBooking: 'بمجرد حجز رحلتك الأولى، ستظهر تذكرة الركوب الخاصة بك هنا. ابدأ بالبحث عن مسار.',
    dateLabel: 'التاريخ',
    departureLabelShort: 'المغادرة',
    seatLabelShort: 'المقعد',
    fareLabelShort: 'الأجرة',
    boardingCPShort: 'نقطة الركوب',
    scanQrHelper: 'امسح رمز QR عند الركوب',
    passId: 'رقم التذكرة',
    optionsBtn: 'خيارات',
    telemetryTitle: 'معلومات وتفاصيل الرحلة',
    secureSystem: 'نظام آمن',
    driverLabel: 'السائق',
    vehicleLabel: 'الحافلة',
    statusLabel: 'الحالة',
    trackLive: 'تتبع السائق مباشرة 📍',
    cancelSeat: 'إلغاء المقعد',
    payNow: 'ادفع الآن',
    backBtn: 'رجوع',
    boardingPassQrTitle: 'رمز تذكرة الركوب 🎫',
    boardingPassQrDesc: 'يرجى تقديم رمز QR هذا لسائق دي-رايد عند ركوب الحافلة.',
    ticketId: 'رقم التذكرة',
    verificationStatus: 'حالة التحقق',
    statusBoarded: 'تم صعود الحافلة والتحقق ✅',
    statusReady: 'جاهز للصعود 🕒',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('dride_lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('dride_lang', lang);
  };

  const isRtl = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRtl]);

  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
