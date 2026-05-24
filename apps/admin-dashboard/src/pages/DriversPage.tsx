import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag, List, Rate, Avatar } from 'antd';
import { usersAPI, reviewsAPI } from '../services/api';
import { UserCog, Download } from 'lucide-react';
import { exportToCSV } from '../utils/csv';

export function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ratings, setRatings] = useState<Record<string, { averageRating: number; totalReviews: number }>>({});
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeDriverForReviews, setActiveDriverForReviews] = useState<any>(null);
  const [driverReviews, setDriverReviews] = useState<any[]>([]);

  const handleOpenReviewsModal = async (driver: any) => {
    setActiveDriverForReviews(driver);
    setIsReviewsModalOpen(true);
    try {
      setReviewsLoading(true);
      const res = await reviewsAPI.getDriverReviews(driver._id);
      setDriverReviews(res);
    } catch (error) {
      message.error('Failed to fetch driver reviews');
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleCloseReviewsModal = () => {
    setIsReviewsModalOpen(false);
    setDriverReviews([]);
    setActiveDriverForReviews(null);
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getByRole('DRIVER');
      setDrivers(res);

      // Fetch rating stats for each driver
      const ratingsData: Record<string, any> = {};
      await Promise.all(
        res.map(async (driver: any) => {
          try {
            const ratingRes = await reviewsAPI.getDriverRating(driver._id);
            ratingsData[driver._id] = ratingRes;
          } catch (err) {
            console.error('Failed to fetch rating for driver', driver._id, err);
          }
        })
      );
      setRatings(ratingsData);
    } catch (error) {
      message.error('Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleOpenModal = (driver?: any) => {
    if (driver) {
      setEditingId(driver._id);
      form.setFieldsValue({
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        status: driver.status || 'ACTIVE',
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
    setEditingId(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await usersAPI.update(editingId, values);
        message.success('Driver updated successfully');
      } else {
        await usersAPI.create({ ...values, role: 'DRIVER' });
        message.success('Driver registered successfully with default password.');
      }
      setIsModalOpen(false);
      fetchDrivers();
    } catch (error: any) {
      message.error(error.message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersAPI.delete(id);
      message.success('Driver deleted successfully');
      fetchDrivers();
    } catch (error) {
      message.error('Failed to delete driver');
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.phone?.includes(term);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (d.status || 'ACTIVE') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => {
        const ratingInfo = ratings[record._id];
        return (
          <div>
            <strong>{text}</strong>
            {ratingInfo && ratingInfo.totalReviews > 0 ? (
              <div style={{ color: '#f5b731', fontSize: '0.85rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⭐ {ratingInfo.averageRating.toFixed(1)}</span>
                <span style={{ color: '#8c8c8c' }}>({ratingInfo.totalReviews} {ratingInfo.totalReviews === 1 ? 'review' : 'reviews'})</span>
              </div>
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: '0.85rem', marginTop: '2px' }}>
                ⭐ No reviews yet
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const currentStatus = status || 'ACTIVE';
        let color = 'gold';
        if (currentStatus === 'ACTIVE') color = 'green';
        if (currentStatus === 'SUSPENDED') color = 'red';
        if (currentStatus === 'INACTIVE') color = 'gray';
        return <Tag color={color} style={{ fontWeight: 'bold' }}>{currentStatus}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleOpenModal(record)}>Edit</Button>
          <Button type="link" onClick={() => handleOpenReviewsModal(record)}>View Reviews</Button>
          <Button type="link" danger onClick={() => handleDelete(record._id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  const handleExport = () => {
    const headers = [
      { key: '_id', label: 'Driver ID', transform: (val: string) => val.toUpperCase() },
      { key: 'name', label: 'Driver Name' },
      { key: 'email', label: 'Email Address' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'status', label: 'Account Status', transform: (val: string) => val || 'ACTIVE' },
    ];
    exportToCSV(filteredDrivers, headers, 'drivers_report');
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><UserCog size={28} /> Drivers Management</h1>
          <p>Manage fleet operators</p>
        </div>
        <Space>
          <Input.Search
            placeholder="Search drivers"
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={value => setStatusFilter(value)}
            style={{ width: 160 }}
          >
            <Select.Option value="ALL">All Statuses</Select.Option>
            <Select.Option value="ACTIVE">Active</Select.Option>
            <Select.Option value="SUSPENDED">Suspended</Select.Option>
          </Select>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Export CSV
          </Button>
          <Button type="primary" onClick={() => handleOpenModal()}>Add Driver</Button>
        </Space>
      </div>
      
      <Table 
        dataSource={filteredDrivers} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={editingId ? "Edit Driver" : "Add Driver"}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ status: 'ACTIVE' }}>
          <Form.Item 
            name="name" 
            label="Full Name" 
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item 
            name="email" 
            label="Email Address" 
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item 
            name="phone" 
            label="Phone Number" 
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item 
            name="status" 
            label="Status" 
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="ACTIVE">Active</Select.Option>
              <Select.Option value="INACTIVE">Inactive</Select.Option>
              <Select.Option value="SUSPENDED">Suspended</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={activeDriverForReviews ? `Reviews for ${activeDriverForReviews.name}` : 'Driver Reviews'}
        open={isReviewsModalOpen}
        onCancel={handleCloseReviewsModal}
        footer={[
          <Button key="close" onClick={handleCloseReviewsModal}>
            Close
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <List
          loading={reviewsLoading}
          itemLayout="horizontal"
          dataSource={driverReviews}
          locale={{ emptyText: 'No reviews found for this driver' }}
          renderItem={(item: any) => {
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }) : 'N/A';
            return (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={item.userAvatar} style={{ backgroundColor: '#f5b731', color: 'black' }}>{item.userName[0]?.toUpperCase()}</Avatar>}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{item.userName}</strong></span>
                      <span style={{ fontSize: '0.8rem', color: '#8c8c8c' }}>{dateStr}</span>
                    </div>
                  }
                  description={
                    <div style={{ marginTop: '4px' }}>
                      <Rate disabled defaultValue={item.rating} style={{ fontSize: '0.9rem', color: '#f5b731' }} />
                      {item.comment && (
                        <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          "{item.comment}"
                        </p>
                      )}
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
}
