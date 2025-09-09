import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { adminUsers, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Shield, CheckCircle } from 'lucide-react';

const setupAdminSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SetupAdminForm = z.infer<typeof setupAdminSchema>;

export default function Setup() {
  const [isLoading, setIsLoading] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<SetupAdminForm>({
    resolver: zodResolver(setupAdminSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // Try to get users list - if it fails with 403, no admin exists
        await adminUsers.list();
        // If we get here, admin exists and we have access
        setAdminExists(true);
        toast({
          title: "Setup Complete", 
          description: "Admin account already exists. Please login.",
        });
        navigate('/login');
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          // No admin exists or we don't have access - setup needed
          setAdminExists(false);
        } else {
          console.error('Error checking admin status:', error);
          setAdminExists(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkSetupStatus();
  }, [navigate, toast]);

  const handleSetupAdmin = async (data: SetupAdminForm) => {
    setIsSubmitting(true);
    try {
      // Use existing admin users endpoint to create admin
      await adminUsers.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: 'admin',
      });

      toast({
        title: "Admin Account Created!",
        description: "You can now login with your admin credentials.",
      });

      // Redirect to login page
      navigate('/login');
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Setup Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle>Setup Complete</CardTitle>
            <CardDescription>
              Admin account already exists. Please login to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/login">Go to Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
            <Calendar className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Shield className="h-5 w-5" />
            Initial Setup
          </CardTitle>
          <CardDescription>
            Create the first admin account to get started with Evently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSetupAdmin)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter your email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Choose a password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Admin Account...' : 'Create Admin Account'}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <Shield className="h-4 w-4 inline mr-1" />
              This setup page creates your first admin account using the existing admin user management system. 
              After creating your admin account, you can manage other users from the admin panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}