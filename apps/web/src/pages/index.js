import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Server, 
  Key, 
  Activity, 
  Shield, 
  Network, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Monitor,
  Database,
  Globe
} from 'lucide-react';

// Mock data - replace with actual API calls
const mockData = {
  stats: {
    totalUsers: 24,
    activeNodes: 156,
    preAuthKeys: 12,
    onlineDevices: 142
  },
  recentActivity: [
    { id: 1, action: 'User alice@company.com joined', time: '2 minutes ago', type: 'user' },
    { id: 2, action: 'Node laptop-dev-001 went online', time: '5 minutes ago', type: 'node' },
    { id: 3, action: 'Pre-auth key created for contractors', time: '10 minutes ago', type: 'key' },
    { id: 4, action: 'ACL policy updated', time: '15 minutes ago', type: 'acl' }
  ],
  nodes: [
    { id: 1, name: 'laptop-dev-001', user: 'alice@company.com', ip: '100.64.0.2', status: 'online', lastSeen: '1 min ago', tags: ['employee'] },
    { id: 2, name: 'server-prod-db', user: 'system', ip: '100.64.0.10', status: 'online', lastSeen: '30 sec ago', tags: ['server', 'database'] },
    { id: 3, name: 'phone-ios-bob', user: 'bob@company.com', ip: '100.64.0.5', status: 'offline', lastSeen: '2 hours ago', tags: ['employee'] }
  ],
  users: [
    { id: 1, name: 'alice@company.com', nodesCount: 3, lastActive: '1 min ago', role: 'employee' },
    { id: 2, name: 'bob@company.com', nodesCount: 2, lastActive: '2 hours ago', role: 'employee' },
    { id: 3, name: 'contractor@vendor.com', nodesCount: 1, lastActive: '1 day ago', role: 'contractor' }
  ]
};

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(mockData);
  const [loading, setLoading] = useState(false);

  const StatCard = ({ title, value, icon: Icon, trend, color = "blue" }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-blue-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-gray-500">{trend}</p>
        )}
      </CardContent>
    </Card>
  );

  const ActivityItem = ({ activity }) => {
    const getIcon = (type) => {
      switch(type) {
        case 'user': return <Users className="h-4 w-4" />;
        case 'node': return <Server className="h-4 w-4" />;
        case 'key': return <Key className="h-4 w-4" />;
        case 'acl': return <Shield className="h-4 w-4" />;
        default: return <Activity className="h-4 w-4" />;
      }
    };

    return (
      <div className="flex items-center space-x-3 p-3 rounded-lg border">
        <div className="flex-shrink-0">
          {getIcon(activity.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {activity.action}
          </p>
          <p className="text-sm text-gray-500">{activity.time}</p>
        </div>
      </div>
    );
  };

  const NodesList = () => (
    <div className="space-y-3">
      {data.nodes.map((node) => (
        <Card key={node.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium">{node.name}</h4>
                <p className="text-sm text-gray-500">{node.user}</p>
                <p className="text-sm text-gray-500">{node.ip}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={node.status === 'online' ? 'default' : 'secondary'}>
                  {node.status}
                </Badge>
                <span className="text-xs text-gray-500">{node.lastSeen}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {node.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Headscale Admin Dashboard</h1>
          <p className="text-gray-600">Manage your Tailscale network infrastructure</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="nodes">Nodes</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Users" value={data.stats.totalUsers} icon={Users} />
              <StatCard title="Active Nodes" value={data.stats.activeNodes} icon={Server} />
              <StatCard title="Pre-auth Keys" value={data.stats.preAuthKeys} icon={Key} />
              <StatCard title="Online Devices" value={data.stats.onlineDevices} icon={Network} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest network events and changes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.recentActivity.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common administrative tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start">
                    <Users className="mr-2 h-4 w-4" />
                    Add New User
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Key className="mr-2 h-4 w-4" />
                    Generate Auth Key
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Shield className="mr-2 h-4 w-4" />
                    Update ACL Policy
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="nodes" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Network Nodes</h2>
              <Button>
                <Server className="mr-2 h-4 w-4" />
                Add Node
              </Button>
            </div>
            <NodesList />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Users</h2>
              <Button>
                <Users className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.users.map((user) => (
                <Card key={user.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <CardDescription>{user.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Nodes:</span>
                        <span className="font-medium">{user.nodesCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Last Active:</span>
                        <span className="font-medium">{user.lastActive}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure your Headscale instance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">OIDC Authentication</h4>
                    <p className="text-sm text-gray-500">Configure OpenID Connect for SSO</p>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">API Access</h4>
                    <p className="text-sm text-gray-500">Manage API keys and permissions</p>
                  </div>
                  <Button variant="outline">Manage</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Backup & Restore</h4>
                    <p className="text-sm text-gray-500">Configure automated backups</p>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;