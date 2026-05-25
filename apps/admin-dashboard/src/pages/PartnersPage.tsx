import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Tag, Switch } from 'antd';
import { partnersAPI } from '../services/api';
import { Handshake } from 'lucide-react';
import { cleanGoogleDriveLink } from '../utils/google-drive';

export function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await partnersAPI.getAll();
      setPartners(res);
    } catch (error) {
      message.error('Failed to fetch partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleOpenModal = (partner?: any) => {
    if (partner) {
      setEditingId(partner._id || partner.id);
      form.setFieldsValue({
        name: partner.name,
        logoUrl: partner.logoUrl,
        websiteUrl: partner.websiteUrl,
        isActive: partner.isActive,
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ isActive: true });
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
      const payload = {
        ...values,
        logoUrl: cleanGoogleDriveLink(values.logoUrl),
      };
      if (editingId) {
        await partnersAPI.update(editingId, payload);
        message.success('Partner updated successfully');
      } else {
        await partnersAPI.create(payload);
        message.success('Partner added successfully');
      }
      setIsModalOpen(false);
      fetchPartners();
    } catch (error) {
      message.error((error as any).message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await partnersAPI.delete(id);
      message.success('Partner deleted successfully');
      fetchPartners();
    } catch (error) {
      message.error('Failed to delete partner');
    }
  };

  const handleToggleStatus = async (record: any, checked: boolean) => {
    try {
      const id = record._id || record.id;
      await partnersAPI.update(id, { isActive: checked });
      message.success(`Partner status updated successfully`);
      fetchPartners();
    } catch (error) {
      message.error('Failed to toggle partner status');
    }
  };

  const filteredPartners = partners.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term);
  });

  const columns = [
    {
      title: 'Partner Logo',
      key: 'logoUrl',
      width: 140,
      render: (_: any, record: any) => (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '6px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border)'
        }}>
          <img
            src={cleanGoogleDriveLink(record.logoUrl)}
            alt={record.name}
            style={{
              height: '36px',
              maxWidth: '100px',
              objectFit: 'contain'
            }}
          />
        </div>
      ),
    },
    {
      title: 'Partner Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong style={{ fontSize: '15px' }}>{text}</strong>,
    },
    {
      title: 'Website',
      dataIndex: 'websiteUrl',
      key: 'websiteUrl',
      render: (url: string) => url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
          {url}
        </a>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_: any, record: any) => (
        <Tag color={record.isActive ? 'green' : 'red'} style={{ fontWeight: 'bold' }}>
          {record.isActive ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      ),
    },
    {
      title: 'Toggle Active',
      key: 'toggle',
      width: 130,
      render: (_: any, record: any) => (
        <Switch
          checked={record.isActive}
          onChange={(checked) => handleToggleStatus(record, checked)}
        />
      ),
    },
    {
      title: 'Created Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleOpenModal(record)}>Edit</Button>
          <Button type="link" danger onClick={() => handleDelete(record._id || record.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Handshake size={28} /> Brand Partners</h1>
          <p>Configure corporate cooperations and sponsors displayed on passenger landing page</p>
        </div>
        <Space>
          <Input.Search
            placeholder="Search partner name..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" size="large" onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)' }}>
            + Add Partner
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filteredPartners}
        columns={columns}
        rowKey={(record) => record._id || record.id}
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={editingId ? "Edit Partner" : "Add Partner"}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ isActive: true }}>
          <Form.Item
            name="name"
            label="Partner Name"
            rules={[{ required: true, message: 'Please enter partner name' }]}
          >
            <Input placeholder="e.g. Paymob Egypt" />
          </Form.Item>

          <Form.Item
            name="logoUrl"
            label="Logo URL"
            rules={[{ required: true, message: 'Please enter logo image URL' }]}
          >
            <Input placeholder="e.g. https://domain.com/logo.png" />
          </Form.Item>

          <Form.Item
            name="websiteUrl"
            label="Website URL"
            rules={[
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="e.g. https://paymob.com" />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active Status"
            valuePropName="checked"
          >
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
