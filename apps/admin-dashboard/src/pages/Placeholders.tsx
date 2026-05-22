interface PlaceholderProps {
  title: string;
  icon: string;
  description: string;
}

function PagePlaceholder({ title, icon, description }: PlaceholderProps) {
  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome">
        <h1>{icon} {title}</h1>
        <p>{description}</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
        <h2 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>{title} Management</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
          {description}. This section will be connected to the live API with full CRUD operations.
        </p>
      </div>
    </div>
  );
}



export function BookingsPage() {
  return (
    <PagePlaceholder
      title="Bookings"
      icon="🎫"
      description="View and manage all passenger bookings and tickets"
    />
  );
}

export function PaymentsPage() {
  return (
    <PagePlaceholder
      title="Payments"
      icon="💳"
      description="Track all Paymob transactions and revenue analytics"
    />
  );
}



export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      icon="⚙️"
      description="Configure system preferences, roles, and integrations"
    />
  );
}
