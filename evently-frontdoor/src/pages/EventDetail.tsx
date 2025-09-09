import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock, TrendingUp, Ticket, ArrowLeft, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { events, bookings, Event, Booking, Seat, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { SeatPicker } from '@/components/SeatPicker';
import { BookingCelebration } from '@/components/BookingCelebration';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hasSeats, setHasSeats] = useState<boolean>(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [joinWaitlist, setJoinWaitlist] = useState(false);
  const [bookingKey, setBookingKey] = useState<string>('');
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    eventName: string;
    ticketCount: number;
    seatLabels?: string[];
  } | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Calculate event status values
  const availableTickets = event ? Math.max(0, event.capacity - event.booked_count) : 0;
  const utilizationPercent = event ? Math.round((event.booked_count / event.capacity) * 100) : 0;
  const isFull = event ? event.booked_count >= event.capacity : false;
  
  // Calculate maximum bookable quantity
  const availableSeats = seats.filter(s => !s.reserved).length;
  const maxQuantity = hasSeats && seats.length > 0 ? 
    Math.min(10, availableSeats) : 
    // Allow quantity selection even if event is full (for waitlist)
    Math.min(10, Math.max(1, availableTickets));
  
  // Calculate user's current bookings for this event
  const userEventBookings = userBookings.filter(booking => booking.event_id === event?.id);
  const userConfirmedTickets = userEventBookings.filter(b => b.status === 'CONFIRMED').reduce((sum, b) => sum + b.qty, 0);
  const userWaitlistedTickets = userEventBookings.filter(b => b.status === 'WAITLISTED').reduce((sum, b) => sum + b.qty, 0);

  useEffect(() => {
    if (id) {
      fetchEvent();
      fetchSeats();
    }
    if (user) {
      fetchUserBookings();
    }
  }, [id, user]);

  useEffect(() => {
    console.log('EventDetail state update:', { 
      hasSeats, 
      seatsLength: seats.length, 
      selectedSeatIds, 
      quantity,
      isBooking,
      user: !!user 
    });
  }, [hasSeats, seats.length, selectedSeatIds, quantity, isBooking, user]);

  // Set default waitlist when event is full
  useEffect(() => {
    if (event && isFull) {
      setJoinWaitlist(true);
    }
  }, [event, isFull]);

  const fetchEvent = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      const eventData = await events.getById(Number(id));
      setEvent(eventData);
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error loading event",
          description: error.message,
          variant: "destructive",
        });
        if (error.status === 404) {
          navigate('/events');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSeats = async () => {
    if (!id) return;
    
    console.log('Fetching seats for event:', id);
    try {
      const seatsData = await events.getSeats(Number(id));
      console.log('Seats fetched successfully:', seatsData);
      
      // Backend uses lazy seat creation - seats are created on first booking
      if (seatsData && seatsData.length > 0) {
        setSeats(seatsData);
        setHasSeats(true);
        console.log('Seat map available with', seatsData.length, 'seats (seats were created on first booking)');
      } else {
        console.log('No seats yet - will be created on first booking, using quantity-only booking');
        setHasSeats(false);
        setSeats([]);
      }
    } catch (error) {
      console.log('Seats fetch error:', error);
      if (error instanceof ApiError && error.status === 404) {
        // No seat map available yet - seats will be created lazily on first booking
        console.log('No seat map yet (404) - seats will be created on first booking');
        setHasSeats(false);
        setSeats([]);
      } else {
        console.warn('Failed to fetch seats:', error);
        setHasSeats(false);
        setSeats([]);
      }
    }
  };

  const fetchUserBookings = async () => {
    if (!user) return;
    
    try {
      const userBookingsData = await bookings.list();
      setUserBookings(userBookingsData);
    } catch (error) {
      // Silent fail for user bookings - not critical for event display
      console.warn('Failed to fetch user bookings:', error);
    }
  };

  const handleBooking = async () => {
    if (!event || !user) {
      navigate('/login', { state: { from: { pathname: `/events/${id}` } } });
      return;
    }

    if (event.status !== 'active') {
      toast({
        title: "Event not available",
        description: "This event is not currently active for booking.",
        variant: "destructive",
      });
      return;
    }

    // Validate seat selection if seats are available (but not for waitlist)
    if (hasSeats && selectedSeatIds.length !== quantity && !joinWaitlist) {
      toast({
        title: "Seat selection required",
        description: `Please select exactly ${quantity} seat${quantity > 1 ? 's' : ''} before booking.`,
        variant: "destructive",
      });
      return;
    }

    const availableSpots = event.capacity - event.booked_count;
    const isFull = availableSpots === 0;

    setIsBooking(true);

    try {
      // Generate new idempotency key for each attempt
      let currentKey = crypto.randomUUID();

      // Prepare booking data
      const bookingData: { qty: number; waitlist?: boolean; seat_ids?: number[] } = { 
        qty: quantity 
      };
      
      // Add seat_ids if seats are available and not joining waitlist
      if (hasSeats && selectedSeatIds.length > 0 && !joinWaitlist) {
        bookingData.seat_ids = selectedSeatIds;
      }
      
      // If waitlist is checked and no seats available, force waitlist booking
      if (joinWaitlist && ((hasSeats && availableSeats === 0) || (!hasSeats && availableTickets < quantity))) {
        bookingData.waitlist = true;
      }

      try {
        const booking = await events.book(event.id, bookingData, currentKey);
        
        if (booking.status === 'CONFIRMED') {
          // Show celebration animation
          setCelebrationData({
            eventName: event.name,
            ticketCount: quantity,
            seatLabels: booking.seat_labels || undefined
          });
          setShowCelebration(true);
          
          toast({
            title: "Booking confirmed!",
            description: `Successfully booked ${quantity} ticket${quantity > 1 ? 's' : ''} for ${event.name}.`,
          });
        } else if (booking.status === 'WAITLISTED') {
          toast({
            title: "Added to waitlist",
            description: `You've been added to the waitlist for ${quantity} ticket${quantity > 1 ? 's' : ''}.`,
          });
        }

        // Refresh event data and user bookings
        fetchEvent();
        fetchUserBookings();
        // Always refresh seats - they might have been created if this was the first booking
        fetchSeats();
        
        // Reset booking state
        setQuantity(1);
        setSelectedSeatIds([]);
        setJoinWaitlist(false);
        setBookingKey('');

        // Offer to view bookings
        setTimeout(() => {
          toast({
            title: "View your bookings",
            description: "Check all your bookings in My Bookings.",
            action: (
              <Button variant="outline" size="sm" asChild>
                <Link to="/bookings">View Bookings</Link>
              </Button>
            ),
          });
        }, 2000);

      } catch (firstError) {
        // If 409 (seat taken / capacity exceeded), refresh seats and show error
        if (firstError instanceof ApiError && firstError.status === 409) {
          if (hasSeats) {
            await fetchSeats(); // Refresh seat map
            toast({
              title: "Seats unavailable",
              description: "Some selected seats were taken. Please select different seats and try again.",
              variant: "destructive",
            });
            setSelectedSeatIds([]); // Clear selection
          } else if (joinWaitlist) {
            // Try waitlist for qty-only booking
            currentKey = crypto.randomUUID(); // New key for retry
            const waitlistData = { qty: quantity, waitlist: true };
            const waitlistBooking = await events.book(event.id, waitlistData, currentKey);
            
            toast({
              title: "Added to waitlist",
              description: `You've been added to the waitlist for ${quantity} ticket${quantity > 1 ? 's' : ''}.`,
            });

            // Refresh event data and user bookings
            fetchEvent();
            fetchUserBookings();
            // Refresh seats in case they were created by this waitlist booking
            fetchSeats();
            
            // Reset booking state
            setQuantity(1);
            setSelectedSeatIds([]);
            setJoinWaitlist(false);
            setBookingKey('');
          } else {
            throw firstError; // Re-throw if not waitlist attempt
          }
        } else {
          throw firstError; // Re-throw if not a 409 error
        }
      }

    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          toast({
            title: hasSeats ? "Seats unavailable" : "Event is full", 
            description: hasSeats 
              ? "Selected seats are no longer available. Please choose different seats."
              : "This event is fully booked and you didn't opt for the waitlist.",
            variant: "destructive",
          });
          fetchEvent(); // Refresh to show updated numbers
          if (hasSeats) {
            fetchSeats(); // Refresh seat map
            setSelectedSeatIds([]); // Clear selection
          }
        } else if (error.status === 401) {
          navigate('/login', { state: { from: { pathname: `/events/${id}` } } });
        } else {
          toast({
            title: "Booking failed",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    } finally {
      setIsBooking(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), 'EEEE, MMMM d, yyyy • h:mm a');
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Event not found</h1>
          <Button asChild>
            <Link to="/events">Back to Events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="flex items-center gap-2">
          <Link to="/events">
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Link>
        </Button>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{event.name}</h1>
                {getStatusBadge(event.status)}
              </div>
              
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{event.venue}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTime(event.start_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(event.start_time, event.end_time)}</span>
                </div>
              </div>
            </div>

            {/* Event Image Placeholder */}
            <div className="h-64 bg-gradient-to-br from-primary-light to-accent rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Ticket className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">{event.name}</p>
                <p className="text-sm">Event Details</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{event.capacity}</div>
                  <div className="text-sm text-muted-foreground">Total Capacity</div>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-success">{event.booked_count}</div>
                  <div className="text-sm text-muted-foreground">Booked</div>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-warning">{availableTickets}</div>
                  <div className="text-sm text-muted-foreground">Available</div>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-amber-600">{event.waitlisted_count || 0}</div>
                  <div className="text-sm text-muted-foreground">Waitlisted</div>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-2xl font-bold">{utilizationPercent}%</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Utilization</div>
                </CardContent>
              </Card>
            </div>

            {/* Event Description */}
            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p className="text-muted-foreground">
                  Join us for {event.name} at {event.venue}. This exciting event will take place on{' '}
                  {formatDateTime(event.start_time)} and promises to be an unforgettable experience.
                </p>
                <p className="text-muted-foreground mt-4">
                  With a capacity of {event.capacity} attendees, this event offers a perfect blend of 
                  entertainment and networking opportunities. Don't miss out on this amazing experience!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Booking Widget */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8 card-gradient shadow-custom-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Book Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {event.status !== 'active' ? (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-muted-foreground">This event is not currently available for booking.</p>
                  </div>
                ) : (
                  <>
                    {/* Quantity Selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Number of Tickets</label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newQty = Math.max(1, quantity - 1);
                            setQuantity(newQty);
                            if (hasSeats && selectedSeatIds.length > newQty) {
                              setSelectedSeatIds(selectedSeatIds.slice(0, newQty));
                            }
                          }}
                          disabled={quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max={maxQuantity}
                          value={quantity}
                          onChange={(e) => {
                            const newQty = Math.max(1, Math.min(maxQuantity, Number(e.target.value)));
                            setQuantity(newQty);
                            if (hasSeats && selectedSeatIds.length > newQty) {
                              setSelectedSeatIds(selectedSeatIds.slice(0, newQty));
                            }
                          }}
                          className="text-center w-20"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newQty = Math.min(maxQuantity, quantity + 1);
                            setQuantity(newQty);
                          }}
                          disabled={quantity >= maxQuantity || maxQuantity === 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hasSeats && seats.length > 0 ? 
                          `${availableSeats} seat${availableSeats !== 1 ? 's' : ''} available` :
                          isFull ? "Event is full" : `${availableTickets} ticket${availableTickets !== 1 ? 's' : ''} remaining`
                        }
                      </p>
                    </div>

                    {/* Seat Selection or Info */}
                    {(() => {
                      console.log('Seat selection render logic:', {
                        hasSeats,
                        seatsLength: seats.length,
                        seatsData: seats.slice(0, 3) // Log first 3 seats for debugging
                      });
                      
                      if (hasSeats && seats.length > 0) {
                        console.log('Rendering SeatPicker with', seats.length, 'seats');
                        return (
                          <div className="space-y-3">
                            <div className="text-sm font-medium">Select Your Seats</div>
                            <SeatPicker
                              seats={seats}
                              selectedSeatIds={selectedSeatIds}
                              onSeatSelect={setSelectedSeatIds}
                              requiredCount={quantity}
                              disabled={isBooking}
                            />
                          </div>
                        );
                      } else if (hasSeats) {
                        console.log('hasSeats true but no seats data, showing loading');
                        return (
                          <div className="p-4 border border-dashed border-muted-foreground/30 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground">Loading seat map...</p>
                          </div>
                        );
                      } else {
                        console.log('No seat map available, showing quantity-only booking');
                        return event && event.booked_count === 0 ? (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-sm text-blue-900">
                              <div className="font-medium mb-1">First booking for this event</div>
                              <div className="text-blue-700">Seats will be automatically assigned and a seat map will be available for future bookings.</div>
                            </div>
                          </div>
                        ) : null;
                      }
                    })()}

                    {/* Current User Bookings Info */}
                    {user && (userConfirmedTickets > 0 || userWaitlistedTickets > 0) && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Your Current Bookings</h4>
                        <div className="text-sm text-blue-800 space-y-1">
                          {userConfirmedTickets > 0 && (
                            <div className="flex justify-between">
                              <span>Confirmed tickets:</span>
                              <span className="font-medium">{userConfirmedTickets}</span>
                            </div>
                          )}
                          {userWaitlistedTickets > 0 && (
                            <div className="flex justify-between">
                              <span>Waitlisted tickets:</span>
                              <span className="font-medium">{userWaitlistedTickets}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Waitlist Checkbox */}
                    {((hasSeats && availableSeats < quantity) || (!hasSeats && availableTickets < quantity)) && (
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="waitlist" 
                          checked={joinWaitlist}
                          onCheckedChange={(checked) => setJoinWaitlist(checked as boolean)}
                        />
                        <Label htmlFor="waitlist" className="text-sm cursor-pointer">
                          Join waitlist for {quantity} ticket{quantity > 1 ? 's' : ''}
                        </Label>
                      </div>
                    )}

                    {/* Booking Button */}
                    <Button
                      onClick={handleBooking}
                      disabled={(() => {
                        const seatCondition = hasSeats && selectedSeatIds.length !== quantity && !joinWaitlist;
                        const noAvailability = (!hasSeats && availableTickets < quantity && !joinWaitlist) || 
                                             (hasSeats && availableSeats < quantity && !joinWaitlist);
                        const disabled = isBooking || !user || seatCondition || noAvailability;
                        return disabled;
                      })()}
                      className="w-full glow-on-hover"
                      size="lg"
                    >
                      {isBooking ? (
                        'Processing...'
                      ) : !user ? (
                        'Login to Book'
                      ) : hasSeats && selectedSeatIds.length !== quantity && !joinWaitlist ? (
                        `Select ${quantity} Seat${quantity > 1 ? 's' : ''}`
                      ) : (hasSeats && availableSeats < quantity && !joinWaitlist) || (!hasSeats && availableTickets < quantity && !joinWaitlist) ? (
                        hasSeats ? 'Not enough seats available' : 'Not enough tickets available'
                      ) : joinWaitlist && ((hasSeats && availableSeats < quantity) || (!hasSeats && availableTickets < quantity)) ? (
                        'Join Waitlist'
                      ) : (
                        userConfirmedTickets > 0 ? 'Book More Tickets' : `Book ${quantity} Ticket${quantity > 1 ? 's' : ''}`
                      )}
                    </Button>

                    {!user && (
                      <p className="text-xs text-center text-muted-foreground">
                        <Link to="/login" className="text-primary hover:underline">
                          Sign in
                        </Link>{' '}
                        or{' '}
                        <Link to="/signup" className="text-primary hover:underline">
                          create an account
                        </Link>{' '}
                        to book tickets
                      </p>
                    )}
                  </>
                )}

                {/* Event Info Summary */}
                <div className="pt-4 border-t space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start:</span>
                    <span>{format(new Date(event.start_time), 'MMM d, h:mm a')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End:</span>
                    <span>{format(new Date(event.end_time), 'MMM d, h:mm a')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{formatDuration(event.start_time, event.end_time)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Booking Celebration Animation */}
      {celebrationData && (
        <BookingCelebration
          isVisible={showCelebration}
          eventName={celebrationData.eventName}
          ticketCount={celebrationData.ticketCount}
          seatLabels={celebrationData.seatLabels}
          onComplete={() => {
            setShowCelebration(false);
            setCelebrationData(null);
          }}
        />
      )}
    </div>
  );
}