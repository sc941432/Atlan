import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Calendar, Users, Target, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { adminAnalytics, AnalyticsSummary, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [isAdmin]);

  const fetchAnalytics = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const data = await adminAnalytics.getSummary(refresh);
      setAnalytics(data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error loading analytics",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), 'MMM d, yyyy • h:mm a');
  };

  const formatChartDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d');
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge 
        variant={status === 'active' ? 'default' : 'secondary'}
        className={status === 'active' ? 'status-active' : 'status-inactive'}
      >
        {status}
      </Badge>
    );
  };

  // Prepare chart data
  const chartData = analytics?.timeseries_7d.bookings.map(booking => {
    const cancellation = analytics.timeseries_7d.cancellations.find(c => c.date === booking.date);
    return {
      date: booking.date,
      bookings: booking.count,
      cancellations: cancellation?.count || 0,
      net: booking.count - (cancellation?.count || 0),
    };
  }) || [];

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            {analytics && (
              <>Generated on {formatDateTime(analytics.generated_at)}</>
            )}
          </p>
        </div>
        
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-80 w-full" />
            </CardContent>
          </Card>

          {/* Table Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : analytics ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="bg-gradient-card">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="ml-2">
                    <div className="text-2xl font-bold">{analytics.totals.events}</div>
                    <div className="text-xs text-muted-foreground">Total Events</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Activity className="h-4 w-4 text-success" />
                  <div className="ml-2">
                    <div className="text-2xl font-bold text-success">{analytics.totals.active_events}</div>
                    <div className="text-xs text-muted-foreground">Active Events</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="ml-2">
                    <div className="text-2xl font-bold">{analytics.totals.capacity.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Capacity</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Target className="h-4 w-4 text-primary" />
                  <div className="ml-2">
                    <div className="text-2xl font-bold text-primary">{analytics.totals.booked.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Tickets Booked</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <div className="ml-2">
                    <div className="text-2xl font-bold text-warning">
                      {analytics.totals.utilization_pct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Utilization</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 7-Day Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                7-Day Booking Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatChartDate}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => formatChartDate(String(value))}
                    formatter={(value, name) => {
                      const labels = {
                        bookings: 'Bookings',
                        cancellations: 'Cancellations', 
                        net: 'Net Bookings'
                      };
                      return [value, labels[name as keyof typeof labels] || name];
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="bookings" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2} 
                    name="Bookings"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cancellations" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2} 
                    name="Cancellations"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    name="Net Bookings"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Events Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top Events by Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.top_events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Booked</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.top_events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{event.name}</div>
                            <div className="text-sm text-muted-foreground">{event.venue}</div>
                          </div>
                        </TableCell>
                        <TableCell>{event.capacity}</TableCell>
                        <TableCell>{event.booked_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold">
                              {event.utilization_pct?.toFixed(1)}%
                            </div>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, event.utilization_pct || 0)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(event.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No events data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Events Overview */}
          <Card>
            <CardHeader>
              <CardTitle>All Events Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Booked</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{event.name}</div>
                            <div className="text-sm text-muted-foreground">{event.venue}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateTime(event.start_time)}
                        </TableCell>
                        <TableCell>{event.capacity}</TableCell>
                        <TableCell>{event.booked_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium">
                              {event.utilization_pct?.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(event.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No events found
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}