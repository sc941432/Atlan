import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, MapPin, Users, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { events, Event, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function Events() {
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [sort, setSort] = useState<'name' | 'start_time' | 'utilization'>('start_time');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);

  const { toast } = useToast();

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await events.list({
        page,
        page_size: pageSize,
        q: search || undefined,
        venue: venue || undefined,
        status: status === 'all' ? undefined : status,
        sort,
        order,
      });
      setEventsList(response.items);
      setTotal(response.meta.total);
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error loading events",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, pageSize, search, venue, status, sort, order]);

  const handleSearch = () => {
    setPage(1);
    fetchEvents();
  };

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), 'MMM d, yyyy • h:mm a');
  };

  const getStatusBadge = (eventStatus: string) => {
    return (
      <Badge 
        variant={eventStatus === 'active' ? 'default' : 'secondary'}
        className={eventStatus === 'active' ? 'status-active' : 'status-inactive'}
      >
        {eventStatus}
      </Badge>
    );
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'text-destructive';
    if (utilization >= 60) return 'text-warning';
    return 'text-success';
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
          Discover Amazing Events
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Find and book tickets for the best events happening around you
        </p>
      </div>

      {/* Filters */}
      <Card className="card-gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Venue</label>
              <Input
                placeholder="Venue location..."
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort by</label>
              <Select value={`${sort}-${order}`} onValueChange={(value) => {
                const [sortField, sortOrder] = value.split('-');
                setSort(sortField as any);
                setOrder(sortOrder as any);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="start_time-asc">Date (earliest)</SelectItem>
                  <SelectItem value="start_time-desc">Date (latest)</SelectItem>
                  <SelectItem value="utilization-desc">Most popular</SelectItem>
                  <SelectItem value="utilization-asc">Least popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Events
            </Button>
            <div className="text-sm text-muted-foreground">
              {total} events found
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : eventsList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {eventsList.map((event) => (
            <Card key={event.id} className="group overflow-hidden hover:shadow-custom-lg transition-all duration-base animate-fade-in">
              <CardContent className="p-0">
                <div className="h-48 bg-gradient-to-br from-primary-light to-accent relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-4 right-4">
                    {getStatusBadge(event.status)}
                  </div>
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="font-semibold text-lg line-clamp-2">{event.name}</h3>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="truncate">{event.venue}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>{formatDateTime(event.start_time)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{event.booked_count}/{event.capacity}</span>
                    </div>
                    {event.utilization_pct !== undefined && (
                      <div className={`flex items-center ${getUtilizationColor(event.utilization_pct)}`}>
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span>{event.utilization_pct.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  {event.waitlisted_count > 0 && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        Waitlist: {event.waitlisted_count}
                      </Badge>
                    </div>
                  )}

                  <Button asChild className="w-full group-hover:shadow-glow transition-all duration-base">
                    <Link to={`/events/${event.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events found</h3>
            <p className="text-muted-foreground">Try adjusting your search filters to find more events.</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select value={String(pageSize)} onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="px-2">...</span>
                  <Button
                    variant={page === totalPages ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}