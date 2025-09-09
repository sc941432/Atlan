import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Seat } from '@/lib/api';

interface SeatPickerProps {
  seats: Seat[];
  selectedSeatIds: number[];
  onSeatSelect: (seatIds: number[]) => void;
  requiredCount: number;
  disabled?: boolean;
}

export function SeatPicker({ 
  seats, 
  selectedSeatIds, 
  onSeatSelect, 
  requiredCount,
  disabled = false 
}: SeatPickerProps) {
  // Group seats by row and sort
  const seatsByRow = seats.reduce((acc, seat) => {
    if (!acc[seat.row_label]) {
      acc[seat.row_label] = [];
    }
    acc[seat.row_label].push(seat);
    return acc;
  }, {} as Record<string, Seat[]>);

  // Sort rows and seats within each row
  const sortedRows = Object.keys(seatsByRow).sort();
  Object.values(seatsByRow).forEach(rowSeats => {
    rowSeats.sort((a, b) => a.col_number - b.col_number);
  });

  const handleSeatClick = (seat: Seat) => {
    if (disabled || seat.reserved) return;

    const isSelected = selectedSeatIds.includes(seat.id);
    let newSelection: number[];

    if (isSelected) {
      // Deselect seat
      newSelection = selectedSeatIds.filter(id => id !== seat.id);
    } else {
      // Select seat if under limit, or replace last selected if at limit
      if (selectedSeatIds.length < requiredCount) {
        newSelection = [...selectedSeatIds, seat.id];
      } else {
        // Replace the first selected seat with the new one
        newSelection = [...selectedSeatIds.slice(1), seat.id];
      }
    }

    onSeatSelect(newSelection);
  };

  const getSeatState = (seat: Seat) => {
    if (seat.reserved) return 'reserved';
    if (selectedSeatIds.includes(seat.id)) return 'selected';
    return 'available';
  };

  const getSeatClassName = (seat: Seat) => {
    const state = getSeatState(seat);
    const baseClasses = "w-8 h-8 text-xs font-medium border-2 rounded transition-all duration-200";
    
    switch (state) {
      case 'reserved':
        return cn(baseClasses, "bg-muted border-muted-foreground/30 text-muted-foreground cursor-not-allowed");
      case 'selected':
        return cn(baseClasses, "bg-primary border-primary text-primary-foreground cursor-pointer hover:bg-primary/90");
      case 'available':
        return cn(baseClasses, "bg-background border-border text-foreground cursor-pointer hover:bg-accent hover:border-accent-foreground");
      default:
        return baseClasses;
    }
  };

  const availableSeats = seats.filter(s => !s.reserved).length;
  const selectedCount = selectedSeatIds.length;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Select Your Seats</CardTitle>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-background border-2 border-border rounded"></div>
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary border-2 border-primary rounded"></div>
            <span className="text-muted-foreground">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted border-2 border-muted-foreground/30 rounded"></div>
            <span className="text-muted-foreground">Reserved</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seat Selection Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            Selected: {selectedCount} of {requiredCount} required
          </span>
          {selectedCount === requiredCount ? (
            <Badge variant="default" className="status-confirmed">
              Ready to book
            </Badge>
          ) : (
            <Badge variant="secondary">
              Select {requiredCount - selectedCount} more
            </Badge>
          )}
        </div>

        {/* Seat Map */}
        <div className="space-y-3">
          <div className="text-center text-sm font-medium text-muted-foreground border-b pb-2">
            STAGE / SCREEN
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedRows.map(rowLabel => (
              <div key={rowLabel} className="flex items-center gap-2">
                <div className="w-8 text-sm font-medium text-muted-foreground text-center">
                  {rowLabel}
                </div>
                <div className="flex flex-wrap gap-1">
                  {seatsByRow[rowLabel].map(seat => (
                    <Button
                      key={seat.id}
                      variant="ghost"
                      size="sm"
                      className={getSeatClassName(seat)}
                      onClick={() => handleSeatClick(seat)}
                      disabled={disabled || seat.reserved}
                      title={`${seat.label} - ${getSeatState(seat)}`}
                    >
                      {seat.col_number}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Seats Display */}
        {selectedCount > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Selected Seats:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedSeatIds.map(seatId => {
                const seat = seats.find(s => s.id === seatId);
                return seat ? (
                  <Badge key={seatId} variant="outline" className="text-xs">
                    {seat.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          {availableSeats} available seats • {seats.filter(s => s.reserved).length} reserved
        </div>
      </CardContent>
    </Card>
  );
}