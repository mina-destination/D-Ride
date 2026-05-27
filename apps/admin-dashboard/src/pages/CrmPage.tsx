import { useEffect, useState, useRef } from 'react';
import { Table, Button, Drawer, Space, Tag, Input, Select, message, Popconfirm, Form, Timeline, Card, Avatar, Divider, Alert, Tabs } from 'antd';
import { useAuth } from '../context/AuthContext';
import { usersAPI, bookingsAPI, supportAPI } from '../services/api';
import { 
  Users, Ban, TrendingUp, Phone, Mail, 
  Calendar, DollarSign, Activity, ChevronRight, Clock, MessageSquare, 
  Trash2, UserCheck, Inbox, CheckCircle2, Download
} from 'lucide-react';
import { exportToCSV } from '../utils/csv';
import { io, Socket } from 'socket.io-client';

export function CrmPage() {
  const { user: currentAdmin } = useAuth();
  
  // Data States
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  // Selection and Bulk Actions States
  const [selectedUserKeys, setSelectedUserKeys] = useState<any[]>([]);
  const [selectedTicketKeys, setSelectedTicketKeys] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [isUserSelectionMode, setIsUserSelectionMode] = useState(false);
  const [isTicketSelectionMode, setIsTicketSelectionMode] = useState(false);

  // WebSocket support chat states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);
  
  // Filtering States for Users
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Filtering States for Tickets
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  
  // User Drawer States
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Ticket Drawer States
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  // Fetch users and bookings
  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, bookingsData] = await Promise.all([
        usersAPI.getAll(),
        bookingsAPI.getAll()
      ]);
      setUsers(usersData);
      setBookings(bookingsData);
    } catch (error) {
      message.error('Failed to load CRM data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch support tickets
  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const ticketsData = await supportAPI.getAllTickets();
      setTickets(ticketsData);
    } catch (error) {
      message.error('Failed to load support tickets');
      console.error(error);
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [activeTab]);

  // Filter logic for User list
  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.phone?.includes(term) ||
      u._id?.toLowerCase().includes(term);

    const matchesRole = 
      roleFilter === 'ALL' || 
      u.role === roleFilter;

    const uStatus = u.isActive === false ? 'SUSPENDED' : 'ACTIVE';
    const matchesStatus = 
      statusFilter === 'ALL' || 
      uStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filter logic for Ticket list in CRM
  const filteredCrmTickets = tickets.filter(t => {
    const term = ticketSearchTerm.toLowerCase();
    const matchesSearch = !term ||
      t.subject?.toLowerCase().includes(term) ||
      t.message?.toLowerCase().includes(term) ||
      t.name?.toLowerCase().includes(term) ||
      t.email?.toLowerCase().includes(term) ||
      t._id?.toLowerCase().includes(term);

    const matchesStatus =
      ticketStatusFilter === 'ALL' ||
      (t.status || 'OPEN') === ticketStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // CSV export for Users tab
  const handleExportUsersData = (dataToExport: any[]) => {
    const headers = [
      { key: '_id', label: 'User ID', transform: (val: string) => val.toUpperCase() },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Role' },
      { key: 'isActive', label: 'Status', transform: (val: any) => val !== false ? 'ACTIVE' : 'SUSPENDED' },
      { key: 'createdAt', label: 'Registered On', transform: (val: string) => val ? new Date(val).toLocaleDateString() : '' },
    ];
    exportToCSV(dataToExport, headers, 'crm_users_report');
  };

  const handleExportUsers = () => {
    handleExportUsersData(filteredUsers);
  };

  const handleExportSelectedUsers = () => {
    const selectedData = users.filter(u => selectedUserKeys.includes(u._id));
    handleExportUsersData(selectedData);
  };

  // CSV export for Tickets tab
  const handleExportTicketsData = (dataToExport: any[]) => {
    const headers = [
      { key: '_id', label: 'Ticket ID', transform: (val: string) => val.toUpperCase() },
      { key: 'subject', label: 'Subject' },
      { key: 'name', label: 'Passenger Name' },
      { key: 'email', label: 'Passenger Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'message', label: 'Message' },
      { key: 'status', label: 'Status' },
      { key: 'replies', label: 'Replies Count', transform: (val: any) => val?.length?.toString() || '0' },
      { key: 'createdAt', label: 'Submitted On', transform: (val: string) => val ? new Date(val).toLocaleString() : '' },
    ];
    exportToCSV(dataToExport, headers, 'crm_tickets_report');
  };

  const handleExportTickets = () => {
    handleExportTicketsData(filteredCrmTickets);
  };

  const handleExportSelectedTickets = () => {
    const selectedData = tickets.filter(t => selectedTicketKeys.includes(t._id));
    handleExportTicketsData(selectedData);
  };

  // Bulk CRUD actions for Users
  const handleBulkUserStatusChange = async (isActive: boolean) => {
    try {
      setBulkLoading(true);
      await Promise.all(selectedUserKeys.map(id => usersAPI.update(id, { isActive })));
      message.success(`Successfully updated status for ${selectedUserKeys.length} users`);
      setSelectedUserKeys([]);
      fetchData();
    } catch (error) {
      message.error('Failed to update status for some selected users');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUserRoleChange = async (role: string) => {
    try {
      setBulkLoading(true);
      await Promise.all(selectedUserKeys.map(id => usersAPI.update(id, { role })));
      message.success(`Successfully updated role for ${selectedUserKeys.length} users to ${role}`);
      setSelectedUserKeys([]);
      fetchData();
    } catch (error) {
      message.error('Failed to update role for some selected users');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUserDelete = async () => {
    try {
      setBulkLoading(true);
      await Promise.all(selectedUserKeys.map(id => usersAPI.delete(id)));
      message.success(`Successfully deleted ${selectedUserKeys.length} users`);
      setSelectedUserKeys([]);
      fetchData();
    } catch (error) {
      message.error('Failed to delete some selected users');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk actions for Support Tickets
  const handleBulkResolveTickets = async () => {
    try {
      setBulkLoading(true);
      const toResolve = tickets.filter(t => selectedTicketKeys.includes(t._id) && t.status !== 'RESOLVED');
      if (toResolve.length === 0) {
        message.warning('All selected tickets are already resolved');
        return;
      }
      await Promise.all(toResolve.map(t => supportAPI.resolveTicket(t._id)));
      message.success(`Successfully resolved ${toResolve.length} tickets`);
      setSelectedTicketKeys([]);
      fetchTickets();
    } catch (error) {
      message.error('Failed to resolve some selected tickets');
    } finally {
      setBulkLoading(false);
    }
  };

  // Calculate live statistics
  const totalUsers = users.length;
  const passengerCount = users.filter(u => u.role === 'PASSENGER').length;
  const driverCount = users.filter(u => u.role === 'DRIVER').length;
  const activeCount = users.filter(u => u.isActive !== false).length;
  const activePercentage = totalUsers > 0 ? ((activeCount / totalUsers) * 100).toFixed(1) : '100.0';

  // Network volume / spend calculation
  const totalNetworkSpend = bookings
    .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS')
    .reduce((sum, b) => sum + (b.amountEGP || 0), 0);

  // User Drawer Actions
  const handleOpenDrawer = (record: any) => {
    const freshUser = users.find(u => u._id === record._id);
    setSelectedUser(freshUser || record);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedUser(null);
  };

  const handleAddNote = async (text: string) => {
    if (!selectedUser) return;
    try {
      setIsAddingNote(true);
      const adminName = currentAdmin?.name || 'Administrator';
      const updatedUser = await usersAPI.addNote(selectedUser._id, text, adminName);
      
      setUsers((prev: any[]) => prev.map(u => u._id === selectedUser._id ? { ...u, crmNotes: updatedUser.crmNotes } : u));
      setSelectedUser((prev: any) => prev ? { ...prev, crmNotes: updatedUser.crmNotes } : null);
      
      message.success('CRM support note logged successfully');
    } catch (error) {
      message.error('Failed to add CRM note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const updatedUser = await usersAPI.update(userId, { isActive: !currentStatus });
      setUsers((prev: any[]) => prev.map(u => u._id === userId ? { ...u, isActive: updatedUser.isActive } : u));
      if (selectedUser?._id === userId) {
        setSelectedUser((prev: any) => prev ? { ...prev, isActive: updatedUser.isActive } : null);
      }
      message.success(`User account ${!currentStatus ? 'activated' : 'suspended'} successfully`);
    } catch (error) {
      message.error('Failed to update user status');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const updatedUser = await usersAPI.update(userId, { role: newRole });
      setUsers((prev: any[]) => prev.map(u => u._id === userId ? { ...u, role: updatedUser.role } : u));
      if (selectedUser?._id === userId) {
        setSelectedUser((prev: any) => prev ? { ...prev, role: updatedUser.role } : null);
      }
      message.success(`User role updated to ${newRole}`);
    } catch (error) {
      message.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await usersAPI.delete(userId);
      message.success('User account deleted successfully');
      fetchData();
      if (selectedUser?._id === userId) {
        handleCloseDrawer();
      }
    } catch (error) {
      message.error('Failed to delete user account');
    }
  };

  // Ticket Actions
  const handleOpenTicketDrawer = async (ticket: any) => {
    setSelectedTicket(ticket);
    setIsTicketDrawerOpen(true);
    setChatMessages([]);

    // 1. Fetch historical messages
    try {
      const msgs = await supportAPI.getTicketMessages(ticket._id);
      setChatMessages(msgs);
    } catch (err) {
      console.error('Failed to load support ticket chat history:', err);
    }

    // 2. Setup WebSocket connection
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const socketUrl = apiUrl.replace('/api', '');
    const token = localStorage.getItem('dride_token');

    const socket = io(`${socketUrl}/support`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('Admin connected to Support WebSocket space');
      socket.emit('joinTicket', ticket._id);
    });

    socket.on('newMessage', (msg: any) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id || m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socketRef.current = socket;
  };

  const handleCloseTicketDrawer = () => {
    setIsTicketDrawerOpen(false);
    setSelectedTicket(null);
    setChatMessages([]);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleReplyToTicket = async (text: string) => {
    if (!selectedTicket || !socketRef.current) return;
    try {
      setIsReplying(true);
      const adminName = currentAdmin?.name || 'Administrator';
      const adminId = currentAdmin?._id || 'admin';
      
      socketRef.current.emit('sendMessage', {
        ticketId: selectedTicket._id,
        senderId: adminId,
        senderRole: 'ADMIN',
        senderName: adminName,
        message: text
      });

      // Update local ticket status in UI
      setTickets((prev) =>
        prev.map((t) => (t._id === selectedTicket._id ? { ...t, status: 'OPEN' } : t))
      );
      
      message.success('Reply broadcasted in real-time');
    } catch (error) {
      message.error('Failed to send reply');
    } finally {
      setIsReplying(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      const updatedTicket = await supportAPI.resolveTicket(ticketId);
      setTickets((prev: any[]) => prev.map(t => t._id === ticketId ? updatedTicket : t));
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
      message.success('Ticket marked as resolved');
    } catch (error) {
      message.error('Failed to resolve ticket');
    }
  };

  // Helper calculations for user stats
  const getUserBookings = (userId: string) => {
    return bookings.filter(b => b.userId?._id === userId || b.userId === userId);
  };

  const getUserTotalSpend = (userId: string) => {
    const userB = getUserBookings(userId);
    return userB
      .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS')
      .reduce((sum, b) => sum + (b.amountEGP || 0), 0);
  };

  // Columns Definitions
  const columns = [
    {
      title: 'User Profile',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      render: (text: string, record: any) => {
        const initials = text ? text.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
        let roleColor = 'var(--text-muted)';
        if (record.role === 'ADMIN') roleColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        if (record.role === 'DRIVER') roleColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        if (record.role === 'PASSENGER') roleColor = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar 
              style={{ 
                background: roleColor, 
                color: 'white', 
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            >
              {initials}
            </Avatar>
            <div style={{ cursor: 'pointer' }} onClick={() => handleOpenDrawer(record)}>
              <strong style={{ display: 'block', color: 'var(--text-primary)' }} className="hover-underline">
                {text || 'No Name'}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ID: {record._id.substring(record._id.length - 8).toUpperCase()}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Contact Details',
      key: 'contact',
      render: (_: any, record: any) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Mail size={13} style={{ color: 'var(--text-muted)' }} />
            <span>{record.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <Phone size={12} style={{ color: 'var(--text-muted)' }} />
            <code>{record.phone || 'N/A'}</code>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      sorter: (a: any, b: any) => (a.role || '').localeCompare(b.role || ''),
      render: (role: string, record: any) => (
        <Select
          value={role}
          onChange={(value) => handleChangeRole(record._id, value)}
          style={{ width: 130 }}
          variant="borderless"
          className="role-selector-dropdown"
        >
          <Select.Option value="PASSENGER">
            <Tag color="blue" style={{ fontWeight: '600', margin: 0 }}>Passenger</Tag>
          </Select.Option>
          <Select.Option value="DRIVER">
            <Tag color="emerald" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', fontWeight: '600', margin: 0 }}>Driver</Tag>
          </Select.Option>
          <Select.Option value="ADMIN">
            <Tag color="amber" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)', fontWeight: '600', margin: 0 }}>Admin</Tag>
          </Select.Option>
        </Select>
      ),
    },
    {
      title: 'Spent (EGP)',
      key: 'spend',
      sorter: (a: any, b: any) => getUserTotalSpend(a._id) - getUserTotalSpend(b._id),
      render: (_: any, record: any) => {
        if (record.role !== 'PASSENGER') return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        const totalSpend = getUserTotalSpend(record._id);
        return <strong>{totalSpend.toLocaleString()} EGP</strong>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      sorter: (a: any, b: any) => (a.isActive === false ? 0 : 1) - (b.isActive === false ? 0 : 1),
      render: (isActive: boolean, record: any) => {
        const active = isActive !== false;
        return (
          <Popconfirm
            title="Toggle account status?"
            description={`Are you sure you want to ${active ? 'suspend' : 'activate'} this user account?`}
            onConfirm={() => handleToggleStatus(record._id, active)}
            okText="Confirm"
            cancelText="Cancel"
          >
            <Tag 
              color={active ? 'green' : 'red'} 
              style={{ 
                cursor: 'pointer',
                fontWeight: 'bold', 
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {active ? 'Active' : 'Suspended'}
            </Tag>
          </Popconfirm>
        );
      },
    },
    {
      title: 'Registered On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      render: (date: string) => {
        if (!date) return 'N/A';
        return (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="link" 
            htmlType="button"
            onClick={() => handleOpenDrawer(record)}
            style={{ padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            CRM Profile <ChevronRight size={14} />
          </Button>
          <Popconfirm
            title="Delete Account permanently?"
            description="All passenger data, custom support logs will be deleted. This cannot be undone."
            onConfirm={() => handleDeleteUser(record._id)}
            okText="Delete User"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" htmlType="button" danger style={{ padding: 0 }} title="Delete user">
              <Trash2 size={15} />
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ticketColumns = [
    {
      title: 'Ticket Subject',
      key: 'subject',
      sorter: (a: any, b: any) => (a.subject || '').localeCompare(b.subject || ''),
      render: (_: any, record: any) => (
        <div>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{record.subject}</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ID: {record._id.substring(record._id.length - 8).toUpperCase()}
          </span>
        </div>
      )
    },
    {
      title: 'Passenger Info',
      key: 'passenger',
      sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{record.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <Mail size={11} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }} />
            {record.email}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <Phone size={10} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }} />
            <code>{record.phone}</code>
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: any, b: any) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => {
        const isOpen = status === 'OPEN';
        return (
          <Tag color={isOpen ? 'gold' : 'green'} style={{ fontWeight: 'bold' }}>
            {status}
          </Tag>
        );
      }
    },
    {
      title: 'Replies',
      key: 'replies',
      sorter: (a: any, b: any) => (a.replies?.length || 0) - (b.replies?.length || 0),
      render: (_: any, record: any) => (
        <Tag color="purple" style={{ fontWeight: '600' }}>
          {record.replies?.length || 0} Replies
        </Tag>
      )
    },
    {
      title: 'Submitted On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      render: (date: string) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {new Date(date).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="link" 
            htmlType="button"
            onClick={() => handleOpenTicketDrawer(record)}
            style={{ padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Open Ticket <ChevronRight size={14} />
          </Button>
          {record.status === 'OPEN' && (
            <Popconfirm
              title="Mark ticket as resolved?"
              onConfirm={() => handleResolveTicket(record._id)}
              okText="Resolve"
              cancelText="Cancel"
            >
              <Button type="link" htmlType="button" style={{ color: 'var(--success)', padding: 0 }}>
                Resolve
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // Drawer User Bookings history helper
  const userBookings = selectedUser ? getUserBookings(selectedUser._id) : [];
  const userBookingsCount = userBookings.length;
  const userTotalSpend = selectedUser ? getUserTotalSpend(selectedUser._id) : 0;
  
  const bookingHistoryColumns = [
    {
      title: 'Trip Route',
      key: 'route',
      render: (_: any, record: any) => (
        <strong>{record.tripId?.routeId?.name || 'N/A'}</strong>
      ),
    },
    {
      title: 'Seats',
      key: 'seats',
      render: (_: any, record: any) => (
        record.seatNumbers?.map((s: number) => `#${s}`).join(', ') || 'N/A'
      ),
    },
    {
      title: 'Date',
      key: 'date',
      render: (_: any, record: any) => new Date(record.bookedAt || record.createdAt).toLocaleDateString(),
    },
    {
      title: 'Amount',
      dataIndex: 'amountEGP',
      key: 'amountEGP',
      render: (amt: number) => `${amt} EGP`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'gold';
        const s = status || 'PENDING';
        if (s === 'CONFIRMED' || s === 'COMPLETED' || s === 'SUCCESS') color = 'green';
        if (s === 'CANCELLED') color = 'red';
        return <Tag color={color} style={{ fontSize: '11px', fontWeight: 'bold' }}>{s}</Tag>;
      }
    }
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Page Header */}
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '2rem' }}>
            <Users size={32} style={{ color: 'var(--primary-color)' }} /> Unified User CRM
          </h1>
          <p>Holistic directory to monitor account roles, support tickets inbox, network transactions, and audit notes.</p>
        </div>
      </div>

      {/* CRM Statistics Grid */}
      <div className="kpi-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="kpi-card amber">
          <div className="kpi-header">
            <div className="kpi-icon amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} /></div>
            <div className="kpi-trend up">Registry</div>
          </div>
          <div className="kpi-value">{totalUsers}</div>
          <div className="kpi-label">Total Registered Accounts</div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-header">
            <div className="kpi-icon blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={20} /></div>
            <div className="kpi-trend up">{activePercentage}%</div>
          </div>
          <div className="kpi-value">{activeCount}</div>
          <div className="kpi-label">Active Commuters & Drivers</div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-header">
            <div className="kpi-icon green" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={20} /></div>
            <div className="kpi-trend up">Commutes</div>
          </div>
          <div className="kpi-value">{totalNetworkSpend.toLocaleString()} EGP</div>
          <div className="kpi-label">Network-Wide Ticket LTV</div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-header">
            <div className="kpi-icon red" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ban size={20} /></div>
            <div className="kpi-trend down">Roster</div>
          </div>
          <div className="kpi-value">
            {passengerCount}<span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 400 }}> / {driverCount}</span>
          </div>
          <div className="kpi-label">Passengers vs Drivers Ratios</div>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        className="crm-tabs" 
        style={{ marginBottom: '1.5rem' }} 
        items={[
          {
            key: 'users',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} /> User Accounts
              </span>
            ),
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '1.5rem' }}>
                  <Input.Search 
                    placeholder="Search name, email, phone, ID..." 
                    value={searchTerm} 
                    onSearch={value => setSearchTerm(value)} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    style={{ width: 280 }} 
                    allowClear 
                  />
                  <Select
                    value={roleFilter}
                    onChange={value => setRoleFilter(value)}
                    style={{ width: 140 }}
                  >
                    <Select.Option value="ALL">All Roles</Select.Option>
                    <Select.Option value="PASSENGER">Passengers</Select.Option>
                    <Select.Option value="DRIVER">Drivers</Select.Option>
                    <Select.Option value="ADMIN">Administrators</Select.Option>
                  </Select>
                  <Select
                    value={statusFilter}
                    onChange={value => setStatusFilter(value)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="ALL">All Statuses</Select.Option>
                    <Select.Option value="ACTIVE">Active Only</Select.Option>
                    <Select.Option value="SUSPENDED">Suspended Only</Select.Option>
                  </Select>
                  <Button 
                    onClick={() => {
                      setIsUserSelectionMode(!isUserSelectionMode);
                      setSelectedUserKeys([]);
                    }}
                    type={isUserSelectionMode ? "primary" : "default"}
                    ghost={isUserSelectionMode}
                    style={{ fontWeight: 'bold' }}
                  >
                    {isUserSelectionMode ? "Exit Selection" : "Select Users"}
                  </Button>
                  <Button 
                    onClick={handleExportUsers} 
                    icon={<Download size={16} />}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Export CSV
                  </Button>
                </div>

                {selectedUserKeys.length > 0 && (
                  <Card 
                    style={{ 
                      marginBottom: '1rem', 
                      background: 'var(--surface-hover)', 
                      border: '1px solid var(--border)',
                      borderRadius: '12px' 
                    }}
                    size="small"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>
                        Selected {selectedUserKeys.length} user{selectedUserKeys.length > 1 ? 's' : ''}
                      </span>
                      <Space>
                        <Select 
                          placeholder="Bulk Assign Role" 
                          style={{ width: 160 }}
                          onChange={handleBulkUserRoleChange}
                          value={undefined}
                        >
                          <Select.Option value="PASSENGER">Passenger</Select.Option>
                          <Select.Option value="DRIVER">Driver</Select.Option>
                          <Select.Option value="ADMIN">Admin</Select.Option>
                        </Select>
                        <Button 
                          onClick={() => handleBulkUserStatusChange(true)} 
                          size="small"
                        >
                          Bulk Activate
                        </Button>
                        <Button 
                          onClick={() => handleBulkUserStatusChange(false)} 
                          size="small"
                        >
                          Bulk Suspend
                        </Button>
                        <Button 
                          onClick={handleExportSelectedUsers} 
                          icon={<Download size={14} />}
                          size="small"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          Export Selected
                        </Button>
                        <Popconfirm
                          title={`Are you sure you want to delete the ${selectedUserKeys.length} selected users?`}
                          onConfirm={handleBulkUserDelete}
                          okText="Yes, Delete"
                          cancelText="No"
                        >
                          <Button 
                            type="primary" 
                            danger 
                            size="small" 
                            icon={<Trash2 size={14} />}
                            loading={bulkLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            Delete Selected
                          </Button>
                        </Popconfirm>
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={() => setSelectedUserKeys([])}
                        >
                          Deselect All
                        </Button>
                      </Space>
                    </div>
                  </Card>
                )}

                <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Table
                    rowSelection={isUserSelectionMode ? {
                      selectedRowKeys: selectedUserKeys,
                      onChange: (keys: any[]) => setSelectedUserKeys(keys)
                    } : undefined}
                    dataSource={filteredUsers}
                    columns={columns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    style={{ padding: '0.5rem' }}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'tickets',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Inbox size={16} /> Support Tickets
              </span>
            ),
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '1.5rem' }}>
                  <Input.Search 
                    placeholder="Search subject, user, ID..." 
                    value={ticketSearchTerm} 
                    onSearch={value => setTicketSearchTerm(value)} 
                    onChange={e => setTicketSearchTerm(e.target.value)} 
                    style={{ width: 280 }} 
                    allowClear 
                  />
                  <Select
                    value={ticketStatusFilter}
                    onChange={value => setTicketStatusFilter(value)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="ALL">All Tickets</Select.Option>
                    <Select.Option value="OPEN">Open Only</Select.Option>
                    <Select.Option value="RESOLVED">Resolved Only</Select.Option>
                  </Select>
                  <Button 
                    onClick={() => {
                      setIsTicketSelectionMode(!isTicketSelectionMode);
                      setSelectedTicketKeys([]);
                    }}
                    type={isTicketSelectionMode ? "primary" : "default"}
                    ghost={isTicketSelectionMode}
                    style={{ fontWeight: 'bold' }}
                  >
                    {isTicketSelectionMode ? "Exit Selection" : "Select Tickets"}
                  </Button>
                  <Button 
                    onClick={handleExportTickets} 
                    icon={<Download size={16} />}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Export CSV
                  </Button>
                </div>

                {selectedTicketKeys.length > 0 && (
                  <Card 
                    style={{ 
                      marginBottom: '1rem', 
                      background: 'var(--surface-hover)', 
                      border: '1px solid var(--border)',
                      borderRadius: '12px' 
                    }}
                    size="small"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>
                        Selected {selectedTicketKeys.length} ticket{selectedTicketKeys.length > 1 ? 's' : ''}
                      </span>
                      <Space>
                        <Button 
                          onClick={handleExportSelectedTickets} 
                          icon={<Download size={14} />}
                          size="small"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          Export Selected
                        </Button>
                        <Popconfirm
                          title={`Are you sure you want to resolve the ${selectedTicketKeys.length} selected tickets?`}
                          onConfirm={handleBulkResolveTickets}
                          okText="Yes, Resolve"
                          cancelText="No"
                        >
                          <Button 
                            type="primary" 
                            size="small" 
                            icon={<CheckCircle2 size={14} />}
                            loading={bulkLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#10b981', borderColor: '#10b981' }}
                          >
                            Resolve Selected
                          </Button>
                        </Popconfirm>
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={() => setSelectedTicketKeys([])}
                        >
                          Deselect All
                        </Button>
                      </Space>
                    </div>
                  </Card>
                )}

                <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Table
                    rowSelection={isTicketSelectionMode ? {
                      selectedRowKeys: selectedTicketKeys,
                      onChange: (keys: any[]) => setSelectedTicketKeys(keys)
                    } : undefined}
                    dataSource={filteredCrmTickets}
                    columns={ticketColumns}
                    rowKey="_id"
                    loading={ticketsLoading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    style={{ padding: '0.5rem' }}
                  />
                </div>
              </>
            ),
          }
        ]}
      />

      {/* CRM Profile Detail Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} style={{ color: 'var(--primary-color)' }} />
            <span>CRM Member Profile Ledger</span>
          </div>
        }
        placement="right"
        width={680}
        onClose={handleCloseDrawer}
        open={isDrawerOpen}
        styles={{ body: { background: 'var(--background)', color: 'var(--text-primary)', padding: '24px' } }}
      >
        {selectedUser && (
          <div>
            {/* Main Header card in Drawer */}
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '20px', 
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Avatar 
                  size={64}
                  style={{ 
                    background: selectedUser.role === 'ADMIN' ? '#f59e0b' : selectedUser.role === 'DRIVER' ? '#10b981' : '#3b82f6',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 800
                  }}
                >
                  {selectedUser.name ? selectedUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2) : 'U'}
                </Avatar>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedUser.name}</h2>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                    <Tag color={selectedUser.role === 'ADMIN' ? 'gold' : selectedUser.role === 'DRIVER' ? 'emerald' : 'blue'}>
                      {selectedUser.role}
                    </Tag>
                    <Tag color={selectedUser.isActive !== false ? 'green' : 'red'}>
                      {selectedUser.isActive !== false ? 'ACTIVE' : 'SUSPENDED'}
                    </Tag>
                  </div>
                </div>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email Address:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{selectedUser.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Phone Number:</span>
                  <code style={{ color: 'var(--text-secondary)' }}>{selectedUser.phone || 'N/A'}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>System Member ID:</span>
                  <code style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{selectedUser._id}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account Created:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </Space>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <Card size="small" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Ticket Bookings</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--primary-color)' }}>
                  {selectedUser.role === 'PASSENGER' ? userBookingsCount : 'N/A'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  All network transactions
                </div>
              </Card>
              <Card size="small" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Spend Amount</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#10b981' }}>
                  {selectedUser.role === 'PASSENGER' ? `${userTotalSpend.toLocaleString()} EGP` : '—'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Aggregated ticket value
                </div>
              </Card>
            </div>

            {/* Bookings Ledger Section */}
            {selectedUser.role === 'PASSENGER' && (
              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Calendar size={18} style={{ color: 'var(--primary-color)' }} />
                  <span>Commute Ticket Ledger</span>
                </h3>
                {userBookings.length > 0 ? (
                  <Table 
                    dataSource={userBookings} 
                    columns={bookingHistoryColumns} 
                    rowKey="_id"
                    size="small"
                    pagination={{ pageSize: 4 }}
                    style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}
                  />
                ) : (
                  <Alert message="No active bookings found for this customer." type="info" showIcon />
                )}
              </div>
            )}

            {/* Support Logs & Admin Notes */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <MessageSquare size={18} style={{ color: 'var(--primary-color)' }} />
                <span>Customer Support & Audit Logs</span>
              </h3>

              {/* Add Note Form */}
              <div style={{ marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px' }}>
                <CRMAddNoteForm onAddNote={handleAddNote} isAddingNote={isAddingNote} />
              </div>

              {/* Notes Timeline */}
              {selectedUser.crmNotes && selectedUser.crmNotes.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '6px' }}>
                  <Timeline mode="left">
                    {selectedUser.crmNotes.map((note: any, idx: number) => (
                      <Timeline.Item 
                        key={idx} 
                        dot={<Clock size={12} style={{ color: 'var(--primary-color)' }} />}
                      >
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: '6px' }}>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>{note.text}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>Logged by: <strong>{note.adminName}</strong></span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '30px 10px', 
                  border: '1px dashed var(--border)', 
                  borderRadius: '8px',
                  color: 'var(--text-muted)' 
                }}>
                  <p style={{ margin: 0, fontSize: '13px' }}>No CRM support activity or notes have been logged for this account.</p>
                </div>
              )}
            </div>

            {/* Quick action bar */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '36px', justifyContent: 'flex-end' }}>
              <Popconfirm
                title={`Toggle status to ${selectedUser.isActive !== false ? 'SUSPENDED' : 'ACTIVE'}?`}
                onConfirm={() => handleToggleStatus(selectedUser._id, selectedUser.isActive !== false)}
                okText="Yes"
                cancelText="No"
              >
                <Button 
                  danger={selectedUser.isActive !== false} 
                  type="dashed"
                  htmlType="button"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {selectedUser.isActive !== false ? <Ban size={14} /> : <UserCheck size={14} />}
                  <span>{selectedUser.isActive !== false ? 'Suspend User Access' : 'Activate User Access'}</span>
                </Button>
              </Popconfirm>
            </div>
          </div>
        )}
      </Drawer>

      {/* Support Ticket Detail & Reply Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} style={{ color: 'var(--primary-color)' }} />
            <span>Support Ticket Inbox</span>
          </div>
        }
        placement="right"
        width={680}
        onClose={handleCloseTicketDrawer}
        open={isTicketDrawerOpen}
        styles={{ body: { background: 'var(--background)', color: 'var(--text-primary)', padding: '24px' } }}
      >
        {selectedTicket && (
          <div>
            {/* Main Ticket Info Card in Drawer */}
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '20px', 
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedTicket.subject}
              </h2>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <Tag color={selectedTicket.status === 'OPEN' ? 'gold' : 'green'}>
                  {selectedTicket.status}
                </Tag>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Submitted: {new Date(selectedTicket.createdAt).toLocaleString()}
                </span>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Passenger Name:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{selectedTicket.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email Address:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{selectedTicket.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Phone Number:</span>
                  <code style={{ color: 'var(--text-secondary)' }}>{selectedTicket.phone || 'N/A'}</code>
                </div>
              </Space>

              <div style={{ 
                marginTop: '16px', 
                background: 'var(--background)', 
                padding: '12px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                lineHeight: 1.5
              }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>ORIGINAL PASSENGER MESSAGE:</strong>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedTicket.message}</p>
              </div>
            </div>

            {/* Conversation Log / Reply Timeline */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <Clock size={18} style={{ color: 'var(--primary-color)' }} />
                <span>Ticket Reply History</span>
              </h3>

              {/* Add Reply Form */}
              <div style={{ marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px' }}>
                <CRMReplyForm onReply={handleReplyToTicket} isReplying={isReplying} />
              </div>

              {/* Reply Timeline */}
              {chatMessages && chatMessages.length > 0 ? (
                <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chatMessages.map((msg: any, idx: number) => {
                    const isAdmin = msg.senderRole === 'ADMIN';
                    return (
                      <div 
                        key={idx}
                        style={{
                          alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background: isAdmin ? 'rgba(245, 158, 11, 0.08)' : 'var(--background)',
                          border: isAdmin ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid var(--border)',
                          padding: '10px 12px',
                          borderRadius: isAdmin ? '8px 8px 0 8px' : '8px 8px 8px 0',
                          width: 'fit-content'
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'center', marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                          <span><strong>{msg.senderName}</strong> ({msg.senderRole})</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '30px 10px', 
                  border: '1px dashed var(--border)', 
                  borderRadius: '8px',
                  color: 'var(--text-muted)' 
                }}>
                  <p style={{ margin: 0, fontSize: '13px' }}>No replies have been sent for this ticket yet.</p>
                </div>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '36px', justifyContent: 'flex-end' }}>
              {selectedTicket.status === 'OPEN' ? (
                <Popconfirm
                  title="Mark ticket as resolved?"
                  onConfirm={() => handleResolveTicket(selectedTicket._id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button 
                    type="primary"
                    htmlType="button"
                    style={{ background: '#10b981', borderColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Resolve Ticket</span>
                  </Button>
                </Popconfirm>
              ) : (
                <Alert 
                  message="This ticket is resolved. Sending a reply will automatically reopen it." 
                  type="success" 
                  showIcon 
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ── Sub-components for conditional form mounting to resolve useForm warning ──

interface CRMAddNoteFormProps {
  onAddNote: (text: string) => Promise<void>;
  isAddingNote: boolean;
}

function CRMAddNoteForm({ onAddNote, isAddingNote }: CRMAddNoteFormProps) {
  const [noteForm] = Form.useForm();

  const handleFinish = async (values: { text: string }) => {
    await onAddNote(values.text);
    noteForm.resetFields();
  };

  return (
    <Form form={noteForm} onFinish={handleFinish} layout="vertical">
      <Form.Item 
        name="text" 
        label={<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Log new support communication or account audit notes:</span>}
        rules={[{ required: true, message: 'Please write a note before submitting.' }]}
        style={{ marginBottom: '12px' }}
      >
        <Input.TextArea 
          rows={2} 
          placeholder="Enter customer support activity, refund details, verification remarks..." 
          style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        />
      </Form.Item>
      <Form.Item style={{ margin: 0, textAlign: 'right' }}>
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={isAddingNote}
          style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 'bold' }}
        >
          Log CRM Activity Note
        </Button>
      </Form.Item>
    </Form>
  );
}

interface CRMReplyFormProps {
  onReply: (text: string) => Promise<void>;
  isReplying: boolean;
}

function CRMReplyForm({ onReply, isReplying }: CRMReplyFormProps) {
  const [replyForm] = Form.useForm();

  const handleFinish = async (values: { text: string }) => {
    await onReply(values.text);
    replyForm.resetFields();
  };

  return (
    <Form form={replyForm} onFinish={handleFinish} layout="vertical">
      <Form.Item 
        name="text" 
        label={<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Send a reply to passenger:</span>}
        rules={[{ required: true, message: 'Please write a reply before sending.' }]}
        style={{ marginBottom: '12px' }}
      >
        <Input.TextArea 
          rows={3} 
          placeholder="Write your support response here..." 
          style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        />
      </Form.Item>
      <Form.Item style={{ margin: 0, textAlign: 'right' }}>
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={isReplying}
          style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 'bold' }}
        >
          Send Reply
        </Button>
      </Form.Item>
    </Form>
  );
}
