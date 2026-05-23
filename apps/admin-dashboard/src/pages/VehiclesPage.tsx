import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, InputNumber, Tag } from 'antd';
import { vehiclesAPI } from '../services/api';
import { CarFront } from 'lucide-react';

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await vehiclesAPI.getAll();
      setVehicles(res);
    } catch (error) {
      message.error('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleOpenModal = (vehicle?: any) => {
    if (vehicle) {
      setEditingId(vehicle._id);
      form.setFieldsValue({
        make: vehicle.make,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        capacity: vehicle.capacity,
        status: vehicle.status,
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
        await vehiclesAPI.update(editingId, values);
        message.success('Vehicle updated successfully');
      } else {
        await vehiclesAPI.create(values);
        message.success('Vehicle added successfully');
      }
      setIsModalOpen(false);
      fetchVehicles();
    } catch (error) {
      message.error((error as any).message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vehiclesAPI.delete(id);
      message.success('Vehicle deleted successfully');
      fetchVehicles();
    } catch (error) {
      message.error('Failed to delete vehicle');
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const term = searchTerm.toLowerCase();
    return (
      v.licensePlate?.toLowerCase().includes(term) ||
      v.make?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      title: 'License Plate',
      dataIndex: 'licensePlate',
      key: 'licensePlate',
      render: (text: string) => <strong style={{ letterSpacing: '1px' }}>{text}</strong>,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (val: number) => <Tag color="blue">{val} seats</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'gold';
        const s = status || 'ACTIVE';
        if (s === 'ACTIVE') color = 'green';
        if (s === 'MAINTENANCE') color = 'orange';
        if (s === 'OUT_OF_SERVICE') color = 'red';
        return <Tag color={color} style={{ fontWeight: 'bold' }}>{s}</Tag>;
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
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CarFront size={28} /> Fleet Management</h1>
          <p>Manage all vehicles in the D-Ride network</p>
        </div>
        <Space>
          <Input.Search
            placeholder="Search license, make, model..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" size="large" onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)' }}>
            + Add Vehicle
          </Button>
        </Space>
      </div>
      
      <Table 
        dataSource={filteredVehicles} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={editingId ? "Edit Vehicle" : "Add Vehicle"}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ capacity: 14, status: 'ACTIVE' }}>
          <Form.Item 
            name="licensePlate" 
            label="License Plate" 
            rules={[{ required: true, message: 'Please enter license plate' }]}
          >
            <Input placeholder="e.g. أ ب ت 123" />
          </Form.Item>

          <Form.Item 
            name="make" 
            label="Make" 
            rules={[{ required: true, message: 'Please enter make (e.g. Toyota)' }]}
          >
            <Input placeholder="e.g. Toyota" />
          </Form.Item>
          
          <Form.Item 
            name="model" 
            label="Model" 
            rules={[{ required: true, message: 'Please enter model (e.g. Hiace)' }]}
          >
            <Input placeholder="e.g. Hiace" />
          </Form.Item>

          <Form.Item 
            name="capacity" 
            label="Seating Capacity" 
            rules={[{ required: true, message: 'Please enter capacity' }]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item 
            name="status" 
            label="Status" 
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="ACTIVE">Active</Select.Option>
              <Select.Option value="MAINTENANCE">Maintenance</Select.Option>
              <Select.Option value="OUT_OF_SERVICE">Out of Service</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
