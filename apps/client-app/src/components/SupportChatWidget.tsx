import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { supportAPI } from '../services/api';
import { io, Socket } from 'socket.io-client';
import { 
  MessageSquare, 
  X, 
  Send, 
  LifeBuoy, 
  Ticket,
  ChevronLeft,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

export default function SupportChatWidget() {
  const { isAuthenticated, user } = useAuth();
  const { t, isRtl } = useTranslation();
  
  const [isOpen, setIsOpen] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Parse Socket URL from API URL
  const getSocketUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    return apiUrl.replace(/\/api$/, '');
  };

  // Fetch passenger's tickets
  const loadTickets = async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingTickets(true);
      const data = await supportAPI.getMyTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to load user support tickets', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Load message logs for selected ticket
  const selectTicket = async (ticket: any) => {
    setActiveTicket(ticket);
    try {
      setLoadingMessages(true);
      const history = await supportAPI.getTicketMessages(ticket._id);
      setMessages(history);
      
      // Connect and join WebSocket room for this ticket
      if (socketRef.current) {
        socketRef.current.emit('joinTicket', ticket._id);
      }
    } catch (err) {
      console.error('Failed to load ticket messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Setup WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !isOpen) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    loadTickets();

    const socketUrl = getSocketUrl();
    const token = localStorage.getItem('dride_token');
    
    // Connect to /support namespace
    const socket = io(`${socketUrl}/support`, {
      path: '/api/socket.io',
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('Connected to D-Ride Support WebSocket namespace');
      if (activeTicket) {
        socket.emit('joinTicket', activeTicket._id);
      }
    });

    socket.on('newMessage', (msg: any) => {
      setMessages((prev) => {
        // Prevent duplicate appending
        if (prev.some((m) => m.id === msg.id || m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isOpen]);


  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle active ticket change (ensure room join is called if socket reconnects)
  useEffect(() => {
    if (activeTicket && socketRef.current) {
      socketRef.current.emit('joinTicket', activeTicket._id);
    }
    scrollToBottom();
  }, [activeTicket]);

  // Scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeTicket || !socketRef.current || !user) return;

    socketRef.current.emit('sendMessage', {
      ticketId: activeTicket._id,
      senderId: user._id || (user as any).id || '',
      senderRole: user.role || 'PASSENGER',
      senderName: user.name,
      message: inputText.trim(),
    });

    setInputText('');
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <div style={{ position: 'fixed', bottom: '25px', right: isRtl ? 'auto' : '25px', left: isRtl ? '25px' : 'auto', zIndex: 1000 }}>
          <button
            onClick={() => setIsOpen(true)}
            className="pulsing-button"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary-color) 0%, #d97706 100%)',
              color: 'black',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(245, 183, 49, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
            title="Open Support Chat"
          >
            <MessageSquare size={26} />
          </button>
        </div>
      )}

      {/* Chat Container */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.25s ease-out forwards',
          }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="card glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '370px',
              height: '520px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              background: 'var(--surface)',
              backdropFilter: 'blur(20px)',
              animation: 'modalScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Header */}
            <div 
              style={{ 
                padding: '1rem', 
                background: 'linear-gradient(135deg, rgba(245, 183, 49, 0.1) 0%, transparent 100%)', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeTicket ? (
                  <button 
                    onClick={() => setActiveTicket(null)} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                ) : (
                  <LifeBuoy size={20} style={{ color: 'var(--primary-color)' }} />
                )}
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                    {activeTicket ? activeTicket.subject : t('supportHelpDesk')}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {activeTicket ? t('supportLiveChatStatus') : t('supportOnlineStatus')}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {/* VIEW 1: Ticket List */}
              {!activeTicket && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {t('supportTicketSelectionDesc')}
                    </p>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loadingTickets ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="app-loading-spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
                      </div>
                    ) : tickets.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border)', borderRadius: '8px', margin: 'auto 0' }}>
                        <HelpCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                          {t('supportNoActiveTickets')}
                        </p>
                        <a href="/contact" onClick={() => setIsOpen(false)} className="btn btn-cta" style={{ display: 'inline-flex', fontSize: '0.8rem', padding: '6px 12px' }}>
                          {t('supportCreateTicketBtn')}
                        </a>
                      </div>
                    ) : (
                      tickets.map((t) => (
                      <div 
                        key={t._id} 
                        onClick={() => selectTicket(t)}
                        style={{
                          padding: '10px 14px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          background: 'var(--surface-hover)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        className="ticket-item-hover"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{t.subject}</strong>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 'bold', 
                            padding: '2px 6px', 
                            borderRadius: '3px',
                            background: t.status === 'OPEN' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                            color: t.status === 'OPEN' ? 'var(--primary-color)' : 'var(--success)'
                          }}>
                            {t.status}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.message}
                        </p>
                      </div>
                      ))
                    )}
                  </div>

                  {tickets.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.8rem', marginTop: '0.8rem', textAlign: 'center' }}>
                      <a href="/contact" onClick={() => setIsOpen(false)} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Ticket size={14} />
                        {t('supportNeedNewTicketPrompt')}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: Chat Conversation Thread */}
              {activeTicket && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {loadingMessages ? (
                    <div style={{ textAlign: 'center', padding: '2rem', margin: 'auto' }}>
                      <div className="app-loading-spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Initial message description card */}
                      <div style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('supportOriginalTicketCardHeader')}</span>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{activeTicket.message}</p>
                      </div>

                      {/* Messages list */}
                      {messages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', margin: 'auto 0' }}>
                          {t('supportStartChattingPlaceholder')}
                        </div>
                      ) : (
                        messages.map((msg, idx) => {
                          const isMe = msg.senderId === (user as any)?._id || msg.senderId === (user as any)?.id;
                          return (
                            <div 
                              key={idx}
                              style={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isMe ? 'flex-end' : 'flex-start',
                              }}
                            >
                              <div 
                                style={{
                                  background: isMe ? 'linear-gradient(135deg, var(--primary-color) 0%, #d97706 100%)' : 'var(--surface-hover)',
                                  color: isMe ? 'black' : 'var(--text-primary)',
                                  padding: '8px 12px',
                                  borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                  fontSize: '0.85rem',
                                  border: isMe ? 'none' : '1px solid var(--border)',
                                }}
                              >
                                {msg.message}
                              </div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', padding: '0 4px' }}>
                                {isMe ? (isRtl ? 'أنت' : 'You') : msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Chat Input (Only on VIEW 2) */}
            {activeTicket && (
              <div style={{ padding: '0.8rem', borderTop: '1px solid var(--border)' }}>
                {activeTicket.status === 'RESOLVED' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px', borderRadius: '6px', color: 'var(--success)', fontSize: '0.8rem' }}>
                    <CheckCircle size={14} />
                    <span>{t('supportTicketClosedResolved')}</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder={t('supportTypeMessagePlaceholder')}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-hover)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: '0.85rem',
                      }}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-cta"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        flexShrink: 0
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
