import { Link } from 'react-router-dom';
import { Calendar, Users, TrendingUp, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Index() {
  const features = [
    {
      icon: Calendar,
      title: "Easy Event Discovery",
      description: "Browse and search through amazing events with advanced filtering and sorting options.",
    },
    {
      icon: Users,
      title: "Seamless Booking",
      description: "Book tickets instantly with our streamlined checkout process and real-time availability.",
    },
    {
      icon: TrendingUp,
      title: "Live Analytics",
      description: "Track event performance with comprehensive analytics and booking insights.",
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Built with security in mind, featuring rate limiting and robust error handling.",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center bg-gradient-to-br from-primary-light via-background to-accent overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-primary-hover to-primary bg-clip-text text-transparent">
              Discover Amazing Events
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              The modern ticketing platform that connects you to incredible experiences. 
              Find, book, and manage event tickets with ease.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="glow-on-hover">
                <Link to="/events" className="flex items-center gap-2">
                  Browse Events
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full animate-pulse" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-primary/5 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose Evently?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience the future of event ticketing with our comprehensive platform
              designed for both event-goers and organizers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-custom-lg transition-all duration-base animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:shadow-glow transition-all duration-base">
                    <feature.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-gradient-card">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Get started with Evently in just a few simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Browse Events",
                description: "Discover amazing events in your area using our advanced search and filtering tools.",
              },
              {
                step: "2", 
                title: "Select Tickets",
                description: "Choose your preferred event and select the number of tickets you want to book.",
              },
              {
                step: "3",
                title: "Enjoy the Event",
                description: "Complete your booking securely and get ready to enjoy an unforgettable experience!",
              },
            ].map((item, index) => (
              <div key={index} className="text-center animate-slide-up" style={{ animationDelay: `${index * 0.2}s` }}>
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                The Complete Event Experience
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                From discovery to attendance, Evently provides everything you need 
                for a seamless event experience. Our platform is trusted by thousands 
                of event organizers and attendees worldwide.
              </p>
              
              <div className="space-y-4">
                {[
                  "Real-time ticket availability",
                  "Secure payment processing", 
                  "Mobile-friendly booking",
                  "Easy cancellation process",
                  "Email confirmations & reminders",
                  "24/7 customer support",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="animate-scale-in">
              <Card className="bg-gradient-card shadow-custom-lg">
                <CardContent className="p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
                    <p className="text-muted-foreground mb-6">
                      Join thousands of event-goers who trust Evently for their ticketing needs.
                    </p>
                    <div className="space-y-3">
                      <Button asChild className="w-full glow-on-hover">
                        <Link to="/events">Explore Events</Link>
                      </Button>
                      <Button variant="outline" asChild className="w-full">
                        <Link to="/signup">Create Account</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-hero text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Don't Miss Out on Amazing Events
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Start your event journey today and discover experiences that will create lasting memories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/events" className="flex items-center gap-2">
                  Start Exploring
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
                <Link to="/signup">Sign Up Free</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}