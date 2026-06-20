import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supportAPI, settingsAPI } from '../services/api';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

export default function ContactPage() {
  const { user } = useAuth();
  const { t, language } = useTranslation();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'اتصل بنا | دي-رايد' : 'Contact Support | D-Ride';
  const seoDescription = isAr
    ? 'اتصل بخدمة عملاء دي-رايد وسجل تذكرة دعم لحل أي مشكلة في الحجز أو الدفع لرحلتك.'
    : 'Get in touch with the D-Ride support team. Submit a support ticket for help with tickets, payments, or routes.';

  // Load support info dynamically from settings saved in LocalStorage, with fallback defaults
  const [supportInfo, setSupportInfo] = useState({
    email: 'support@dride.com',
    phone: '+20 100 123 4567'
  });

  useEffect(() => {
    const fetchLatestSettings = async () => {
      try {
        const settings = await settingsAPI.get();
        if (settings) {
          setSupportInfo({
            email: settings.supportEmail || 'support@dride.com',
            phone: settings.supportPhone || '+20 100 123 4567'
          });
          localStorage.setItem('dride_settings', JSON.stringify(settings));
        }
      } catch (err) {
        console.warn('Backend settings query failed, trying localStorage fallback...', err);
        const savedSettings = localStorage.getItem('dride_settings');
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            setSupportInfo({
              email: parsed.supportEmail || 'support@dride.com',
              phone: parsed.supportPhone || '+20 100 123 4567'
            });
          } catch (e) {
            console.error('Error parsing settings from localStorage fallback', e);
          }
        }
      }
    };

    fetchLatestSettings();
  }, []);

  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await supportAPI.submitTicket({ subject, message: messageText });
      setSuccess(true);
      setSubject('');
      setMessageText('');
    } catch (err: any) {
      setError(err?.message || t('contactFailedSubmit'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <SEO title={seoTitle} description={seoDescription} />
      {/* Floating neon background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div className="max-w-[1000px] w-full grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-12 items-start contact-container">

        {/* Left: Contact Info Panel */}
        <div className="flex flex-col gap-8">
          <div>
            <span className="hero-badge">
              <span className="hero-badge-dot" />
              {t('contactSupportHelpDeskBadge')}
            </span>
            <h1 className="hero-title text-[2.5rem] mb-4 leading-tight">
              {t('contactGetInTouch')}
            </h1>
            <p className="hero-subtitle text-base mb-0 opacity-85">
              {t('contactSubtitle')}
            </p>
          </div>

          <Card className="bg-[var(--surface-elevated)]/80 backdrop-blur-xl border-white/10">
            <CardContent className="p-6 flex flex-col gap-6">
              <div className="flex gap-5 items-center">
                <div className="feature-icon shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{t('contactEmailSupport')}</div>
                  <a href={`mailto:${supportInfo.email}`} className="text-base font-bold text-[var(--primary)]">
                    {supportInfo.email}
                  </a>
                </div>
              </div>

              <div className="flex gap-5 items-center">
                <div className="feature-icon shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{t('contactPhoneHotline')}</div>
                  <a href={`tel:${supportInfo.phone}`} className="text-base font-bold text-[var(--primary)]">
                    {supportInfo.phone}
                  </a>
                </div>
              </div>

              <div className="flex gap-5 items-center">
                <div className="feature-icon shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{t('contactHqLocation')}</div>
                  <div className="text-base font-semibold text-[var(--text-primary)]">
                    {t('contactHqLocationVal')}
                  </div>
                </div>
              </div>

              <div className="flex gap-5 items-center">
                <div className="feature-icon shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{t('contactWorkingHours')}</div>
                  <div className="text-base font-semibold text-[var(--text-primary)]">
                    {t('contactWorkingHoursVal')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Submission Form */}
        <Card className="bg-[#121224]/80 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardContent className="p-8">
            {success ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center bg-emerald-500/10 text-emerald-400 p-4 rounded-full mb-6">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-extrabold mb-2 text-[var(--text-primary)]">{t('contactTicketSubmitted')}</h2>
                <p className="text-[var(--text-secondary)] mb-8 text-sm">
                  {t('contactTicketSuccessDesc')}
                </p>
                <Button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold"
                >
                  {t('contactSubmitAnother')}
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">{t('contactOpenSupportTicket')}</h2>
                  <p className="text-[var(--text-secondary)] text-sm">{t('contactDetailIssue')}</p>
                </div>

                {error && <div className="auth-error mb-5">{error}</div>}

                {/* Read Only Passenger Details card */}
                <div className="grid grid-cols-2 gap-4 mb-6 bg-white/[0.02] p-4 rounded-lg border border-[var(--border)]">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] font-semibold tracking-wider">{t('contactPassengerName')}</div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{user?.name || t('contactLoadingProfile')}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] font-semibold tracking-wider">{t('contactEmailAddress')}</div>
                    <div className="text-sm font-semibold text-[var(--text-primary)] break-all">{user?.email || 'N/A'}</div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="subject" className="font-semibold text-sm text-[var(--text-primary)]">{t('contactSubject')}</Label>
                    <Input
                      id="subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={t('contactSubjectPlaceholder')}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="message" className="font-semibold text-sm text-[var(--text-primary)]">{t('contactMessageDetail')}</Label>
                    <textarea
                      id="message"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={t('contactMessagePlaceholder')}
                      required
                      rows={5}
                      className="flex w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 focus-visible:border-[var(--primary)]/50 transition-colors resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="btn-loading-spinner" /> {t('contactSubmitting')}
                      </>
                    ) : (
                      <>
                        <Send size={16} /> {t('contactSubmitTicketBtn')}
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
