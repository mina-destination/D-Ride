import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, ShieldCheck, LogOut, Award, Navigation, Leaf } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

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
      {/* Dynamic background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div style={{
        maxWidth: '850px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1.3fr',
        gap: '2.5rem',
        alignItems: 'start'
      }} className="contact-container">
        
        {/* Left Card: Avatar & Brand Tag */}
        <div className="auth-card glass" style={{ margin: 0, padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
          <div style={{ alignSelf: 'flex-start' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Go Back"
              className="btn-back"
            >
              <ArrowLeft size={16} style={{ transform: language === 'ar' ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'var(--text-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 800,
              boxShadow: '0 0 25px rgba(245, 183, 49, 0.45)',
              border: '2px solid rgba(255, 255, 255, 0.1)'
            }}>
              {getInitials()}
            </div>
            <h2 className="title-outfit" style={{ margin: '8px 0 0 0', fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {user?.name || 'Commuter'}
            </h2>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'black',
              background: 'var(--primary)',
              padding: '4px 12px',
              borderRadius: '100px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              boxShadow: '0 4px 10px rgba(245, 183, 49, 0.2)'
            }}>
              {user?.role || 'PASSENGER'}
            </span>
          </div>

          <div style={{ 
            width: '100%', 
            borderTop: '1px solid var(--border)', 
            paddingTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
              <span>Verified Account Status</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Calendar size={16} style={{ color: 'var(--primary)' }} />
              <span>Member Since May 2026</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-danger btn-block"
            style={{ 
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px'
            }}
          >
            <LogOut size={16} />
            {t('signOut') || 'Sign Out'}
          </button>
        </div>

        {/* Right Card: Account Details & Ride Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* User Information */}
          <div className="auth-card glass" style={{ margin: 0, padding: '2.5rem', width: '100%' }}>
            <h3 className="title-outfit" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>
              Account Settings
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Full Name
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <User size={16} style={{ color: 'var(--primary)' }} />
                  <span>{user?.name || 'Commuter'}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  wordBreak: 'break-all'
                }}>
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  <span>{user?.email || 'N/A'}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Phone Number
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Phone size={16} style={{ color: 'var(--primary)' }} />
                  <span>{user?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Loyalty & Impact stats */}
          <div className="glass" style={{
            padding: '2rem',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 183, 49, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Navigation size={20} />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>12</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rides Booked</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <Leaf size={20} />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>4.8 kg</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CO₂ Saved</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                <Award size={20} />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Gold</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rider Tier</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
