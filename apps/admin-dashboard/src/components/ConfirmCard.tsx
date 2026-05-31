import { Modal, Typography } from 'antd';
import { AlertTriangle } from 'lucide-react';

interface ConfirmCardProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  danger?: boolean;
}

export function ConfirmCard({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  danger = true,
}: ConfirmCardProps) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      closable={false}
      centered
      width={420}
      className="confirm-modal"
    >
      <div className="confirm-card-container">
        <div className="confirm-card-glow" style={{
          background: danger 
            ? 'radial-gradient(circle, rgba(255, 77, 79, 0.15) 0%, rgba(255, 77, 79, 0) 70%)'
            : 'radial-gradient(circle, rgba(245, 183, 49, 0.15) 0%, rgba(245, 183, 49, 0) 70%)'
        }} />
        <div className="confirm-card-content">
          <div className="confirm-card-icon-wrapper" style={{ 
            borderColor: danger ? 'rgba(255, 77, 79, 0.3)' : 'rgba(245, 183, 49, 0.3)',
            background: danger ? 'rgba(255, 77, 79, 0.05)' : 'rgba(245, 183, 49, 0.05)'
          }}>
            <AlertTriangle size={30} color={danger ? '#ff4d4f' : 'var(--primary-color)'} className="pulse-slow" />
          </div>
          
          <Typography.Title level={4} className="confirm-card-title" style={{ marginTop: '1.25rem', marginBottom: '0.5rem', textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
            {title}
          </Typography.Title>
          
          <Typography.Paragraph style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '13.5px', marginBottom: '2rem', lineHeight: 1.5 }}>
            {description}
          </Typography.Paragraph>
          
          <div className="confirm-card-actions">
            <button className="confirm-card-btn cancel" onClick={onCancel} disabled={loading}>
              {cancelText}
            </button>
            <button className={`confirm-card-btn confirm ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={loading}>
              {loading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
