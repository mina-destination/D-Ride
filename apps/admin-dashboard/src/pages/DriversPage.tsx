import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag } from 'antd';
import { usersAPI } from '../services/api';
import { UserCog } from 'lucide-react';

export function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getByRole('DRIVER');
      setDrivers(res);
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
    return (
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.phone?.includes(term)
    );
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>,
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
          <Button type="link" danger onClick={() => handleDelete(record._id)}>Delete</Button>
        </Space>
      ),
    },
  ];

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
        destroyOnClose
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
    </div>
  );
}
