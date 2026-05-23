import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supportAPI } from '../services/api';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const { user } = useAuth();

  // Load support info dynamically from settings saved in LocalStorage, with fallback defaults
  const [supportInfo, setSupportInfo] = useState({
    email: 'support@dride.com',
    phone: '+20 100 123 4567'
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('dride_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSupportInfo({
          email: parsed.supportEmail || 'support@dride.com',
          phone: parsed.supportPhone || '+20 100 123 4567'
        });
      } catch (e) {
        console.error('Error parsing settings from localStorage', e);
      }
    }
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
      setError(err?.message || 'Failed to submit support ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '7rem 2rem 4rem',
      position: 'relative',
      zIndex: 1,
      background: 'var(--background)'
    }}>
      {/* Floating neon background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div style={{
        maxWidth: '1000px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: '3rem',
        alignItems: 'start'
      }} className="contact-container">
        
        {/* Left: Contact Info Info Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <span className="hero-badge">
              <span className="hero-badge-dot" />
              Support & Help Desk
            </span>
            <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: '1rem', lineHeight: '1.2' }}>
              Get in <span className="hero-title-accent">Touch</span>
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '1rem', marginBottom: '0', opacity: 0.85 }}>
              Have questions about your booking, payment, or routes? Drop us a line and our dedicated team will get back to you shortly.
            </p>
          </div>

          <div className="glass" style={{
            padding: '2rem',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div className="feature-icon" style={{ flexShrink: 0 }}>
                <Mail size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Support</div>
                <a href={`mailto:${supportInfo.email}`} style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {supportInfo.email}
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div className="feature-icon" style={{ flexShrink: 0 }}>
                <Phone size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Hotline</div>
                <a href={`tel:${supportInfo.phone}`} style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {supportInfo.phone}
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div className="feature-icon" style={{ flexShrink: 0 }}>
                <MapPin size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>HQ Location</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  New Cairo, Cairo, Egypt
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div className="feature-icon" style={{ flexShrink: 0 }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Working Hours</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  24/7 Operations / Support Desk
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Submission Form */}
        <div className="auth-card glass" style={{ margin: 0, padding: '2.5rem', width: '100%', maxWidth: '100%' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '1rem',
                borderRadius: '50%',
                marginBottom: '1.5rem'
              }}>
                <CheckCircle2 size={48} />
              </div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Ticket Submitted!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                Thank you for contacting D-Ride. Your ticket has been recorded, and our team will review and reply to it shortly.
              </p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Submit Another Ticket
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Open Support Ticket</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Detail your issue and an agent will follow up.</p>
              </div>

              {error && <div className="auth-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

              {/* Read Only Passenger Details card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>PASSENGER NAME</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'Loading profile...'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>EMAIL ADDRESS</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{user?.email || 'N/A'}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="auth-field">
                  <label htmlFor="subject" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Subject</label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Booking double billing issue"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="message" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Message Detail</label>
                  <textarea
                    id="message"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Please provide details about your concern..."
                    required
                    rows={5}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="btn-loading-spinner" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Submit Ticket
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>


    </div>
  );
}
