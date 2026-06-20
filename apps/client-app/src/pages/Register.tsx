import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import logo from '../assets/d-ride-logo.jpeg';
import { UserPlus, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function RegisterPage() {
  const { t, language } = useTranslation();
  const { register, loginWithGoogle } = useAuth();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'إنشاء حساب جديد | دي-رايد' : 'Create Account | D-Ride';
  const seoDescription = isAr
    ? 'انضم إلى دي-رايد لحجز حافلات نقل مريحة ومكيفة تربط القاهرة، الإسكندرية، شرم الشيخ، دهب، نويبع، وطابا.'
    : 'Join D-Ride to book premium minibuses connecting Cairo, Alexandria, Sharm El Sheikh, Dahab, Nuweiba, and Taba.';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Google Chooser States
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [isGoogleHovered, setIsGoogleHovered] = useState(false);

  // Real Google Sign-In setup
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const isGoogleConfigured = clientId && clientId !== 'your_google_client_id_here';

    if (!isGoogleConfigured) return;

    const handleCredentialResponse = async (response: any) => {
      setGoogleLoading(true);
      setError('');
      try {
        const credential = response.credential;
        const payload = decodeJwt(credential);
        const email = payload?.email || '';
        const name = payload?.name || 'Google User';

        await loginWithGoogle({ email, name, googleId: credential });
        navigate(redirectTo);
      } catch (err: any) {
        setError(err?.message || 'Google Sign-In failed');
      } finally {
        setGoogleLoading(false);
      }
    };

    const initializeGoogle = () => {
      try {
        if (!(window as any).__google_gsi_initialized) {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
          });
          (window as any).__google_gsi_initialized = true;
        }

        const btnContainer = document.getElementById('google-signin-btn');
        if (btnContainer) {
          btnContainer.innerHTML = ''; // prevent duplicate buttons
          (window as any).google.accounts.id.renderButton(
            btnContainer,
            { 
              theme: 'outline', 
              size: 'large', 
              text: 'continue_with', 
              shape: 'rectangular',
              width: btnContainer.clientWidth || 340
            }
          );
        }
      } catch (err) {
        console.error('Failed to initialize Google Sign-In:', err);
      }
    };

    if ((window as any).google?.accounts?.id) {
      initializeGoogle();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          initializeGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loginWithGoogle, navigate]);

  const handleOpenGoogleChooser = () => {
    setShowGoogleChooser(true);
    setShowCustomForm(false);
    setCustomName('');
    setCustomEmail('');
  };

  const handleCloseGoogleChooser = () => {
    setShowGoogleChooser(false);
  };

  const handleSelectGoogleAccount = async (gmail: string, name: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      // Simulate Google API token exchange latency
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockGoogleId = 'g-' + Math.random().toString(36).substring(2, 12);
      await loginWithGoogle({ email: gmail, name, googleId: mockGoogleId });
      setShowGoogleChooser(false);
      navigate(redirectTo);
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed');
      setShowGoogleChooser(false);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customName) return;
    handleSelectGoogleAccount(customEmail, customName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Egyptian phone validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setError(t('phoneMustBe11'));
      return;
    }
    const normalizedPhone = '+20' + cleanPhone.substring(1);

    // Password complexity check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}[\]|\\:;"'<>,.?/-]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError(
        isAr
          ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وتتضمن حرفًا كبيرًا وحرفًا صغيرًا ورقمًا ورمزًا خاصًا.'
          : 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      );
      return;
    }

    setLoading(true);
    try {
      await register({ name, email, phone: normalizedPhone, password });
      navigate(redirectTo);
    } catch (err: any) {
      setError(err?.message || t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <SEO title={seoTitle} description={seoDescription} />
      <Card className="w-full max-w-[440px] p-6 glass border-amber-500/20 backdrop-blur-2xl transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_12px_40px_rgba(245,183,49,0.1)] relative z-10">
        <CardHeader className="auth-header text-center flex flex-col items-center p-0 mb-6">
          <img src={logo} alt="D-Ride" className="auth-logo h-16 w-auto mb-4 rounded-xl shadow-[0_0_30px_var(--glow-amber)] transition-transform duration-300 hover:scale-108" />
          <CardTitle className="auth-title text-2xl font-extrabold tracking-tight text-white">{t('registerTitle')}</CardTitle>
          <CardDescription className="auth-subtitle text-sm text-muted-foreground mt-1">{t('registerSubtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {error && <div className="auth-error mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form flex flex-col gap-4">
            <div className="auth-field flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('registerNameLabel')}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('registerNamePlaceholder')}
                required
                className="bg-transparent border-border focus-visible:ring-amber-500/20"
              />
            </div>
            <div className="auth-field flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('loginEmailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('loginEmailPlaceholder')}
                required
                className="bg-transparent border-border focus-visible:ring-amber-500/20"
              />
            </div>
            <div className="auth-field flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('registerPhoneLabel')}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('registerPhonePlaceholder')}
                required
                className="bg-transparent border-border focus-visible:ring-amber-500/20"
              />
            </div>
            <div className="auth-field flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('loginPasswordLabel')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('loginPasswordPlaceholder')}
                required
                minLength={8}
                className="bg-transparent border-border focus-visible:ring-amber-500/20"
              />
              {password.length > 0 && (
                <div className="password-complexity-feedback mt-1.5 text-[0.78rem] flex flex-col gap-1.5 p-3 bg-white/[0.02] border border-border rounded-xl">
                  <div className="flex items-center gap-1.5" style={{ color: password.length >= 8 ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{password.length >= 8 ? '✓' : '○'}</span>
                    <span>{isAr ? '8 أحرف على الأقل' : 'At least 8 characters'}</span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: /[A-Z]/.test(password) ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span>
                    <span>{isAr ? 'حرف كبير واحد على الأقل (A-Z)' : 'At least one uppercase letter (A-Z)'}</span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: /[a-z]/.test(password) ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{/[a-z]/.test(password) ? '✓' : '○'}</span>
                    <span>{isAr ? 'حرف صغير واحد على الأقل (a-z)' : 'At least one lowercase letter (a-z)'}</span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: /\d/.test(password) ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{/\d/.test(password) ? '✓' : '○'}</span>
                    <span>{isAr ? 'رقم واحد على الأقل (0-9)' : 'At least one number (0-9)'}</span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: /[!@#$%^&*()_+={}[\]|\\:;"'<>,.?/-]/.test(password) ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{/[!@#$%^&*()_+={}[\]|\\:;"'<>,.?/-]/.test(password) ? '✓' : '○'}</span>
                    <span>{isAr ? 'رمز خاص واحد على الأقل (مثل @، #، $)' : 'At least one special character (e.g. @, #, $)'}</span>
                  </div>
                </div>
              )}
            </div>
            
            <Button type="submit" className="w-full bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold gap-2 py-5 mt-2" disabled={loading} id="register-submit-btn">
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  {t('registering')}
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  {t('registerBtn')}
                </>
              )}
            </Button>
          </form>

          {/* Divider OR */}
          <div className="flex items-center my-6 w-full">
            <div className="flex-1 h-[1px] bg-border" />
            <span className="mx-3 text-[11px] text-muted-foreground font-bold uppercase tracking-wider">OR</span>
            <div className="flex-1 h-[1px] bg-border" />
          </div>

          {/* Google G-Button */}
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && 
           import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your_google_client_id_here' ? (
            <div 
              onMouseEnter={() => setIsGoogleHovered(true)}
              onMouseLeave={() => setIsGoogleHovered(false)}
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: '44px', 
                marginTop: '0.5rem' 
              }}
            >
              {/* Custom Styled Google Button */}
              <button
                type="button"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  background: isGoogleHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                  border: isGoogleHovered ? '1px solid #f5b731' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  pointerEvents: 'none',
                  transition: 'all 0.2s ease',
                  transform: isGoogleHovered ? 'translateY(-1px)' : 'none',
                  boxShadow: isGoogleHovered ? '0 4px 12px rgba(245, 183, 49, 0.15)' : 'none'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.85 2.69-6.57z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.91-2.24c-.8.54-1.84.87-3.05.87-2.34 0-4.33-1.58-5.03-3.7H.95v2.3C2.43 15.89 5.48 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V5H.95C.34 6.2.0 7.56.0 9s.34 2.8.95 4H3.97z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.02C13.46.59 11.43 0 9 0 5.48 0 2.43 2.11.95 5.1L3.97 7.4c.7-2.12 2.69-3.7 5.03-3.7z"/>
                </svg>
                <span>{isAr ? 'المواصلة باستخدام Google' : 'Continue with Google'}</span>
              </button>

              {/* Invisible Real Google SDK Overlay */}
              <div 
                id="google-signin-btn" 
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0.01,
                  cursor: 'pointer',
                  zIndex: 10,
                  overflow: 'hidden',
                  borderRadius: '12px'
                }}
              />
            </div>
          ) : (
            <button 
              type="button" 
              onClick={handleOpenGoogleChooser}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                width: '100%',
                padding: '0.75rem',
                background: isGoogleHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                border: isGoogleHovered ? '1px solid #f5b731' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isGoogleHovered ? 'translateY(-1px)' : 'none',
                boxShadow: isGoogleHovered ? '0 4px 12px rgba(245, 183, 49, 0.15)' : 'none'
              }}
              onMouseEnter={() => setIsGoogleHovered(true)}
              onMouseLeave={() => setIsGoogleHovered(false)}
            >
              <svg width="20" height="20" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.85 2.69-6.57z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.91-2.24c-.8.54-1.84.87-3.05.87-2.34 0-4.33-1.58-5.03-3.7H.95v2.3C2.43 15.89 5.48 18 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V5H.95C.34 6.2.0 7.56.0 9s.34 2.8.95 4H3.97z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.02C13.46.59 11.43 0 9 0 5.48 0 2.43 2.11.95 5.1L3.97 7.4c.7-2.12 2.69-3.7 5.03-3.7z"/>
              </svg>
              <span>{isAr ? 'المواصلة باستخدام Google' : 'Continue with Google'}</span>
            </button>
          )}

          <div className="auth-switch mt-6 text-center text-sm">
            {t('alreadyHaveAccount')} <Link to="/login" className="text-[#f5b731] hover:underline font-semibold">{t('signInNow')}</Link>
          </div>
        </CardContent>
      </Card>

      {/* Simulated Google Accounts Chooser Overlay */}
      {showGoogleChooser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10007] flex items-center justify-center p-6">
          <Card className="max-w-[420px] w-full p-8 bg-[#121224] text-white border border-white/10 shadow-2xl relative animate-none">
            <Button 
              onClick={handleCloseGoogleChooser}
              className="absolute top-4 right-4 bg-white/5 border-none text-muted-foreground hover:bg-white/10 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center text-xs font-bold transition-all duration-200"
            >
              ✕
            </Button>

            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <svg width="40" height="40" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Choose an account</h2>
              <p className="text-xs text-muted-foreground">to continue to <strong className="text-amber-500">D-Ride Commuter</strong></p>
            </div>

            {googleLoading ? (
              <div className="text-center py-8">
                <div className="w-9 h-9 border-3 border-white/15 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs text-muted-foreground font-semibold">Securing single sign-on connection...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {!showCustomForm ? (
                  <>
                    {[
                      { name: 'Ahmed Hassan', email: 'ahmed@gmail.com', avatar: 'AH' },
                      { name: 'Omar Khaled', email: 'omar.khaled@gmail.com', avatar: 'OK' }
                    ].map((acc) => (
                      <button
                        key={acc.email}
                        onClick={() => handleSelectGoogleAccount(acc.email, acc.name)}
                        className="flex items-center gap-3 w-full p-3.5 bg-white/[0.01] border border-border/40 hover:bg-white/[0.03] transition-colors rounded-xl text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#4285F4] text-white flex items-center justify-center font-bold text-xs">
                          {acc.avatar}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{acc.name}</span>
                          <span className="text-[10px] text-muted-foreground">{acc.email}</span>
                        </div>
                      </button>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCustomForm(true)}
                      className="w-full bg-transparent border-dashed border-border text-muted-foreground hover:text-white hover:bg-white/5 font-bold h-11 rounded-xl mt-1"
                    >
                      Use another account
                    </Button>
                  </>
                ) : (
                  <form onSubmit={handleCustomGoogleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5 text-left">
                      <Label htmlFor="custom-google-name" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Google Name</Label>
                      <Input
                        id="custom-google-name"
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Ahmed Hassan"
                        required
                        className="w-full bg-white/[0.03] border-white/10 focus-visible:ring-amber-500/20 text-white rounded-xl text-sm"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5 text-left">
                      <Label htmlFor="custom-google-email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Google Email Address</Label>
                      <Input
                        id="custom-google-email"
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        required
                        className="w-full bg-white/[0.03] border-white/10 focus-visible:ring-amber-500/20 text-white rounded-xl text-sm"
                      />
                    </div>

                    <div className="flex gap-3 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCustomForm(false)}
                        className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10 font-bold py-3 h-10 rounded-xl"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-[2] bg-[#f5b731] text-black hover:bg-[#f5b731]/80 font-bold py-3 h-10 rounded-xl"
                      >
                        Verify & Continue
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
            
            <div className="border-t border-white/10 mt-6 pt-4 text-[10px] text-muted-foreground text-center leading-normal">
              To continue, Google will share your name, email address, and profile picture with D-Ride.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
