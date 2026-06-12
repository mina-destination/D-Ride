import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Space, Select, InputNumber, Tag } from 'antd';
import { Popconfirm } from '../components/Popconfirm';
import { message } from '../utils/antdGlobal';
import { vehiclesAPI, usersAPI } from '../services/api';
import { CarFront, Download, User } from 'lucide-react';
import { exportToCSV } from '../utils/csv';

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [capacityFilter, setCapacityFilter] = useState<string>('ALL');
  
  const location = useLocation();
  useEffect(() => {
    if (location.state && (location.state as any).searchTerm) {
      setSearchTerm((location.state as any).searchTerm);
    }
  }, [location.state]);

  const fetchFleetData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, driversRes] = await Promise.all([
        vehiclesAPI.getAll(),
        usersAPI.getByRole('DRIVER'),
      ]);
      setVehicles(vehiclesRes);
      setDrivers(driversRes);
    } catch (error) {
      message.error('Failed to fetch fleet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetData();
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
        driverId: vehicle.driverId || (vehicle.driver ? (vehicle.driver._id || vehicle.driver.id) : undefined),
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
      fetchFleetData();
    } catch (error) {
      message.error((error as any).message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vehiclesAPI.delete(id);
      message.success('Vehicle deleted successfully');
      fetchFleetData();
    } catch (error) {
      message.error('Failed to delete vehicle');
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.licensePlate?.toLowerCase().includes(term) ||
      v.make?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (v.status || 'ACTIVE') === statusFilter;

    let matchesCapacity = true;
    if (capacityFilter !== 'ALL' && v.capacity != null) {
      const cap = v.capacity;
      if (capacityFilter === 'SMALL') matchesCapacity = cap <= 14;
      else if (capacityFilter === 'MEDIUM') matchesCapacity = cap > 14 && cap <= 30;
      else if (capacityFilter === 'LARGE') matchesCapacity = cap > 30;
    }

    return matchesSearch && matchesStatus && matchesCapacity;
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
      title: 'Driver',
      key: 'driver',
      render: (_: any, record: any) => {
        const driver = record.driver;
        return driver ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div>
              <strong>{driver.name}</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{driver.phone}</div>
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>— Unassigned</span>
        );
      },
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
          <Popconfirm
            title="Delete vehicle?"
            description="Are you sure you want to delete this vehicle?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes, Delete"
            cancelText="No"
          >
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleExport = () => {
    const headers = [
      { key: '_id', label: 'Vehicle ID', transform: (val: string) => val.toUpperCase() },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'licensePlate', label: 'License Plate' },
      { key: 'capacity', label: 'Capacity (seats)' },
      { key: 'status', label: 'Status', transform: (val: string) => val || 'ACTIVE' },
    ];
    exportToCSV(filteredVehicles, headers, 'vehicles_report');
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CarFront size={28} /> Fleet Management</h1>
          <p>Manage all vehicles in the D-Ride network</p>
        </div>
        <Space wrap>
          <Input.Search
            placeholder="Search license, make, model..."
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
            <Select.Option value="MAINTENANCE">Maintenance</Select.Option>
            <Select.Option value="OUT_OF_SERVICE">Out of Service</Select.Option>
          </Select>
          <Select
            value={capacityFilter}
            onChange={value => setCapacityFilter(value)}
            style={{ width: 170 }}
          >
            <Select.Option value="ALL">All Capacities</Select.Option>
            <Select.Option value="SMALL">Small (≤14 seats)</Select.Option>
            <Select.Option value="MEDIUM">Medium (15–30 seats)</Select.Option>
            <Select.Option value="LARGE">Large (30+ seats)</Select.Option>
          </Select>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}
          >
            Export CSV
          </Button>
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
        forceRender={true}
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

          <Form.Item 
            name="driverId" 
            label="Assigned Driver"
          >
            <Select placeholder="Select a driver" allowClear>
              {drivers.map(d => (
                <Select.Option key={d._id} value={d._id}>
                  {d.name} ({d.phone || 'No Phone'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
