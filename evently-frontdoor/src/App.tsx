import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Bookings from "./pages/Bookings";
import AdminEvents from "./pages/admin/Events";
import Analytics from "./pages/admin/Analytics";
import AdminUsers from "./pages/admin/Users";
import AdminSignup from "./pages/AdminSignup";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  console.log('App rendering...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Routes without Layout */}
              <Route path="/setup" element={<Setup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/admin/signup" element={<AdminSignup />} />
              
              {/* Routes with Layout - using proper nested routing */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Index />} />
                <Route path="events" element={<Events />} />
                <Route path="events/:id" element={<EventDetail />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="admin/events" element={<AdminEvents />} />
                <Route path="admin/analytics" element={<Analytics />} />
                <Route path="admin/users" element={<AdminUsers />} />
              </Route>
              {/* Catch-all route */}
              <Route path="*" element={<Layout />}>
                <Route index element={<NotFound />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
