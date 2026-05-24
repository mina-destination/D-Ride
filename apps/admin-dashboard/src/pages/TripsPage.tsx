import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, InputNumber, Select, Space, message, DatePicker, Progress, Badge, Checkbox, Input } from 'antd';
import { tripsAPI, routesAPI, vehiclesAPI, usersAPI } from '../services/api';
import dayjs from 'dayjs';
import { Bus, User, Briefcase, Unlock, Square, Rocket, Lock, Download } from 'lucide-react';
import { exportToCSV } from '../utils/csv';

interface ActiveSimulation {
  tripId: string;
  intervalId: any;
  currentIndex: number;
  totalCoordinates: number;
}

export function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Real-time trip simulation state
  const [activeSims, setActiveSims] = useState<Record<string, ActiveSimulation>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const selectedRouteId = Form.useWatch('routeId', form);
  const selectedRoute = routes.find(r => r._id === selectedRouteId);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tripsRes, routesRes, vehiclesRes, driversRes] = await Promise.all([
        tripsAPI.getAll(),
        routesAPI.getAll(),
        vehiclesAPI.getAll(),
        usersAPI.getByRole('DRIVER')
      ]);
      setTrips(tripsRes);
      setRoutes(routesRes);
      setVehicles(vehiclesRes);
      setDrivers(driversRes);
    } catch (error) {
      message.error('Failed to fetch platform configuration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      // Cleanup all simulation intervals on unmount
      Object.values(activeSims).forEach(sim => clearInterval(sim.intervalId));
    };
  }, []);

  const handleOpenModal = (trip?: any) => {
    if (trip) {
      setEditingId(trip._id);
      form.setFieldsValue({
        routeId: trip.routeId?._id || trip.routeId,
        vehicleId: trip.vehicleId?._id || trip.vehicleId,
        driverId: trip.driverId?._id || trip.driverId,
        departureTime: dayjs(trip.departureTime),
        status: trip.status,
        priceEGP: trip.priceEGP,
        availableSeats: trip.availableSeats,
        lockSeat14: trip.lockedSeats?.includes(14) ?? true,
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({
        status: 'SCHEDULED',
        availableSeats: 14,
        priceEGP: 150,
        lockSeat14: true,
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
      const { lockSeat14, ...rest } = values;
      const payload = {
        ...rest,
        departureTime: values.departureTime.toISOString(),
        lockedSeats: lockSeat14 ? [14] : [],
      };

      if (editingId) {
        await tripsAPI.update(editingId, payload);
        message.success('Trip updated successfully');
      } else {
        await tripsAPI.create(payload);
        message.success('Trip scheduled successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      message.error('Failed to save trip configuration');
    }
  };

  const toggleLuggageLock = async (trip: any) => {
    try {
      const isLocked = trip.lockedSeats?.includes(14);
      const nextLocked = isLocked 
        ? (trip.lockedSeats || []).filter((s: number) => s !== 14)
        : [...(trip.lockedSeats || []), 14];
      
      await tripsAPI.update(trip._id, { lockedSeats: nextLocked });
      message.success(isLocked ? 'Seat 14 successfully unlocked for passengers! 🎉' : 'Seat 14 successfully locked for passenger luggage! 🧳');
      fetchData();
    } catch (error) {
      message.error('Failed to update seat lock configuration');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tripsAPI.delete(id);
      message.success('Trip cancelled and removed');
      fetchData();
    } catch (error) {
      message.error('Failed to delete trip');
    }
  };

  // --- Real-time Simulator Core Logic ---
  const startSimulation = (trip: any) => {
    const coordinates = trip.routeId?.path?.coordinates;
    if (!coordinates || coordinates.length === 0) {
      message.error('This route has no coordinate path defined! Plot coordinates first.');
      return;
    }

    const vId = trip.vehicleId?._id || trip.vehicleId;
    const dId = trip.driverId?._id || trip.driverId;

    if (!vId || !dId) {
      message.error('Cannot run GPS simulation: Please assign both a vehicle and a driver operator to this trip first!');
      return;
    }

    if (activeSims[trip._id]) {
      message.warning('Simulation is already actively running for this trip.');
      return;
    }

    message.success(`Starting live location feed for Trip ${trip._id.slice(-6)}...`);

    let currentIndex = 0;
    const intervalId = setInterval(async () => {
      if (currentIndex >= coordinates.length) {
        clearInterval(intervalId);
        setActiveSims(prev => {
          const next = { ...prev };
          delete next[trip._id];
          return next;
        });
        message.success(`Trip ${trip._id.slice(-6)} has arrived at destination!`);
        return;
      }

      const [lng, lat] = coordinates[currentIndex];
      try {
        await vehiclesAPI.updateLocation(vId, dId, lat, lng);
        setActiveSims(prev => ({
          ...prev,
          [trip._id]: {
            ...prev[trip._id],
            currentIndex,
          }
        }));
      } catch (e) {
        console.error('Failed to update live coordinates', e);
      }
      currentIndex++;
    }, 2000);

    setActiveSims(prev => ({
      ...prev,
      [trip._id]: {
        tripId: trip._id,
        intervalId,
        currentIndex: 0,
        totalCoordinates: coordinates.length,
      }
    }));
  };

  const stopSimulation = (tripId: string) => {
    const sim = activeSims[tripId];
    if (sim) {
      clearInterval(sim.intervalId);
      setActiveSims(prev => {
        const next = { ...prev };
        delete next[tripId];
        return next;
      });
      message.info('Simulation paused.');
    }
  };

  const columns = [
    {
      title: 'Route',
      dataIndex: 'routeId',
      key: 'routeId',
      render: (route: any) => <strong>{route?.name || 'Unassigned Route'}</strong>,
    },
    {
      title: 'Vehicle & Driver',
      key: 'vehicleAndDriver',
      render: (_: any, record: any) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Bus size={14} /> {record.vehicleId?.licensePlate ? `${record.vehicleId.make} (${record.vehicleId.licensePlate})` : 'Unassigned Vehicle'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {record.driverId?.name || 'Unassigned Driver'}</div>
        </div>
      ),
    },
    {
      title: 'Departure Time',
      dataIndex: 'departureTime',
      key: 'departureTime',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color: "success" | "processing" | "default" | "error" | "warning" = 'default';
        if (status === 'SCHEDULED') color = 'default';
        if (status === 'BOARDING') color = 'warning';
        if (status === 'IN_TRANSIT') color = 'processing';
        if (status === 'COMPLETED') color = 'success';
        return <Badge status={color} text={status} />;
      }
    },
    {
      title: 'Luggage Hold',
      key: 'luggage',
      render: (_: any, record: any) => {
        const isLocked = record.lockedSeats?.includes(14);
        return (
          <Button 
            type={isLocked ? "default" : "primary"}
            size="small"
            onClick={() => toggleLuggageLock(record)}
            style={{
              background: isLocked ? 'var(--surface-hover)' : 'var(--primary-color)',
              color: isLocked ? 'var(--text-secondary)' : 'black',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold'
            }}
          >
            {isLocked ? <><Briefcase size={14} /> Seat 14 Luggage</> : <><Unlock size={14} /> Seat 14 Active</>}
          </Button>
        );
      }
    },
    {
      title: 'Price & Seats',
      key: 'priceSeats',
      render: (_: any, record: any) => (
        <div>
          <div><strong>{record.priceEGP} EGP</strong></div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Seats: {record.bookedSeats} / {record.availableSeats}
          </div>
        </div>
      ),
    },
    {
      title: 'Live Simulator',
      key: 'simulator',
      render: (_: any, record: any) => {
        const sim = activeSims[record._id];
        const isRunning = !!sim;
        const progress = isRunning ? Math.round((sim.currentIndex / sim.totalCoordinates) * 100) : 0;

        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            {isRunning ? (
              <Space>
                <Progress type="circle" percent={progress} size={30} />
                <Button type="primary" danger size="small" onClick={() => stopSimulation(record._id)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Stop <Square size={12} fill="currentColor" />
                </Button>
              </Space>
            ) : (
              <Button 
                type="primary" 
                size="small" 
                onClick={() => startSimulation(record)}
                style={{ background: 'var(--primary-color)', color: 'black', display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={record.status === 'COMPLETED'}
              >
                Live GPS Run <Rocket size={12} />
              </Button>
            )}
          </Space>
        );
      }
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

  const filteredTrips = trips.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      t.routeId?.name?.toLowerCase().includes(term) ||
      t.driverId?.name?.toLowerCase().includes(term) ||
      t.vehicleId?.licensePlate?.toLowerCase().includes(term) ||
      t.vehicleId?.make?.toLowerCase().includes(term) ||
      t._id?.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'ALL' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    const headers = [
      { key: '_id', label: 'Trip ID', transform: (val: string) => val.toUpperCase() },
      { key: 'routeId.name', label: 'Route Name' },
      { key: 'vehicleId.make', label: 'Vehicle Make', transform: (_val: any, record: any) => record.vehicleId?.make || 'N/A' },
      { key: 'vehicleId.licensePlate', label: 'Vehicle Plate Number', transform: (_val: any, record: any) => record.vehicleId?.licensePlate || 'N/A' },
      { key: 'driverId.name', label: 'Driver Name', transform: (_val: any, record: any) => record.driverId?.name || 'N/A' },
      { key: 'departureTime', label: 'Departure Time', transform: (val: string) => val ? new Date(val).toLocaleString() : '' },
      { key: 'status', label: 'Trip Status' },
      { key: 'priceEGP', label: 'Price (EGP)' },
      { key: 'bookedSeats', label: 'Booked Seats' },
      { key: 'availableSeats', label: 'Available Seats' },
    ];
    exportToCSV(filteredTrips, headers, 'trips_report');
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Bus size={28} /> Trips Management & Simulation</h1>
          <p>Schedule trips and trigger live GPS route simulations to passenger app trackers</p>
        </div>
        <Space wrap>
          <Input.Search
            placeholder="Search route, driver, vehicle..."
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
            <Select.Option value="SCHEDULED">Scheduled</Select.Option>
            <Select.Option value="BOARDING">Boarding</Select.Option>
            <Select.Option value="IN_TRANSIT">In Transit</Select.Option>
            <Select.Option value="COMPLETED">Completed</Select.Option>
            <Select.Option value="CANCELLED">Cancelled</Select.Option>
          </Select>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}
          >
            Export CSV
          </Button>
          <Button type="primary" size="large" onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)' }}>
            + Add Trip
          </Button>
        </Space>
      </div>
      
      <Table 
        dataSource={filteredTrips} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={editingId ? "Edit Trip" : "Schedule New Trip"}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item 
            name="routeId" 
            label="Select Route" 
            rules={[{ required: true, message: 'Please select a route' }]}
          >
            <Select 
              showSearch 
              placeholder="Choose Route"
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {routes.map(r => (
                <Select.Option key={r._id} value={r._id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedRoute && selectedRoute.checkpoints && selectedRoute.checkpoints.length > 0 && (
            <div style={{
              margin: '-8px 0 16px',
              padding: '12px 16px',
              background: 'var(--surface-elevated, #242526)',
              border: '1px solid var(--border, #3E4042)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #B0B3B8)' }}>
                Route Checkpoints Preview:
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
                padding: '4px 0'
              }}>
                {selectedRoute.checkpoints.map((cp: any, index: number) => {
                  const isStart = cp.type === 'START';
                  const isEnd = cp.type === 'END';
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: isStart ? 'rgba(16, 185, 129, 0.08)' : isEnd ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                        border: `1px solid ${isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6'}`,
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6'
                        }} />
                        {cp.name}
                        {cp.bufferTimeMinutes > 0 && (
                          <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 'normal' }}>
                            ({cp.bufferTimeMinutes}m)
                          </span>
                        )}
                      </div>
                      {index < selectedRoute.checkpoints.length - 1 && (
                        <span style={{ color: 'var(--text-muted, #65676B)', fontSize: '12px' }}>➔</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #B0B3B8)', display: 'flex', gap: '15px' }}>
                <span>Distance: <strong>{selectedRoute.distanceKm || '—'} km</strong></span>
                <span>Duration: <strong>{selectedRoute.estimatedDurationMinutes || '—'} mins</strong></span>
              </div>
            </div>
          )}

          <Form.Item 
            name="vehicleId" 
            label="Assign Vehicle"
          >
            <Select 
              showSearch 
              placeholder="Select Fleet Vehicle (Optional)"
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {vehicles.map(v => (
                <Select.Option key={v._id} value={v._id}>
                  {v.make} {v.model} ({v.licensePlate})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="driverId" 
            label="Assign Driver"
          >
            <Select 
              showSearch 
              placeholder="Assign Driver Operator (Optional)"
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {drivers.map(d => (
                <Select.Option key={d._id} value={d._id}>{d.name} ({d.phone})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item 
            name="departureTime" 
            label="Departure Time" 
            rules={[{ required: true, message: 'Please select departure time' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item 
            name="status" 
            label="Status" 
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="SCHEDULED">Scheduled</Select.Option>
              <Select.Option value="BOARDING">Boarding</Select.Option>
              <Select.Option value="IN_TRANSIT">In Transit</Select.Option>
              <Select.Option value="COMPLETED">Completed</Select.Option>
              <Select.Option value="CANCELLED">Cancelled</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="lockSeat14" 
            valuePropName="checked"
          >
            <Checkbox style={{ display: 'flex', alignItems: 'center' }}>
              <Lock size={14} style={{ marginRight: '4px' }} /> Reserved Seat 14 for passenger luggage by default
            </Checkbox>
          </Form.Item>

          <Space style={{ display: 'flex' }}>
            <Form.Item 
              name="priceEGP" 
              label="Price (EGP)" 
              rules={[{ required: true }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item 
              name="availableSeats" 
              label="Available Seats" 
              rules={[{ required: true }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
