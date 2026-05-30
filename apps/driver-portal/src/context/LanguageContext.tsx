import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  isRtl: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // General / Layout
    brandName: 'D-Ride',
    driverCommandCenter: 'Driver Command Center',
    authorizedPersonnelOnly: 'Authorized transit personnel only',
    
    // Auth / Login
    signIn: 'Sign In',
    emailAddress: 'Email Address',
    password: 'Password',
    signInAsDriver: 'Sign In as Driver',
    authenticating: 'Authenticating...',
    authenticatingSession: 'Authenticating driver session...',
    pleaseFillAll: 'Please fill in all fields',
    loginFailed: 'Login failed. Please check your credentials.',
    emailPlaceholder: 'driver@dride.com',
    
    // Bottom Nav
    myShifts: 'My Shifts',
    activeMap: 'Active Map',
    profile: 'Profile',
    
    // My Trips (Shifts)
    helloDriver: 'Hello, {name}',
    cairoRegionFleet: 'Cairo Region Shuttle Fleet',
    refreshTrips: 'Refresh trips',
    signOut: 'Sign Out',
    currentActive: 'Current & Active',
    pastShifts: 'Past Shifts',
    loadingAssignments: 'Loading assignments...',
    noTripsFound: 'No trips found in this category.',
    refreshAssignments: 'Refresh Assignments',
    bookedCount: '{booked} / {available} booked',
    view: 'View',
    assignedRoute: 'Assigned Route',
    profileTitle: 'Driver Profile',
    licenseClass: 'License Class',
    assignedVehicle: 'Assigned Minibus',
    fleetRegion: 'Fleet Operations Region',
    languageSetting: 'Language Preferred',
    statsCapital: 'Shift Stats Summary',
    completedTripsCount: 'Completed Shifts',
    verifiedDriverStatus: 'Verified Captain',
    
    // Trip Detail
    tripDetails: 'Trip Details',
    loadingTripFiles: 'Loading trip files...',
    tripNotFound: 'Trip not found.',
    backToList: 'Back to List',
    openBoardingGate: 'Open Boarding Gate',
    startDriving: 'Start Driving',
    completeTripShift: 'Complete Trip Shift',
    openLiveMapNav: 'Open Live Map Navigation',
    shiftCompletedSuccess: '✓ Shift Completed Successfully',
    
    // Scanner
    qrScannerEngine: 'Ticket QR Scanner Engine',
    invalidQrStructure: 'Invalid QR Code structure.',
    passengerCheckedInSuccess: 'Passenger checked in successfully! ✅',
    verificationFailed: 'Verification failed. Invalid or expired ticket.',
    cameraPermissionDenied: 'Camera permission denied or not available.',
    closeCamera: 'Close Camera',
    scanTicketQr: 'Scan Ticket QR Code',
    boardingGateClosed: 'Boarding Gate Closed',
    
    // Passenger List
    passengerList: 'Passenger List ({count})',
    totalCheckInRequired: 'Total check-in required',
    noPassengersBooked: 'No passengers booked on this trip yet.',
    phoneLabel: 'Phone:',
    seatsAssigned: 'Seats assigned:',
    onBoard: 'ON BOARD',
    checkInBtn: 'Check In',
    
    // Live Map
    initializingMap: 'Initializing navigation map...',
    activeRouteLabel: 'Active Route',
    drivingRoute: 'Driving Route',
    gpsNotAvailable: 'Real GPS not available. Falling back to path simulator.',
    geoNotSupported: 'Geolocation not supported. Running simulator.',
    simulatedTelemetry: 'Simulated Telemetry Streaming',
    liveGpsBroadcast: 'Live GPS Broadcast Active',
    gpsStandby: 'GPS Telemetry Standby',
    stopBroadcasting: 'Stop Broadcasting GPS',
    startLiveGps: 'Start Live GPS Stream',
    confirmOpenBoarding: 'Open Boarding Gate?',
    confirmStartDriving: 'Start Driving & Transit?',
    confirmCompleteTrip: 'Complete Trip Shift?',
    confirm: 'Confirm',
    cancel: 'Cancel'
  },
  ar: {
    // General / Layout
    brandName: 'دي-رايد',
    driverCommandCenter: 'مركز التحكم للسائقين',
    authorizedPersonnelOnly: 'للموظفين المصرح لهم فقط',
    
    // Auth / Login
    signIn: 'تسجيل الدخول',
    emailAddress: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signInAsDriver: 'تسجيل الدخول كسائق',
    authenticating: 'جاري التحقق...',
    authenticatingSession: 'جاري التحقق من جلسة السائق...',
    pleaseFillAll: 'يرجى ملء جميع الحقول',
    loginFailed: 'فشل تسجيل الدخول. يرجى التحقق من بيانات الاعتماد.',
    emailPlaceholder: 'driver@dride.com',
    
    // Bottom Nav
    myShifts: 'وردياتي',
    activeMap: 'الخريطة النشطة',
    profile: 'الملف الشخصي',
    
    // My Trips (Shifts)
    helloDriver: 'مرحباً، {name}',
    cairoRegionFleet: 'أسطول حافلات منطقة القاهرة',
    refreshTrips: 'تحديث الرحلات',
    signOut: 'تسجيل الخروج',
    currentActive: 'النشطة والحالية',
    pastShifts: 'الورديات السابقة',
    loadingAssignments: 'جاري تحميل المهام...',
    noTripsFound: 'لم يتم العثور على رحلات في هذه الفئة.',
    refreshAssignments: 'تحديث المهام',
    bookedCount: 'تم حجز {booked} من أصل {available}',
    view: 'عرض',
    assignedRoute: 'المسار المعين',
    profileTitle: 'ملف السائق',
    licenseClass: 'رخصة القيادة',
    assignedVehicle: 'الحافلة المعينة',
    fleetRegion: 'منطقة عمليات الأسطول',
    languageSetting: 'اللغة المفضلة',
    statsCapital: 'إحصائيات الورديات',
    completedTripsCount: 'الرحلات المكتملة',
    verifiedDriverStatus: 'كابتن معتمد',
    
    // Trip Detail
    tripDetails: 'تفاصيل الرحلة',
    loadingTripFiles: 'جاري تحميل ملفات الرحلة...',
    tripNotFound: 'الرحلة غير موجودة.',
    backToList: 'العودة للقائمة',
    openBoardingGate: 'فتح بوابة الركوب',
    startDriving: 'بدء القيادة',
    completeTripShift: 'إكمال وردية الرحلة',
    openLiveMapNav: 'فتح نظام ملاحة الخريطة الحية',
    shiftCompletedSuccess: '✓ تم إكمال الوردية بنجاح',
    
    // Scanner
    qrScannerEngine: 'محرك مسح رمز QR للتذكرة',
    invalidQrStructure: 'هيكل رمز QR غير صالح.',
    passengerCheckedInSuccess: 'تم تسجيل دخول الراكب بنجاح! ✅',
    verificationFailed: 'فشل التحقق. تذكرة غير صالحة أو منتهية الصلاحية.',
    cameraPermissionDenied: 'تم رفض إذن الكاميرا أو أنها غير متوفرة.',
    closeCamera: 'إغلاق الكاميرا',
    scanTicketQr: 'مسح رمز QR للتذكرة',
    boardingGateClosed: 'بوابة الركوب مغلقة',
    
    // Passenger List
    passengerList: 'قائمة الركاب ({count})',
    totalCheckInRequired: 'مطلوب تسجيل الدخول بالكامل',
    noPassengersBooked: 'لا يوجد ركاب محجوزون في هذه الرحلة بعد.',
    phoneLabel: 'الهاتف:',
    seatsAssigned: 'المقاعد المخصصة:',
    onBoard: 'على متن الحافلة',
    checkInBtn: 'تسجيل دخول',
    
    // Live Map
    initializingMap: 'جاري تشغيل خريطة الملاحة...',
    activeRouteLabel: 'المسار النشط',
    drivingRoute: 'مسار القيادة',
    gpsNotAvailable: 'نظام تحديد المواقع (GPS) الحقيقي غير متوفر. يتم الرجوع إلى محاكي المسار.',
    geoNotSupported: 'تحديد الموقع الجغرافي غير مدعوم. تشغيل المحاكي.',
    simulatedTelemetry: 'بث القياسات البعادية المحاكي',
    liveGpsBroadcast: 'بث موقع GPS المباشر نشط',
    gpsStandby: 'نظام تحديد المواقع في وضع الاستعداد',
    stopBroadcasting: 'إيقاف بث موقع GPS',
    startLiveGps: 'بدء بث موقع GPS المباشر',
    confirmOpenBoarding: 'فتح بوابة ركوب الحافلة؟',
    confirmStartDriving: 'بدء القيادة والمسار؟',
    confirmCompleteTrip: 'إنهاء الوردية والرحلة؟',
    confirm: 'تأكيد',
    cancel: 'إلغاء'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('dride_driver_lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('dride_driver_lang', lang);
  };

  const isRtl = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRtl]);

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
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
