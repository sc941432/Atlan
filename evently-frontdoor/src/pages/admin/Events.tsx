import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Calendar, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { events, adminEvents, adminBookings, bookings, Event, Booking, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function AdminEvents() {
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    venue: '',
    start_time: '',
    end_time: '',
    capacity: 0,
  });

  useEffect(() => {
    if (isAdmin) {
      fetchEvents();
    }
  }, [isAdmin]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await events.list({ page_size: 100 });
      setEventsList(response.items);
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

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(-1);

    try {
      await adminEvents.create(formData);
      toast({
        title: "Event created",
        description: "The event has been created successfully.",
      });
      setIsCreateOpen(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Failed to create event",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    setActionLoading(editingEvent.id);

    try {
      await adminEvents.update(editingEvent.id, formData);
      toast({
        title: "Event updated",
        description: "The event has been updated successfully.",
      });
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && error.message.includes('capacity')) {
          toast({
            title: "Cannot reduce capacity",
            description: "The new capacity cannot be lower than the current number of bookings.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Failed to update event",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (event: Event) => {
    setActionLoading(event.id);

    try {
      if (event.status === 'active') {
        await adminEvents.deactivate(event.id);
        toast({
          title: "Event deactivated",
          description: "The event is no longer accepting bookings.",
        });
      } else {
        await adminEvents.update(event.id, { status: 'active' });
        toast({
          title: "Event reactivated",
          description: "The event is now accepting bookings.",
        });
      }
      fetchEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Failed to toggle event status",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;

    setActionLoading(deletingEvent.id);

    try {
      await adminEvents.delete(deletingEvent.id);
      toast({
        title: "Event deleted",
        description: "The event has been permanently deleted.",
      });
      setDeletingEvent(null);
      fetchEvents();
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Failed to delete event",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      venue: '',
      start_time: '',
      end_time: '',
      capacity: 0,
    });
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      venue: event.venue,
      start_time: event.start_time.slice(0, 16), // Format for datetime-local input
      end_time: event.end_time.slice(0, 16),
      capacity: event.capacity,
    });
  };

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), 'MMM d, yyyy • h:mm a');
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

  const canDelete = (event: Event) => event.booked_count === 0;

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
          <h1 className="text-3xl font-bold">Manage Events</h1>
          <p className="text-muted-foreground">Create, edit, and manage your events</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 glow-on-hover">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <form onSubmit={handleCreateEvent}>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>
                  Fill in the details to create a new event.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Event Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter event name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                    placeholder="Enter venue location"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    placeholder="Maximum attendees"
                    required
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading === -1}>
                  {actionLoading === -1 ? 'Creating...' : 'Create Event'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Events ({eventsList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : eventsList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Waitlisted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsList.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{event.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {event.venue}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDateTime(event.start_time)}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                        <span>{event.capacity}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{event.booked_count}</div>
                        <div className="text-muted-foreground">
                          {((event.booked_count / event.capacity) * 100).toFixed(0)}% full
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium text-amber-600">
                          {event.waitlisted_count || 0}
                        </div>
                        <div className="text-muted-foreground">
                          {event.waitlisted_count ? `${event.waitlisted_count} waiting` : 'No waitlist'}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(event.status)}
                        {event.status === 'active' && event.booked_count >= event.capacity && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                            Full
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(event)}
                          disabled={actionLoading === event.id}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(event)}
                          disabled={actionLoading === event.id}
                        >
                          {event.status === 'active' ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingEvent(event)}
                          disabled={!canDelete(event) || actionLoading === event.id}
                          className="text-destructive hover:text-destructive"
                          title={!canDelete(event) ? "Cannot delete event with bookings" : "Delete event"}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No events yet</h3>
              <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
              <Button onClick={() => setIsCreateOpen(true)}>Create Event</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleUpdateEvent}>
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>
                Update the event details. When seats free up (cancellations or capacity increase), waitlisted users are automatically promoted FIFO.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Event Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-venue">Venue</Label>
                <Input
                  id="edit-venue"
                  value={formData.venue}
                  onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Start Time</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-end">End Time</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-capacity">
                  Capacity {editingEvent && `(min: ${editingEvent.booked_count})`}
                </Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  min={editingEvent?.booked_count || 1}
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                  required
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setEditingEvent(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editingEvent ? actionLoading === editingEvent.id : false}
              >
                {editingEvent && actionLoading === editingEvent.id ? 'Updating...' : 'Update Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{deletingEvent?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}