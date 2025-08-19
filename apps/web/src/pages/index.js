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
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl mx-auto mb-6 flex items-center justify-center animate-pulse-soft">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Loading Dashboard...</h2>
          <div className="flex justify-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend, color = "blue" }) => {
    const colorMap = {
      blue: {
        icon: 'text-blue-600',
        bg: 'bg-blue-50',
        trend: 'text-blue-700',
        border: 'border-blue-200'
      },
      green: {
        icon: 'text-green-600',
        bg: 'bg-green-50',
        trend: 'text-green-700',
        border: 'border-green-200'
      },
      orange: {
        icon: 'text-orange-600',
        bg: 'bg-orange-50',
        trend: 'text-orange-700',
        border: 'border-orange-200'
      },
      purple: {
        icon: 'text-purple-600',
        bg: 'bg-purple-50',
        trend: 'text-purple-700',
        border: 'border-purple-200'
      }
    };
    
    const colors = colorMap[color];
    
    return (
      <Card className={`hover:shadow-xl hover:scale-105 transition-all duration-300 ${colors.border} border-2 hover:border-opacity-60`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
          {trend && (
            <p className={`text-sm font-medium ${colors.trend}`}>{trend}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const ActivityItem = ({ activity }) => {
    const getIcon = (type) => {
      const iconProps = "h-5 w-5";
      switch(type) {
        case 'user': return { icon: <Users className={iconProps} />, color: 'bg-blue-100 text-blue-600' };
        case 'node': return { icon: <Server className={iconProps} />, color: 'bg-green-100 text-green-600' };
        case 'key': return { icon: <Key className={iconProps} />, color: 'bg-orange-100 text-orange-600' };
        case 'acl': return { icon: <Shield className={iconProps} />, color: 'bg-purple-100 text-purple-600' };
        default: return { icon: <Activity className={iconProps} />, color: 'bg-gray-100 text-gray-600' };
      }
    };
    
    const { icon, color } = getIcon(activity.type);

    return (
      <div className="flex items-center space-x-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 group">
        <div className={`flex-shrink-0 p-2 rounded-lg ${color} group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700 transition-colors">
            {activity.action}
          </p>
          <p className="text-sm text-gray-500 font-medium">{activity.time}</p>
        </div>
      </div>
    );
  };

  const NodesList = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {data.nodes.map((node, index) => (
        <Card key={node.id} className="hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-lg text-gray-900 truncate">{node.name}</h4>
                <p className="text-sm text-gray-600 font-medium truncate">{node.user}</p>
                <p className="text-sm text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded mt-1 inline-block">{node.ip}</p>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <Badge 
                  variant={node.status === 'online' ? 'default' : 'secondary'}
                  className={`font-semibold px-3 py-1 ${
                    node.status === 'online' 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  {node.status === 'online' && <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />}
                  {node.status}
                </Badge>
                <span className="text-xs text-gray-500 font-medium">{node.lastSeen}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {node.tags.map((tag, tagIndex) => (
                <Badge key={tagIndex} variant="outline" className="text-xs font-medium px-2 py-1 bg-gray-50 hover:bg-gray-100 transition-colors">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 safe-padding-y">
      <div className="container-wide py-6 sm:py-8 lg:py-12">
        {/* Enhanced mobile-friendly header */}
        <div className="mb-6 sm:mb-8 lg:mb-12 text-center lg:text-left animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-8">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                {isMobile ? 'Headscale Admin' : 'Headscale Admin Dashboard'}
              </h1>
              <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {isMobile ? 'Manage your network' : 'Manage your Tailscale network infrastructure with ease'}
              </p>
            </div>
            
            {/* Quick status indicator */}
            <div className="flex items-center justify-center lg:justify-end gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold shadow-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline">All Systems Operational</span>
                <span className="sm:hidden">Online</span>
              </div>
              
              {!isMobile && (
                <button className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 group">
                  <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
                </button>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up">
          <TabsList className="mb-8">
            <TabsTrigger value="overview">📊 Overview</TabsTrigger>
            <TabsTrigger value="nodes">🖥️ Nodes</TabsTrigger>
            <TabsTrigger value="users">👥 Users</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              <StatCard 
                title="Total Users" 
                value={data.stats.totalUsers} 
                icon={Users} 
                trend="+12% this month"
                color="blue"
              />
              <StatCard 
                title="Active Nodes" 
                value={data.stats.activeNodes} 
                icon={Server} 
                trend="+8% this week"
                color="green"
              />
              <StatCard 
                title="Pre-auth Keys" 
                value={data.stats.preAuthKeys} 
                icon={Key} 
                trend="2 expiring soon"
                color="orange"
              />
              <StatCard 
                title="Online Devices" 
                value={data.stats.onlineDevices} 
                icon={Network} 
                trend="91% uptime"
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Recent Activity
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600">
                    Latest network events and changes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.recentActivity.map((activity, index) => (
                    <div key={activity.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                      <ActivityItem activity={activity} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    ⚡ Quick Actions
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600">
                    Common administrative tasks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full justify-start h-12 text-base font-semibold hover:scale-105 transition-transform duration-200">
                    <Users className="mr-3 h-5 w-5" />
                    Add New User
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-12 text-base font-semibold hover:scale-105 transition-transform duration-200 border-2">
                    <Key className="mr-3 h-5 w-5" />
                    Generate Auth Key
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-12 text-base font-semibold hover:scale-105 transition-transform duration-200 border-2">
                    <Shield className="mr-3 h-5 w-5" />
                    Update ACL Policy
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="nodes" className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Network Nodes</h2>
                <p className="text-gray-600 mt-1">Manage and monitor your connected devices</p>
              </div>
              <Button className="w-full sm:w-auto h-12 px-6 text-base font-semibold hover:scale-105 transition-transform duration-200">
                <Server className="mr-3 h-5 w-5" />
                Add Node
              </Button>
            </div>
            <NodesList />
          </TabsContent>

          <TabsContent value="users" className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Users</h2>
                <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
              </div>
              <Button className="w-full sm:w-auto h-12 px-6 text-base font-semibold hover:scale-105 transition-transform duration-200">
                <Users className="mr-3 h-5 w-5" />
                Add User
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {data.users.map((user, index) => (
                <Card key={user.id} className="hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-gray-900 truncate">{user.name}</CardTitle>
                    <CardDescription className="text-base font-medium">
                      <Badge 
                        variant="outline" 
                        className={`${
                          user.role === 'employee' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}
                      >
                        {user.role}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-600">Nodes:</span>
                        <span className="font-bold text-lg text-gray-900">{user.nodesCount}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-600">Last Active:</span>
                        <span className="font-semibold text-sm text-gray-700">{user.lastActive}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-8">
            <div className="mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-1">Configure your Headscale instance</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    🔐 Authentication
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600">
                    Security and access configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">OIDC Authentication</h4>
                      <p className="text-sm text-gray-600 mt-1">Configure OpenID Connect for SSO</p>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto font-semibold hover:scale-105 transition-transform duration-200">
                      Configure
                    </Button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">API Access</h4>
                      <p className="text-sm text-gray-600 mt-1">Manage API keys and permissions</p>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto font-semibold hover:scale-105 transition-transform duration-200">
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    💾 System
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600">
                    Backup and system maintenance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">Backup & Restore</h4>
                      <p className="text-sm text-gray-600 mt-1">Configure automated backups</p>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto font-semibold hover:scale-105 transition-transform duration-200">
                      Configure
                    </Button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">System Health</h4>
                      <p className="text-sm text-gray-600 mt-1">Monitor system performance</p>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto font-semibold hover:scale-105 transition-transform duration-200">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;