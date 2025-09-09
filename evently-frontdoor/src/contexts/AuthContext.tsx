import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, setToken, getToken, adminAnalytics, adminUsers, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Get user info and admin status
  const checkUserInfo = async () => {
    try {
      const userInfo = await auth.me();
      setUser(userInfo);
      setIsAdmin(userInfo.role === 'admin');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setUser(null);
        setIsAdmin(false);
      }
    }
  };

  // Initialize auth state
  useEffect(() => {
    const token = getToken();
    if (token) {
      checkUserInfo();
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await auth.login({ email, password });
      setToken(response.access_token);
      
      // Get user info and check admin status
      await checkUserInfo();
      
      toast({
        title: "Welcome back!",
        description: "You've been logged in successfully.",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          toast({
            title: "Rate limited",
            description: "Too many login attempts. Please try again shortly.",
            variant: "destructive",
          });
        } else if (error.status === 401) {
          toast({
            title: "Invalid credentials",
            description: "Please check your email and password.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          });
        }
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await auth.signup({ name, email, password });
      setUser(response);
      
      toast({
        title: "Account created!",
        description: "Please log in to continue.",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAdmin(false);
    toast({
      title: "Logged out",
      description: "You've been logged out successfully.",
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAdmin,
      login,
      signup,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}