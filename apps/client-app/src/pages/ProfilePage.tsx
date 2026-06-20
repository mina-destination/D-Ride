import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, ShieldCheck, LogOut, Award, Navigation, Leaf, Lock, Edit2 } from 'lucide-react';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export default function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'الملف الشخصي | دي-رايد' : 'My Profile | D-Ride';
  const seoDescription = isAr
    ? 'عرض وتحديث إعدادات ملفك الشخصي كراكب، وكلمة مرور الأمان، وإحصاءات توفير الكربون على دي-رايد.'
    : 'View and update your passenger profile settings, security password credentials, and carbon emission stats on D-Ride.';

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const handleStartEdit = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setSaveError('');
    setSaveSuccess('');
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaveLoading(true);
    try {
      await updateProfile({ name: editName, phone: editPhone });
      setSaveSuccess(isAr ? 'تم تحديث الملف الشخصي بنجاح!' : 'Profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err?.message || (isAr ? 'فشل تحديث الملف الشخصي.' : 'Failed to update profile.'));
    } finally {
      setSaveLoading(false);
    }
  };

  // Change Password States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordStep, setChangePasswordStep] = useState(1);
  const [changePasswordOtp, setChangePasswordOtp] = useState('');
  const [changePasswordNewPassword, setChangePasswordNewPassword] = useState('');
  const [changePasswordConfirmPassword, setChangePasswordConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  const handleChangePasswordRequest = async () => {
    setChangePasswordError('');
    setChangePasswordSuccess('');
    setChangePasswordLoading(true);
    try {
      await authAPI.changePasswordRequest();
      setChangePasswordSuccess('A verification OTP has been sent to your email.');
      setChangePasswordStep(2);
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Failed to dispatch verification OTP');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    if (changePasswordNewPassword !== changePasswordConfirmPassword) {
      setChangePasswordError('Passwords do not match');
      return;
    }

    setChangePasswordLoading(true);
    try {
      await authAPI.changePassword({
        otp: changePasswordOtp,
        newPassword: changePasswordNewPassword,
      });
      setChangePasswordSuccess('Password updated successfully!');
      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 2000);
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Failed to change password. Please check the OTP.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (!user?.name) return 'C';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="page-container min-h-[85vh] pb-12 relative">
      <SEO title={seoTitle} description={seoDescription} />
      
      {/* Dynamic background glows */}
      <div className="hero-bg-gradient absolute top-[-10%] right-[-5%] z-0" />
      <div className="hero-bg-gradient-2 absolute bottom-[-10%] left-[-5%] z-0" />

      <div className="contact-container max-w-[850px] w-full grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-10 items-start relative z-10 mx-auto px-6">
        
        {/* Left Card: Avatar & Brand Tag */}
        <Card className="p-6 bg-white/[0.02] border-border/60 flex flex-col items-center text-center gap-6">
          <div className="self-start">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-white/[0.03] border-border text-white hover:bg-white/5 rounded-full w-9 h-9 flex items-center justify-center"
              title="Go Back"
            >
              <ArrowLeft size={16} className={language === 'ar' ? 'rotate-180' : ''} />
            </Button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center text-3xl font-black shadow-[0_0_25px_rgba(245,183,49,0.45)] border-2 border-white/10">
              {getInitials()}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-2">
              {user?.name || 'Commuter'}
            </h2>
            <Badge className="bg-amber-500 text-black hover:bg-amber-500 font-bold px-3 py-1 text-[10px] tracking-wider uppercase">
              {user?.role || 'PASSENGER'}
            </Badge>
          </div>

          <div className="w-full border-t border-border/40 pt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-muted-foreground text-xs justify-center md:justify-start">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>{isAr ? 'حالة الحساب موثقة' : 'Verified Account Status'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground text-xs justify-center md:justify-start">
              <Calendar size={16} className="text-amber-500" />
              <span>{isAr ? 'عضو منذ مايو 2026' : 'Member Since May 2026'}</span>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full flex items-center justify-center gap-2 font-bold py-5 h-12 rounded-xl mt-4"
          >
            <LogOut size={16} />
            {t('signOut') || 'Sign Out'}
          </Button>
        </Card>

        {/* Right Card: Account Details & Ride Stats */}
        <div className="flex flex-col gap-6">
          {/* User Information */}
          <Card className="p-6 bg-white/[0.02] border-border/60">
            <CardHeader className="p-0 mb-5 flex flex-row justify-between items-center space-y-0">
              <CardTitle className="text-lg font-bold text-white">
                {isAr ? 'إعدادات الحساب' : 'Account Settings'}
              </CardTitle>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="text-amber-500 hover:text-amber-400 hover:bg-white/5 gap-1.5 h-8 font-bold"
                >
                  <Edit2 size={14} />
                  {isAr ? 'تعديل' : 'Edit'}
                </Button>
              )}
            </CardHeader>
            
            <CardContent className="p-0">
              {saveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold mb-4 text-center">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold mb-4 text-center">
                  {saveSuccess}
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-name" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAr ? 'الاسم الكامل' : 'Full Name'}
                    </Label>
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" />
                      <Input
                        id="edit-name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="pl-12 bg-transparent border-border focus-visible:ring-amber-500/20 text-white rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                    </Label>
                    <div className="bg-white/[0.01] border border-border/20 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground flex items-center gap-2.5 break-all cursor-not-allowed">
                      <Mail size={16} className="text-muted-foreground/60" />
                      <span>{user?.email || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-phone" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAr ? 'رقم الهاتف' : 'Phone Number'}
                    </Label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" />
                      <Input
                        id="edit-phone"
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        required
                        className="pl-12 bg-transparent border-border focus-visible:ring-amber-500/20 text-white rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-white/5 border-border text-white hover:bg-white/10 font-bold py-3 h-10 rounded-xl"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button
                      type="submit"
                      disabled={saveLoading}
                      className="flex-1 bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold py-3 h-10 rounded-xl"
                    >
                      {saveLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <Label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {isAr ? 'الاسم الكامل' : 'Full Name'}
                    </Label>
                    <div className="bg-white/[0.02] border border-border/40 rounded-xl px-4 py-3 text-sm font-semibold text-white flex items-center gap-2.5">
                      <User size={16} className="text-amber-500" />
                      <span>{user?.name || 'Commuter'}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                    </Label>
                    <div className="bg-white/[0.02] border border-border/40 rounded-xl px-4 py-3 text-sm font-semibold text-white flex items-center gap-2.5 break-all">
                      <Mail size={16} className="text-amber-500" />
                      <span>{user?.email || 'N/A'}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {isAr ? 'رقم الهاتف' : 'Phone Number'}
                    </Label>
                    <div className="bg-white/[0.02] border border-border/40 rounded-xl px-4 py-3 text-sm font-semibold text-white flex items-center gap-2.5">
                      <Phone size={16} className="text-amber-500" />
                      <span>{user?.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security & Password Card */}
          <Card className="p-6 bg-white/[0.02] border-border/60">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="text-lg font-bold text-white">
                {isAr ? 'الأمان وكلمة المرور' : 'Security & Password'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isAr
                  ? 'لضمان أمان حسابك، يتطلب دي-رايد التحقق من رمز OTP المكون من 6 أرقام المرسل إلى بريدك الإلكتروني المسجل قبل تحديث بيانات تسجيل الدخول الخاصة بك.'
                  : 'To ensure your account safety, D-Ride requires verifying a 6-digit OTP code sent to your registered email before updating your login credentials.'}
              </p>
              <Button
                onClick={() => {
                  setShowChangePasswordModal(true);
                  setChangePasswordStep(1);
                  setChangePasswordOtp('');
                  setChangePasswordNewPassword('');
                  setChangePasswordConfirmPassword('');
                  setChangePasswordError('');
                  setChangePasswordSuccess('');
                }}
                className="w-full bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold gap-2 py-5 h-12 rounded-xl"
                id="change-password-trigger"
              >
                <Lock size={16} />
                {isAr ? 'تغيير كلمة مرور الحساب' : 'Change Account Password'}
              </Button>
            </CardContent>
          </Card>

          {/* Loyalty & Impact stats */}
          <Card className="p-6 bg-white/[0.02] border-border/60 grid grid-cols-3 gap-4 items-center">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Navigation size={20} />
              </div>
              <span className="text-lg font-black text-white">12</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                {isAr ? 'الرحلات المحجوزة' : 'Rides Booked'}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Leaf size={20} />
              </div>
              <span className="text-lg font-black text-white">{isAr ? '٤.٨ كجم' : '4.8 kg'}</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                {isAr ? 'توفير CO₂' : 'CO₂ Saved'}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Award size={20} />
              </div>
              <span className="text-lg font-black text-white">{isAr ? 'ذهبي' : 'Gold'}</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                {isAr ? 'فئة الراكب' : 'Rider Tier'}
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10007] flex items-center justify-center p-6">
          <Card className="max-w-[420px] w-full p-8 bg-[#121224] text-white border border-white/10 shadow-2xl relative animate-none">
            <Button 
              onClick={() => setShowChangePasswordModal(false)}
              className="absolute top-4 right-4 bg-white/5 border-none text-muted-foreground hover:bg-white/10 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-bold transition-all duration-200"
            >
              ✕
            </Button>

            <CardHeader className="text-center p-0 mb-6 flex flex-col gap-2">
              <CardTitle className="text-xl font-bold text-amber-500">
                {isAr ? 'تغيير كلمة المرور' : 'Change Password'}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {changePasswordStep === 1 
                  ? (isAr ? 'طلب رمز OTP للأمان على بريدك الإلكتروني المسجل.' : 'Request a security verification OTP to your registered email.') 
                  : (isAr ? 'أدخل الرمز المكون من 6 أرقام وقم بتعيين كلمة المرور الجديدة.' : 'Enter the 6-digit verification code and configure your new password.')}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {changePasswordError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold mb-4 text-center">
                  {changePasswordError}
                </div>
              )}

              {changePasswordSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold mb-4 text-center">
                  {changePasswordSuccess}
                </div>
              )}

              {changePasswordStep === 1 ? (
                <div className="flex flex-col gap-4 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isAr ? 'سيتم إرسال رمز التحقق إلى:' : 'A verification code will be sent to:'} <strong className="text-amber-500">{user?.email}</strong>
                  </p>
                  <Button
                    onClick={handleChangePasswordRequest}
                    disabled={changePasswordLoading}
                    className="w-full bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold py-5 h-12 rounded-xl mt-2"
                    id="request-change-otp-btn"
                  >
                    {changePasswordLoading ? (isAr ? 'جاري الإرسال...' : 'Sending OTP...') : (isAr ? 'إرسال رمز التحقق' : 'Send Verification OTP')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleChangePasswordSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp-otp" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAr ? 'رمز التحقق (٦ أرقام)' : '6-Digit Code'}
                    </Label>
                    <Input
                      id="cp-otp"
                      type="text"
                      maxLength={6}
                      value={changePasswordOtp}
                      onChange={(e) => setChangePasswordOtp(e.target.value)}
                      placeholder="123456"
                      required
                      className="w-full bg-white/[0.03] border-white/10 focus-visible:ring-amber-500/20 text-center font-black text-amber-500 tracking-[6px] text-lg py-5 rounded-xl outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp-password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
                    </Label>
                    <Input
                      id="cp-password"
                      type="password"
                      value={changePasswordNewPassword}
                      onChange={(e) => setChangePasswordNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full bg-white/[0.03] border-white/10 focus-visible:ring-amber-500/20 text-white rounded-xl text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp-confirm-password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    </Label>
                    <Input
                      id="cp-confirm-password"
                      type="password"
                      value={changePasswordConfirmPassword}
                      onChange={(e) => setChangePasswordConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full bg-white/[0.03] border-white/10 focus-visible:ring-amber-500/20 text-white rounded-xl text-sm"
                    />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setChangePasswordStep(1)}
                      className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10 font-bold py-5 h-12 rounded-xl"
                    >
                      {isAr ? 'رجوع' : 'Back'}
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={changePasswordLoading}
                      className="flex-[2] bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold py-5 h-12 rounded-xl"
                      id="change-password-submit-btn"
                    >
                      {changePasswordLoading ? (isAr ? 'جاري التحديث...' : 'Updating...') : (isAr ? 'تحديث كلمة المرور' : 'Update Password')}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
