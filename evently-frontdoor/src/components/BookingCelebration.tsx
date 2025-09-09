import { useEffect, useState } from 'react';
import { CheckCircle, Ticket, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BookingCelebrationProps {
  isVisible: boolean;
  eventName: string;
  ticketCount: number;
  seatLabels?: string[];
  onComplete: () => void;
}

export function BookingCelebration({ 
  isVisible, 
  eventName, 
  ticketCount, 
  seatLabels,
  onComplete 
}: BookingCelebrationProps) {
  const [stage, setStage] = useState<'hidden' | 'enter' | 'celebrate' | 'exit'>('hidden');

  useEffect(() => {
    if (isVisible) {
      setStage('enter');
      
      const timer1 = setTimeout(() => setStage('celebrate'), 300);
      const timer2 = setTimeout(() => setStage('exit'), 3000);
      const timer3 = setTimeout(() => {
        setStage('hidden');
        onComplete();
      }, 3500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible, onComplete]);

  if (stage === 'hidden') return null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm",
      stage === 'enter' && "animate-fade-in",
      stage === 'exit' && "animate-fade-out"
    )}>
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-2 h-2 bg-primary rounded-full opacity-0",
              stage === 'celebrate' && "animate-pulse"
            )}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '2s'
            }}
          />
        ))}
      </div>

      {/* Main Celebration Card */}
      <Card className={cn(
        "relative max-w-md mx-4 overflow-hidden",
        "border-primary/20 shadow-2xl",
        stage === 'enter' && "animate-scale-in",
        stage === 'celebrate' && "animate-pulse",
        stage === 'exit' && "animate-scale-out"
      )}>
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5" />
        
        <CardContent className="relative p-8 text-center space-y-6">
          {/* Success Icon with Glow */}
          <div className="relative">
            <div className={cn(
              "absolute inset-0 bg-primary/20 rounded-full blur-xl",
              stage === 'celebrate' && "animate-pulse"
            )} />
            <CheckCircle className={cn(
              "relative w-16 h-16 mx-auto text-primary",
              stage === 'celebrate' && "animate-bounce"
            )} />
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">
              Booking Confirmed! 🎉
            </h2>
            <p className="text-muted-foreground">
              Your tickets have been successfully reserved
            </p>
          </div>

          {/* Ticket Details */}
          <div className={cn(
            "space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20",
            stage === 'celebrate' && "animate-fade-in"
          )}>
            <div className="flex items-center justify-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              <span className="font-semibold">{eventName}</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="default" className="gap-1">
                <Sparkles className="w-3 h-3" />
                {ticketCount} Ticket{ticketCount > 1 ? 's' : ''}
              </Badge>
              
              {seatLabels && seatLabels.length > 0 && (
                <Badge variant="outline">
                  Seats: {seatLabels.join(', ')}
                </Badge>
              )}
            </div>
          </div>

          {/* Floating Tickets Animation */}
          <div className="relative h-8">
            {[...Array(ticketCount)].map((_, i) => (
              <Ticket
                key={i}
                className={cn(
                  "absolute w-6 h-6 text-primary/60",
                  stage === 'celebrate' && "animate-bounce"
                )}
                style={{
                  left: `${20 + (i * 15)}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Check your bookings to view details
          </p>
        </CardContent>
      </Card>
    </div>
  );
}