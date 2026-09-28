import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plane, 
  Package, 
  DollarSign, 
  Star, 
  Clock, 
  MapPin,
  Plus,
  Activity,
  TrendingUp,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalSpent: 0,
    activeTrips: 0,
    activeShipments: 0,
    completedDeliveries: 0,
    averageRating: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [tripsRes, shipmentsRes, matchesRes] = await Promise.all([
        axios.get('/trips/my'),
        axios.get('/shipments/my'),
        axios.get('/matches/my')
      ]);

      setTrips(tripsRes.data);
      setShipments(shipmentsRes.data);
      setMatches(matchesRes.data);
      
      // Calculate stats
      const activeTrips = tripsRes.data.filter(t => t.status === 'active').length;
      const activeShipments = shipmentsRes.data.filter(s => s.status === 'pending').length;
      const completedMatches = matchesRes.data.filter(m => m.status === 'completed').length;
      
      setStats({
        totalEarnings: user.role === 'traveler' ? matchesRes.data.reduce((acc, m) => acc + (m.status === 'completed' ? m.price_agreed : 0), 0) : 0,
        totalSpent: user.role === 'sender' ? matchesRes.data.reduce((acc, m) => acc + (m.status === 'completed' ? m.price_agreed : 0), 0) : 0,
        activeTrips,
        activeShipments,
        completedDeliveries: completedMatches,
        averageRating: user.rating || 0
      });
      
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      active: 'status-active',
      pending: 'status-pending',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    };
    return statusMap[status] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 fade-in">
      
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome back, {user.full_name}! 👋
        </h1>
        <p className="text-gray-600">
          {user.role === 'traveler' 
            ? 'Ready to help deliver packages on your next journey?' 
            : 'Need to send a package? Find trusted travelers in your area.'
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user.role === 'traveler' ? 'Total Earnings' : 'Total Spent'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${user.role === 'traveler' ? stats.totalEarnings.toFixed(2) : stats.totalSpent.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user.role === 'traveler' ? 'Active Trips' : 'Active Shipments'}
            </CardTitle>
            {user.role === 'traveler' ? 
              <Plane className="h-4 w-4 text-blue-600" /> : 
              <Package className="h-4 w-4 text-purple-600" />
            }
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.role === 'traveler' ? stats.activeTrips : stats.activeShipments}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Deliveries</CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedDeliveries}</div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {stats.averageRating.toFixed(1)}
              <Star className="h-5 w-5 text-yellow-400 ml-1 fill-current" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.role === 'traveler' ? (
              <Button 
                onClick={() => navigate('/create-trip')}
                className="w-full btn-primary text-white"
              >
                <Plane className="h-4 w-4 mr-2" />
                Post a New Trip
              </Button>
            ) : (
              <Button 
                onClick={() => navigate('/create-shipment')}
                className="w-full btn-primary text-white"
              >
                <Package className="h-4 w-4 mr-2" />
                Post a New Shipment
              </Button>
            )}
            <Button 
              onClick={() => navigate('/marketplace')}
              variant="outline"
              className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              Browse Marketplace
            </Button>
            <Button 
              onClick={() => navigate('/messages')}
              variant="outline"
              className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              View Messages
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length > 0 ? (
              <div className="space-y-3">
                {matches.slice(0, 3).map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Match #{match.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500">${match.price_agreed}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusBadgeClass(match.status)} text-white text-xs`}>
                      {match.status}
                    </Badge>
                  </div>
                ))}
                <div className="text-center pt-2">
                  <Button variant="ghost" size="sm" className="text-orange-600">
                    View All Activity
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
                <p className="text-sm">Start by creating your first {user.role === 'traveler' ? 'trip' : 'shipment'}!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Tables */}
      <Tabs defaultValue={user.role === 'traveler' ? 'trips' : 'shipments'} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            My Trips
          </TabsTrigger>
          <TabsTrigger value="shipments" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            My Shipments
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="trips" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>My Trips</CardTitle>
              <CardDescription>
                Manage your travel routes and available space
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trips.length > 0 ? (
                <div className="space-y-4">
                  {trips.map((trip) => (
                    <div key={trip.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">
                              {trip.origin.address} → {trip.destination.address}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(trip.departure_date)}
                            </span>
                            <span>{trip.available_weight}kg available</span>
                            <span>${trip.price_per_kg}/kg</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getStatusBadgeClass(trip.status)} text-white`}>
                            {trip.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Plane className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No trips posted yet</p>
                  <Button 
                    onClick={() => navigate('/create-trip')}
                    className="mt-4 btn-primary text-white"
                  >
                    Post Your First Trip
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="shipments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>My Shipments</CardTitle>
              <CardDescription>
                Track your package delivery requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shipments.length > 0 ? (
                <div className="space-y-4">
                  {shipments.map((shipment) => (
                    <div key={shipment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">
                              {shipment.origin.address} → {shipment.destination.address}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(shipment.pickup_date)}
                            </span>
                            <span>{shipment.weight}kg</span>
                            <span>${shipment.declared_value} value</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{shipment.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getStatusBadgeClass(shipment.status)} text-white`}>
                            {shipment.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No shipments posted yet</p>
                  <Button 
                    onClick={() => navigate('/create-shipment')}
                    className="mt-4 btn-primary text-white"
                  >
                    Post Your First Shipment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;