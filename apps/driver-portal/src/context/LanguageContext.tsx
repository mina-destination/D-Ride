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
    downloadDriverApp: 'D-Ride Driver Mobile App',
    downloadDriverAppDesc: 'Download the official APK for real-time background GPS tracking and instant QR ticket scanning.',
    downloadApkBtn: 'Download APK',
    
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
    dashboard: 'Dashboard',
    help: 'Help',
    
    // Unified Dashboard keys
    selectTripPrompt: 'Select a trip from above to start your workflow',
    offboardBtn: 'Offboard',
    offboarded: '✓ Offboarded',
    callPassenger: 'Call Passenger',
    emergencyContact: 'Emergency Hotline',
    supportContact: 'Fleet Support Contact',
    activeTrip: 'Active Trip',
    emergencyDesc: 'Call for immediate on-road assistance',
    supportDesc: 'Call fleet manager for schedule/booking support',
    
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
    gpsNotAvailable: 'Real GPS is not available. Please enable location services.',
    geoNotSupported: 'Geolocation is not supported on this device.',
    liveGpsBroadcast: 'Live GPS Broadcast Active',
    gpsStandby: 'GPS Telemetry Standby',
    stopBroadcasting: 'Stop Broadcasting GPS',
    startLiveGps: 'Start Live GPS Stream',
    confirmOpenBoarding: 'Open Boarding Gate?',
    confirmStartDriving: 'Start Driving & Transit?',
    confirmCompleteTrip: 'Complete Trip Shift?',
    confirm: 'Confirm',
    cancel: 'Cancel',
    
    // Workflow constraints
    tooFarFromCheckpoint: 'Too far. Please get within 200m to mark arrived (Current: {distance}m).',
    arrivePreviousFirst: 'Please arrive at previous stops in sequence first.',
    arriveStopFirst: 'Please mark this stop as arrived first.',
    dropOffRequired: 'Please drop off all boarded passengers before completing the trip.',
    checkpointsRequired: 'All checkpoints must be arrived at before completing the trip.',
    showNextTrips: 'Show Next Trips',
    hideNextTrips: 'Hide Next Trips',
    currentDistance: '{distance}m away',
    gpsRequired: 'Sharing location is required to confirm stop arrivals.',
    stopsTimeline: 'Stops & Route Timeline',
    passengersAtStop: 'Passengers at this Stop',
    noActionsAvailable: 'No actions available',
    upcomingShiftsTitle: 'Upcoming Shifts',
    allowBackgroundLocationTitle: 'Allow Background Location Tracking',
    allowBackgroundLocationDesc: 'To share your live route coordinates with commuters, guide them to your minibus, and keep tracking even if you close the screen or open another app, please grant "Allow all the time" location permission.',
    allowBackgroundLocationBtn: 'Allow Location & Share',
    newShiftsAssignedTitle: 'New Shifts Assigned 📅',
    newShiftsAssignedDesc: 'You have {count} new upcoming shifts assigned to you.',
    upcomingShiftsSummaryTitle: 'Upcoming Shifts Summary 🗓️',
    upcomingShiftsSummaryDesc: 'You have {count} upcoming shifts scheduled.',
    markAllRead: 'Mark all read',
    notificationsDrawerTitle: 'Notifications',
    noNotifications: 'All caught up! No notifications.',
    readyToSkipNoPassengers: 'Ready to skip / mark arrived (No passengers)'
  },
  ar: {
    // General / Layout
    brandName: 'دي-رايد',
    driverCommandCenter: 'مركز التحكم للسائقين',
    authorizedPersonnelOnly: 'للموظفين المصرح لهم فقط',
    downloadDriverApp: 'تطبيق سائق دي-رايد للهواتف',
    downloadDriverAppDesc: 'قم بتحميل تطبيق APK الرسمي لتتبع الموقع الجغرافي (GPS) في الخلفية ومسح تذاكر QR فورياً.',
    downloadApkBtn: 'تحميل تطبيق APK',
    
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
    dashboard: 'لوحة التحكم',
    help: 'المساعدة',
    
    // Unified Dashboard keys
    selectTripPrompt: 'اختر رحلة من الأعلى لبدء العمل عليها',
    offboardBtn: 'إنزال الراكب',
    offboarded: '✓ تم النزول',
    callPassenger: 'اتصال بالراكب',
    emergencyContact: 'الخط الساخن للطوارئ',
    supportContact: 'اتصال بدعم الأسطول',
    activeTrip: 'الرحلة النشطة',
    emergencyDesc: 'اتصل للحصول على مساعدة فورية على الطريق',
    supportDesc: 'اتصل بمدير الأسطول للحصول على دعم الجدول/الحجز',
    
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
    gpsNotAvailable: 'نظام تحديد المواقع (GPS) غير متوفر. يرجى تفعيل خدمات الموقع.',
    geoNotSupported: 'تحديد الموقع الجغرافي غير مدعوم على هذا الجهاز.',

    liveGpsBroadcast: 'بث موقع GPS المباشر نشط',
    gpsStandby: 'نظام تحديد المواقع في وضع الاستعداد',
    stopBroadcasting: 'إيقاف بث موقع GPS',
    startLiveGps: 'بدء بث موقع GPS المباشر',
    confirmOpenBoarding: 'فتح بوابة ركوب الحافلة؟',
    confirmStartDriving: 'بدء القيادة والمسار؟',
    confirmCompleteTrip: 'إنهاء الوردية والرحلة؟',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    
    // Workflow constraints
    tooFarFromCheckpoint: 'بعيد جداً. يرجى الاقتراب لمسافة أقل من ٢٠٠ متر لتأكيد الوصول (المسافة الحالية: {distance} متر).',
    arrivePreviousFirst: 'يرجى تأكيد الوصول للمحطات السابقة بالترتيب أولاً.',
    arriveStopFirst: 'يرجى تسجيل الوصول للمحطة أولاً.',
    dropOffRequired: 'يرجى إنزال جميع الركاب الموجودين بالحافلة أولاً قبل إنهاء الرحلة.',
    checkpointsRequired: 'يجب تأكيد الوصول لجميع محطات المسار قبل إنهاء الرحلة.',
    showNextTrips: 'عرض الرحلات التالية',
    hideNextTrips: 'إخفاء الرحلات التالية',
    currentDistance: 'على بعد {distance} متر',
    gpsRequired: 'مشاركة الموقع الجغرافي مطلوبة لتأكيد الوصول للمحطات.',
    stopsTimeline: 'جدول المحطات والمسار',
    passengersAtStop: 'الركاب في هذه المحطة',
    noActionsAvailable: 'لا توجد إجراءات متاحة',
    upcomingShiftsTitle: 'الورديات القادمة',
    allowBackgroundLocationTitle: 'السماح بتتبع الموقع في الخلفية',
    allowBackgroundLocationDesc: 'لمشاركة إحداثيات موقعك الجغرافي المباشر مع الركاب وإرشادهم إلى حافلتك، واستمرار التتبع حتى لو قمت بإغلاق الشاشة أو فتحت تطبيقاً آخر، يرجى اختيار إذن الموقع "السماح طوال الوقت".',
    allowBackgroundLocationBtn: 'السماح بمشاركة الموقع الجغرافي',
    newShiftsAssignedTitle: 'ورديات جديدة مخصصة 📅',
    newShiftsAssignedDesc: 'لديك {count} ورديات جديدة قادمة مخصصة لك.',
    upcomingShiftsSummaryTitle: 'ملخص الورديات القادمة 🗓️',
    upcomingShiftsSummaryDesc: 'لديك {count} وردية عمل قادمة مجدولة.',
    markAllRead: 'تحديد الكل كمقروء',
    notificationsDrawerTitle: 'الإشعارات',
    noNotifications: 'لا توجد إشعارات جديدة.',
    readyToSkipNoPassengers: 'جاهز للتخطي أو تأكيد الوصول (لا يوجد ركاب)'
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
