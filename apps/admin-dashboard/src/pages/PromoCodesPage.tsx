import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, Tag, Switch, DatePicker, Select } from 'antd';
import { Popconfirm } from '../components/Popconfirm';
import { message } from '../utils/antdGlobal';
import { promoCodesAPI } from '../services/api';
import { Percent, Ticket } from 'lucide-react';
import dayjs from 'dayjs';

export function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');

  const fetchPromoCodes = async () => {
    try {
      setLoading(true);
      const res = await promoCodesAPI.getAll();
      setPromoCodes(res);
    } catch (error) {
      message.error('Failed to fetch promo codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const handleOpenModal = (promo?: any) => {
    if (promo) {
      setEditingId(promo._id || promo.id);
      setDiscountType(promo.discountType);
      form.setFieldsValue({
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        maxDiscountEGP: promo.maxDiscountEGP,
        minBookingAmountEGP: promo.minBookingAmountEGP,
        usageLimit: promo.usageLimit,
        expiryDate: promo.expiryDate ? dayjs(promo.expiryDate) : null,
        isActive: promo.isActive,
      });
    } else {
      setEditingId(null);
      setDiscountType('PERCENTAGE');
      form.resetFields();
      form.setFieldsValue({
        isActive: true,
        minBookingAmountEGP: 0,
        discountType: 'PERCENTAGE',
      });
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
        code: values.code.trim().toUpperCase(),
        expiryDate: values.expiryDate ? values.expiryDate.toISOString() : null,
        maxDiscountEGP: values.discountType === 'FIXED' ? null : values.maxDiscountEGP,
      };

      if (editingId) {
        await promoCodesAPI.update(editingId, payload);
        message.success('Promo code updated successfully');
      } else {
        await promoCodesAPI.create(payload);
        message.success('Promo code created successfully');
      }
      setIsModalOpen(false);
      fetchPromoCodes();
    } catch (error) {
      // Axios interceptor already toasted but just in case
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promoCodesAPI.delete(id);
      message.success('Promo code deleted successfully');
      fetchPromoCodes();
    } catch (error) {
      message.error('Failed to delete promo code');
    }
  };

  const handleToggleStatus = async (record: any, checked: boolean) => {
    try {
      const id = record._id || record.id;
      await promoCodesAPI.update(id, { isActive: checked });
      message.success(`Promo code ${checked ? 'activated' : 'deactivated'} successfully`);
      fetchPromoCodes();
    } catch (error) {
      message.error('Failed to update status');
    }
  };

  const filteredPromoCodes = promoCodes.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.code?.toLowerCase().includes(term);
  });

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Ticket size={16} style={{ color: 'var(--primary-color)' }} />
          <strong style={{ fontSize: '15px', letterSpacing: '0.5px' }}>{text}</strong>
        </div>
      ),
    },
    {
      title: 'Discount',
      key: 'discount',
      render: (_: any, record: any) => (
        <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
          {record.discountType === 'PERCENTAGE'
            ? `${record.discountValue}%`
            : `${record.discountValue} EGP`}
        </span>
      ),
    },
    {
      title: 'Min. Booking',
      dataIndex: 'minBookingAmountEGP',
      key: 'minBookingAmountEGP',
      render: (amount: number) => `${amount || 0} EGP`,
    },
    {
      title: 'Max. Discount Limit',
      dataIndex: 'maxDiscountEGP',
      key: 'maxDiscountEGP',
      render: (amount: number, record: any) => {
        if (record.discountType === 'FIXED') return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
        return amount ? `${amount} EGP` : <span style={{ color: 'var(--text-muted)' }}>Unlimited</span>;
      },
    },
    {
      title: 'Usage Ratio',
      key: 'usage',
      render: (_: any, record: any) => {
        const count = record.usageCount || 0;
        const limit = record.usageLimit;
        if (limit === null || limit === undefined) {
          return <span>{count} used</span>;
        }
        const pct = Math.min(100, Math.round((count / limit) * 100));
        let color = 'green';
        if (pct >= 90) color = 'red';
        else if (pct >= 75) color = 'orange';

        return (
          <Space>
            <span>{count} / {limit}</span>
            <Tag color={color} style={{ fontSize: '10px', fontWeight: 800 }}>{pct}%</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date: string) => {
        if (!date) return <span style={{ color: 'var(--text-muted)' }}>Never</span>;
        const isExpired = new Date() > new Date(date);
        return (
          <Space>
            <span style={{ color: isExpired ? 'var(--danger-color)' : 'inherit' }}>
              {new Date(date).toLocaleDateString()}
            </span>
            {isExpired && <Tag color="red" style={{ fontSize: '10px', fontWeight: 800 }}>EXPIRED</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: any) => {
        const isExpired = record.expiryDate && new Date() > new Date(record.expiryDate);
        const limitReached = record.usageLimit !== null && record.usageCount >= record.usageLimit;
        const active = record.isActive && !isExpired && !limitReached;

        return (
          <Tag color={active ? 'green' : 'red'} style={{ fontWeight: 'bold' }}>
            {active ? 'ACTIVE' : (isExpired ? 'EXPIRED' : (limitReached ? 'LIMIT REACHED' : 'INACTIVE'))}
          </Tag>
        );
      },
    },
    {
      title: 'Toggle Active',
      key: 'toggle',
      width: 120,
      render: (_: any, record: any) => (
        <Switch
          checked={record.isActive}
          onChange={(checked) => handleToggleStatus(record, checked)}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleOpenModal(record)}>Edit</Button>
          <Popconfirm
            title="Delete promo code?"
            description="Are you sure you want to delete this promo code?"
            onConfirm={() => handleDelete(record._id || record.id)}
            okText="Yes, Delete"
            cancelText="No"
          >
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Percent size={28} /> Promo Codes</h1>
          <p>Configure marketing discount keys, limits, and expiration rules for commutes</p>
        </div>
        <Space wrap>
          <Input.Search
            placeholder="Search promo code..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" size="large" onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)' }}>
            + Create Promo Code
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filteredPromoCodes}
        columns={columns}
        rowKey={(record) => record._id || record.id}
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={editingId ? "Edit Promo Code" : "Create Promo Code"}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        forceRender={true}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ isActive: true, minBookingAmountEGP: 0 }}>
          <Form.Item
            name="code"
            label="Promo Code Name"
            rules={[
              { required: true, message: 'Please enter promo code' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: 'Only letters, numbers, hyphens, and underscores' }
            ]}
          >
            <Input placeholder="e.g. WELCOME10" style={{ textTransform: 'uppercase' }} onChange={(e) => {
              // Assist with formatting
              form.setFieldsValue({ code: e.target.value.toUpperCase() });
            }} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Form.Item
              name="discountType"
              label="Discount Type"
              rules={[{ required: true, message: 'Select discount type' }]}
            >
              <Select onChange={(val) => setDiscountType(val)}>
                <Select.Option value="PERCENTAGE">Percentage (%)</Select.Option>
                <Select.Option value="FIXED">Fixed Amount (EGP)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="discountValue"
              label="Discount Value"
              rules={[
                { required: true, message: 'Enter discount value' },
                { type: 'number', min: 0, message: 'Must be positive value' }
              ]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  style={{ flex: 1 }}
                  placeholder={discountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 50'}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderInlineStart: 'none', borderRadius: '0 6px 6px 0' }}>
                  {discountType === 'PERCENTAGE' ? '%' : 'EGP'}
                </span>
              </Space.Compact>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Form.Item
              name="minBookingAmountEGP"
              label="Min. Booking Amount (EGP)"
              rules={[
                { required: true, message: 'Enter min booking amount' },
                { type: 'number', min: 0, message: 'Must be positive' }
              ]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber style={{ flex: 1 }} placeholder="e.g. 100" />
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderInlineStart: 'none', borderRadius: '0 6px 6px 0' }}>EGP</span>
              </Space.Compact>
            </Form.Item>

            {discountType === 'PERCENTAGE' && (
              <Form.Item
                name="maxDiscountEGP"
                label="Max. Discount Limit (EGP)"
                rules={[{ type: 'number', min: 0, message: 'Must be positive' }]}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <InputNumber style={{ flex: 1 }} placeholder="Unlimited" />
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderInlineStart: 'none', borderRadius: '0 6px 6px 0' }}>EGP</span>
                </Space.Compact>
              </Form.Item>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Form.Item
              name="usageLimit"
              label="Total Usage Limit (Times)"
              rules={[{ type: 'number', min: 1, message: 'Must be at least 1' }]}
            >
              <InputNumber style={{ width: '100%' }} placeholder="Unlimited" />
            </Form.Item>

            <Form.Item
              name="expiryDate"
              label="Expiration Date"
            >
              <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          </div>

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
