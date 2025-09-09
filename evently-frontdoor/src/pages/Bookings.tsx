import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Ticket, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { bookings, Booking, ApiError, BookingStatus } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function Bookings() {
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const prevBookingsRef = useRef<Booking[]>([]);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchBookings();
      
      // Set up polling for auto-promotion
      const interval = setInterval(() => {
        fetchBookings(true); // Silent fetch for polling
      }, 15000); // Poll every 15 seconds

      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchBookings = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await bookings.list();
      // Sort by created_at descending (most recent first)
      const sortedBookings = response.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Check for auto-promotions (WAITLISTED -> CONFIRMED)
      if (prevBookingsRef.current.length > 0) {
        const prevBookingsMap = new Map(prevBookingsRef.current.map(b => [b.id, b]));
        
        sortedBookings.forEach(currentBooking => {
          const prevBooking = prevBookingsMap.get(currentBooking.id);
          if (prevBooking && 
              prevBooking.status === 'WAITLISTED' && 
              currentBooking.status === 'CONFIRMED') {
            toast({
              title: "Booking confirmed!",
              description: `Your waitlisted booking for '${currentBooking.event?.name}' is now confirmed.`,
            });
          }
        });
      }

      prevBookingsRef.current = sortedBookings;
      setUserBookings(sortedBookings);
    } catch (error) {
      if (error instanceof ApiError && !silent) {
        toast({
          title: "Error loading bookings",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    const booking = userBookings.find(b => b.id === bookingId);
    setCancellingId(bookingId);
    try {
      await bookings.cancel(bookingId);
      
      // Update the booking status locally
      setUserBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: 'CANCELLED' }
            : booking
        )
      );

      toast({
        title: "Booking cancelled",
        description: "Your booking has been successfully cancelled.",
      });

      // If on event page, trigger seat refresh by dispatching a custom event
      if (booking && window.location.pathname.includes('/events/')) {
        window.dispatchEvent(new CustomEvent('bookingCancelled', { 
          detail: { eventId: booking.event_id } 
        }));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Cancellation failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), 'MMM d, yyyy • h:mm a');
  };

  const getStatusBadge = (status: BookingStatus) => {
    const variants = {
      'CONFIRMED': 'default',
      'WAITLISTED': 'secondary',
      'CANCELLED': 'outline'
    } as const;

    const colors = {
      'CONFIRMED': 'status-confirmed',
      'WAITLISTED': 'bg-amber-500 text-amber-50 hover:bg-amber-600',
      'CANCELLED': 'status-cancelled'
    } as const;

    return (
      <Badge 
        variant={variants[status]}
        className={colors[status]}
      >
        {status.toLowerCase()}
      </Badge>
    );
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Ticket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Please log in</h1>
          <p className="text-muted-foreground mb-6">You need to be logged in to view your bookings.</p>
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">Manage your event tickets and reservations</p>
        </div>
        <Button onClick={() => fetchBookings()} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-3 flex-1">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-10 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : userBookings.length > 0 ? (
        <div className="space-y-4">
          {userBookings.map((booking) => (
            <Card key={booking.id} className="animate-fade-in">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        {booking.event?.name || `Event #${booking.event_id}`}
                      </h3>
                      {getStatusBadge(booking.status)}
                    </div>
                    
                    {booking.event && (
                      <>
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span>{booking.event.venue}</span>
                        </div>
                        
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>{formatDateTime(booking.event.start_time)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div className="flex items-center text-muted-foreground">
                        <Ticket className="h-4 w-4 mr-1" />
                        <span>{booking.qty} ticket{booking.qty > 1 ? 's' : ''}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Booked: {formatDateTime(booking.created_at)}
                      </div>
                    </div>

                    {/* Seat Labels */}
                    {booking.seat_labels && booking.seat_labels.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">Seats:</h5>
                        <div className="flex flex-wrap gap-2">
                          {booking.seat_labels.map((seatLabel, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {seatLabel}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {booking.event && (
                      <Button variant="outline" asChild>
                        <Link to={`/events/${booking.event_id}`}>
                          View Event
                        </Link>
                      </Button>
                    )}
                    
                    {(booking.status === 'CONFIRMED' || booking.status === 'WAITLISTED') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cancellingId === booking.id}
                          >
                            {cancellingId === booking.id ? (
                              'Cancelling...'
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {booking.status === 'CONFIRMED' ? 'Cancel Booking' : 'Leave Waitlist'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to {booking.status === 'CONFIRMED' ? 'cancel this booking' : 'leave the waitlist'} for "{booking.event?.name}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep {booking.status === 'CONFIRMED' ? 'Booking' : 'Waitlist'}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancelBooking(booking.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              {booking.status === 'CONFIRMED' ? 'Cancel Booking' : 'Leave Waitlist'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Ticket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
            <p className="text-muted-foreground mb-6">
              You haven't made any bookings yet. Discover amazing events to get started!
            </p>
            <Button asChild>
              <Link to="/events">Browse Events</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {userBookings.length > 0 && (
        <Card className="bg-gradient-card">
          <CardHeader>
            <CardTitle className="text-lg">Booking Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{userBookings.length}</div>
                <div className="text-sm text-muted-foreground">Total Bookings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">
                  {userBookings.filter(b => b.status === 'CONFIRMED').length}
                </div>
                <div className="text-sm text-muted-foreground">Confirmed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">
                  {userBookings.filter(b => b.status === 'WAITLISTED').length}
                </div>
                <div className="text-sm text-muted-foreground">Waitlisted</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">
                  {userBookings.filter(b => b.status === 'CANCELLED').length}
                </div>
                <div className="text-sm text-muted-foreground">Cancelled</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {userBookings.reduce((sum, b) => sum + b.qty, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Tickets</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}