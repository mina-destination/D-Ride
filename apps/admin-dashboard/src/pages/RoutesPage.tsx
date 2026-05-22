import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select } from 'antd';
import { MapContainer, TileLayer, Polyline, useMapEvents, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { routesAPI } from '../services/api';
import { Map } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapClickHandler({ 
  mapMode, 
  setPoints, 
  setCheckpoints 
}: { 
  mapMode: 'path' | 'checkpoint';
  setPoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setCheckpoints: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  useMapEvents({
    click(e) {
      if (mapMode === 'path') {
        setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      } else {
        setCheckpoints((prev) => [
          ...prev,
          {
            name: `Checkpoint ${prev.length + 1}`,
            location: {
              type: 'Point',
              coordinates: [e.latlng.lng, e.latlng.lat], // [lng, lat]
            },
            order: prev.length + 1,
          },
        ]);
      }
    },
  });
  return null;
}

// Curated stunning travel cover pictures for Egyptian cities and hotspots
const PRESET_IMAGES = [
  { label: 'Smart Village Premium Tech Hub', value: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80' },
  { label: 'Maadi Scenic Ring Road Corridor', value: 'https://images.unsplash.com/photo-1541462608141-2f58c6e68e98?auto=format&fit=crop&w=600&q=80' },
  { label: 'Cairo Downtown Historic Architecture', value: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80' },
  { label: 'New Cairo Modern Corporate District', value: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80' },
  { label: '6th of October Industrial Complex', value: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80' },
  { label: 'Heliopolis Golden Sunsets', value: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?auto=format&fit=crop&w=600&q=80' }
];

export function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Local state for the map points [lat, lng]
  const [points, setPoints] = useState<[number, number][]>([]);
  const [mapMode, setMapMode] = useState<'path' | 'checkpoint'>('path');
  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const res = await routesAPI.getAll();
      setRoutes(res);
    } catch (error) {
      message.error('Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleOpenModal = (route?: any) => {
    setMapMode('path');
    if (route) {
      setEditingId(route._id);
      form.setFieldsValue({
        name: route.name,
        coverImage: route.coverImage || PRESET_IMAGES[0].value,
      });
      // Convert [lng, lat] from DB to [lat, lng] for Leaflet
      if (route.path && route.path.coordinates) {
        setPoints(route.path.coordinates.map((coord: number[]) => [coord[1], coord[0]]));
      } else {
        setPoints([]);
      }
      if (route.checkpoints) {
        setCheckpoints(route.checkpoints);
      } else {
        setCheckpoints([]);
      }
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({
        coverImage: PRESET_IMAGES[0].value,
      });
      setPoints([]);
      setCheckpoints([]);
    }
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
    setEditingId(null);
    setPoints([]);
    setCheckpoints([]);
    setMapMode('path');
  };

  const handleSubmit = async (values: any) => {
    try {
      if (points.length < 2) {
        message.error('Please plot at least two points on the map to create a route.');
        return;
      }

      // Convert [lat, lng] back to [lng, lat] for GeoJSON
      const geoJsonCoordinates = points.map(p => [p[1], p[0]]);

      const payload = {
        name: values.name,
        coverImage: values.coverImage,
        path: {
          type: 'LineString',
          coordinates: geoJsonCoordinates,
        },
        checkpoints: checkpoints,
      };

      if (editingId) {
        await routesAPI.update(editingId, payload);
        message.success('Route updated successfully');
      } else {
        await routesAPI.create(payload);
        message.success('Route created successfully');
      }
      setIsModalOpen(false);
      fetchRoutes();
    } catch (error) {
      message.error((error as any).message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await routesAPI.delete(id);
      message.success('Route deleted successfully');
      fetchRoutes();
    } catch (error) {
      message.error('Failed to delete route');
    }
  };

  const handleClearMap = () => {
    setPoints([]);
    setCheckpoints([]);
  };

  const filteredRoutes = routes.filter(r => 
    r.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      title: 'Landscape Banner',
      dataIndex: 'coverImage',
      key: 'coverImage',
      render: (imgUrl: string) => (
        <div style={{
          width: '100px',
          height: '56px',
          borderRadius: '8px',
          backgroundImage: `url(${imgUrl || PRESET_IMAGES[0].value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }} />
      )
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleDateString(),
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
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Map size={28} /> Routes Management</h1>
          <p>Manage all transit routes across the network</p>
        </div>
        <Space>
          <Input.Search
            placeholder="Search routes..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" size="large" onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)' }}>
            + Add Route
          </Button>
        </Space>
      </div>
      
      <Table 
        dataSource={filteredRoutes} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={editingId ? "Edit Route" : "Create Route"}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item 
            name="name" 
            label="Route Name" 
            rules={[{ required: true, message: 'Please enter route name' }]}
          >
            <Input placeholder="e.g. Cairo to Alexandria" />
          </Form.Item>

          <Form.Item 
            name="coverImage" 
            label="Visual Landscape Cover (Banner)" 
            rules={[{ required: true, message: 'Please select a cover image' }]}
          >
            <Select>
              {PRESET_IMAGES.map((img, idx) => (
                <Select.Option key={idx} value={img.value}>
                  {img.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label><strong>Route Map</strong> (Click to add coordinates)</label>
              <Space>
                <Select value={mapMode} onChange={setMapMode} style={{ width: 180 }}>
                  <Select.Option value="path">Draw Path (Roadway)</Select.Option>
                  <Select.Option value="checkpoint">Place Checkpoint 📍</Select.Option>
                </Select>
                <Button size="small" onClick={handleClearMap}>Clear Map</Button>
              </Space>
            </div>
            <div style={{ height: '300px', width: '100%', border: '1px solid #d9d9d9', borderRadius: '6px', overflow: 'hidden' }}>
              <MapContainer center={points[0] || [30.0444, 31.2357]} zoom={11} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler mapMode={mapMode} setPoints={setPoints} setCheckpoints={setCheckpoints} />
                {points.length > 0 && (
                  <Polyline positions={points} color="var(--primary-color)" weight={5} />
                )}
                {points.map((pt, idx) => (
                  <Marker key={`pt-${idx}`} position={pt} />
                ))}
                {checkpoints.map((cp, idx) => {
                  const latLng: [number, number] = [cp.location.coordinates[1], cp.location.coordinates[0]];
                  return (
                    <Marker 
                      key={`cp-${idx}`} 
                      position={latLng}
                      icon={new L.Icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                      })}
                    >
                      <Popup>
                        <strong>{cp.name}</strong> {cp.nameAr && <><br />{cp.nameAr}</>}<br />Order: {cp.order}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {checkpoints.length > 0 && (
            <div style={{ marginTop: '1rem', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '1rem', background: '#fafafa', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Manage Checkpoints ({checkpoints.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {checkpoints.map((cp, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ minWidth: '60px', color: '#888' }}>Order #{cp.order}</span>
                    <Input 
                      value={cp.name} 
                      onChange={(e) => {
                        const updated = [...checkpoints];
                        updated[idx].name = e.target.value;
                        setCheckpoints(updated);
                      }} 
                      style={{ flex: 1 }} 
                      placeholder="Checkpoint Name"
                    />
                    <Input 
                      value={cp.nameAr || ''} 
                      onChange={(e) => {
                        const updated = [...checkpoints];
                        updated[idx].nameAr = e.target.value;
                        setCheckpoints(updated);
                      }} 
                      style={{ flex: 1 }} 
                      placeholder="Name in Arabic (Optional)"
                    />
                    <Button 
                      type="text" 
                      danger 
                      onClick={() => {
                        const updated = checkpoints.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i + 1 }));
                        setCheckpoints(updated);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
