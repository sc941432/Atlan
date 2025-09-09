# Event Booking System

A modern, responsive event booking and management system built with React, TypeScript, and Tailwind CSS. This application allows users to browse events, book tickets with seat selection, manage waitlists, and provides comprehensive admin functionality.

## 🚀 Features

### User Features
- **Event Browsing**: View upcoming events with filtering and sorting options
- **Seat Selection**: Interactive seat map for events with assigned seating
- **Ticket Booking**: Book tickets with quantity selection or specific seat assignments
- **Waitlist Management**: Join waitlists when events are full
- **Booking History**: View and manage personal bookings
- **Celebration Animations**: Delightful booking confirmation animations

### Admin Features
- **Event Management**: Create, update, and manage events
- **Analytics Dashboard**: View booking statistics and event performance
- **User Management**: Manage user accounts and roles
- **Capacity Management**: Adjust event capacity and monitor utilization

## 🛠 Prerequisites

Before running this project locally, make sure you have:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Git** for version control

## 📦 Installation

1. **Clone the repository**
```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Environment Configuration**
   
   Create a `.env.local` file in the root directory (optional):
```env
# API Configuration (optional - defaults to localhost:8000)
VITE_API_BASE=http://localhost:8000
```

4. **Start the development server**
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173`

## 🔧 Available Scripts

- **`npm run dev`** - Start development server with hot reload
- **`npm run build`** - Build production bundle
- **`npm run preview`** - Preview production build locally
- **`npm run lint`** - Run ESLint for code quality
- **`npm run type-check`** - Run TypeScript type checking

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Layout.tsx      # Main layout component
│   ├── SeatPicker.tsx  # Interactive seat selection
│   └── BookingCelebration.tsx  # Success animations
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── hooks/              # Custom React hooks
│   ├── use-mobile.tsx  # Mobile detection hook
│   └── use-toast.ts    # Toast notifications
├── lib/                # Utility functions and API
│   ├── api.ts         # API client and type definitions
│   └── utils.ts       # Helper utilities
├── pages/              # Application pages
│   ├── admin/         # Admin-only pages
│   ├── Events.tsx     # Event listing page
│   ├── EventDetail.tsx # Event booking page
│   ├── Bookings.tsx   # User bookings page
│   └── Login.tsx      # Authentication page
└── main.tsx           # Application entry point
```

## 🎨 Key Components

### SeatPicker
Interactive seat selection component that handles:
- Visual seat map representation
- Real-time seat availability
- Multi-seat selection with limits
- Responsive design for different screen sizes

### BookingCelebration  
Animated success component featuring:
- Celebration animations with confetti effects
- Ticket details display
- Multi-stage animation sequence
- Responsive design

### AuthContext
Manages user authentication state including:
- Login/logout functionality
- User role management (user/admin)
- Protected route handling
- Token persistence

## 🏗 Backend Architecture

The application follows a **RESTful API architecture** with the following design principles:

### Architecture Overview
- **REST API Design**: Clean, predictable endpoints following REST conventions
- **JWT Authentication**: Stateless authentication using JSON Web Tokens
- **Role-Based Access Control**: User and Admin roles with different permissions
- **Data Validation**: Input validation and sanitization on all endpoints
- **Error Handling**: Consistent error responses with proper HTTP status codes
- **Rate Limiting**: Protection against abuse and spam
- **CORS Support**: Cross-origin resource sharing for frontend integration

### Database Design
The backend uses a relational database with the following key entities:
- **Users**: User accounts with authentication and role management
- **Events**: Event information including capacity, pricing, and scheduling
- **Bookings**: Ticket bookings linking users to events with seat assignments
- **Seats**: Seat mapping for events with assigned seating
- **Analytics**: Aggregated data for reporting and insights

## 🔌 API Endpoints

The application connects to a backend API with comprehensive endpoint coverage:

### 🔐 Authentication Endpoints
- **`POST /auth/signup`** - User registration with name, email, and password
- **`POST /auth/login`** - User authentication returning JWT token
- **`GET /auth/me`** - Get current authenticated user information

### 🎫 Public Event Endpoints
- **`GET /events`** - List all public events with optional filtering and sorting
  - Query params: `search`, `category`, `sort`, `limit`, `offset`
- **`GET /events/{id}`** - Get detailed information for a specific event
- **`GET /events/{id}/seats`** - Get seat map and availability for events with assigned seating
- **`POST /events/{id}/book`** - Book tickets for an event
  - Body: `{ quantity: number, seats?: string[] }`

### 📊 Public Statistics
- **`GET /stats/homepage`** - Get homepage statistics for public display
  - Returns: Total events, tickets sold, customers, cities covered

### 👤 User Booking Management
- **`GET /me/bookings`** - Get current user's booking history
- **`DELETE /bookings/{id}`** - Cancel a specific booking (if cancellation is allowed)

### 🛡️ Admin Event Management
- **`POST /admin/events`** - Create new event (Admin only)
  - Body: Event details including title, description, date, capacity, pricing
- **`PATCH /admin/events/{id}`** - Update existing event (Admin only)
- **`DELETE /admin/events/{id}`** - Delete event (Admin only)
- **`POST /admin/events/{id}/deactivate`** - Deactivate event without deletion

### 📈 Admin Analytics
- **`GET /admin/analytics/summary`** - Get comprehensive analytics dashboard data
  - Query params: `refresh=true` to force data refresh
- **`GET /admin/bookings`** - Get all bookings across all events (Admin only)

### 👥 Admin User Management
- **`GET /admin/users`** - List all users with filtering options
- **`POST /admin/users`** - Create new user account (Admin only)
- **`PATCH /admin/users/{id}`** - Update user details and roles (Admin only)

### 🔒 Authentication & Authorization

#### JWT Token System
- **Token Storage**: Stored in localStorage on client-side
- **Token Header**: Sent as `Authorization: Bearer <token>` in all authenticated requests
- **Token Expiration**: Automatic logout when token expires
- **Refresh Strategy**: Manual re-login required (stateless design)

#### Role-Based Access Control
- **User Role**: Can view events, book tickets, manage own bookings
- **Admin Role**: Full access to all endpoints, user management, analytics
- **Route Protection**: Frontend and backend validation of user permissions

### 📝 Data Models

#### User Model
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}
```

#### Event Model
```typescript
interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: string;
  capacity: number;
  price: number;
  image_url?: string;
  has_seats: boolean;
  is_active: boolean;
  available_tickets: number;
}
```

#### Booking Model
```typescript
interface Booking {
  id: number;
  user_id: number;
  event_id: number;
  quantity: number;
  total_price: number;
  status: 'confirmed' | 'cancelled' | 'waitlist';
  seats?: string[];
  booking_date: string;
  event: Event;
}
```

#### Seat Model
```typescript
interface Seat {
  id: string;
  row: string;
  number: number;
  is_available: boolean;
  is_premium?: boolean;
  price_modifier?: number;
}
```

### 🛠️ Backend Features

#### Core Functionality
- **Event Management**: Full CRUD operations for events
- **Ticket Booking**: Support for both general admission and assigned seating
- **Waitlist System**: Automatic waitlist when events reach capacity
- **Seat Selection**: Interactive seat picking for assigned seating events
- **Booking History**: Complete user booking management
- **Analytics Dashboard**: Real-time statistics and insights

#### Advanced Features
- **Search & Filtering**: Advanced event discovery with multiple filters
- **Category Management**: Event categorization for better organization
- **Capacity Management**: Real-time capacity tracking and waitlist handling
- **Multi-seat Booking**: Support for booking multiple seats in single transaction
- **Booking Cancellation**: Flexible cancellation policies
- **Admin Dashboard**: Comprehensive administrative interface

#### Security Features
- **Input Validation**: All endpoints validate and sanitize input data
- **SQL Injection Protection**: Parameterized queries and ORM usage
- **Rate Limiting**: API endpoint rate limiting to prevent abuse
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Authentication Middleware**: JWT verification on protected routes
- **Role Authorization**: Endpoint-level permission checking

#### Performance Optimizations
- **Database Indexing**: Optimized queries with proper indexing
- **Caching Strategy**: Response caching for frequently accessed data
- **Pagination**: Large dataset pagination to improve response times
- **Query Optimization**: Efficient database queries with minimal N+1 problems

## 🎯 Configuration

### API Base URL
The application defaults to `http://localhost:8000` for the API base URL. To change this:

1. Set the `VITE_API_BASE` environment variable, or
2. Modify the `API_BASE` constant in `src/lib/api.ts`

### Authentication
The app uses JWT tokens stored in localStorage. Tokens are automatically included in API requests via the Authorization header.

## 🎨 Design System

The application uses a comprehensive design system with:
- **Semantic color tokens** defined in `src/index.css`
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for consistent component library
- **Responsive design** for mobile and desktop
- **Dark/light mode support** via CSS variables

### Key Design Features
- Gradient backgrounds and shadows
- Smooth animations and transitions
- Interactive hover effects
- Consistent spacing and typography
- Accessible color contrast ratios

## 🔧 Technologies Used

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and builds
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: shadcn/ui component library
- **Icons**: Lucide React icon library
- **Routing**: React Router for client-side navigation
- **State Management**: React Context + useState/useEffect
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: date-fns for date formatting
- **Charts**: Recharts for analytics visualization

## 📱 Responsive Design

The application is fully responsive and supports:
- **Mobile devices** (320px and up)
- **Tablets** (768px and up)  
- **Desktop** (1024px and up)
- **Large screens** (1280px and up)

## 🚀 Deployment

### Development
The app runs on `http://localhost:5173` in development mode with hot reload.

### Production Build
```bash
npm run build
```
This creates an optimized production build in the `dist/` directory.
