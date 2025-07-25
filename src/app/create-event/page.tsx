"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/contexts/EventContext';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AIDescriptionGenerator } from '@/components/AIDescriptionGenerator';
import BannerManager from '@/components/BannerManager';

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  location: z.string().min(3, 'Location is required.'),
  category: z.string().min(3, 'Category is required.'),
});

export default function CreateEventPage() {
  const { user, loading } = useAuth();
  const { addEvent } = useEvents();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventBanner, setEventBanner] = useState<{ url: string; generatedAt: string; prompt: string } | null>(null);
  
  // Stabilize the banner update callback
  const handleBannerUpdate = useCallback((banner: { url: string; generatedAt: string; prompt: string } | null) => {
    setEventBanner(banner);
  }, []);

  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (loading || hasRedirected) return; // Don't do anything while loading or if already redirected
    
    if (!user) {
      setHasRedirected(true);
      toast({ 
        variant: 'destructive', 
        title: 'Authentication Required', 
        description: 'Please log in to create events.' 
      });
      router.push('/login');
      return;
    }
    
    if (user.role !== 'organizer') {
      setHasRedirected(true);
      toast({ 
        variant: 'destructive', 
        title: 'Organizer Access Required', 
        description: 'Only organizers can create events. Please contact an administrator if you need organizer access.' 
      });
      router.push('/');
      return;
    }
  }, [user, loading, router, toast, hasRedirected]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      time: '',
      endTime: '',
      location: '',
      category: '',
    },
  });

  // Watch form values for banner generation
  const watchedValues = form.watch();
  
  // Memoize the event object to prevent unnecessary re-renders
  const memoizedEvent = useMemo(() => ({
    id: '',
    title: watchedValues.title || '',
    description: watchedValues.description || '',
    date: watchedValues.date || '',
    time: watchedValues.time || '',
    endTime: watchedValues.endTime || '',
    location: watchedValues.location || '',
    category: watchedValues.category || '',
    organizer: { name: user?.name || '', contact: user?.email || '' },
    banner: eventBanner || undefined
  }), [
    watchedValues.title,
    watchedValues.description,
    watchedValues.date,
    watchedValues.time,
    watchedValues.endTime,
    watchedValues.location,
    watchedValues.category,
    user?.name,
    user?.email,
    eventBanner
  ]);

  // Debug banner state changes
  useEffect(() => {
    console.log('Create event banner state changed:', eventBanner);
  }, [eventBanner]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    try {
      const eventData = {
        ...values,
        ...(eventBanner && { banner: eventBanner })
      };
      
      await addEvent(eventData);
      
      toast({
        title: 'Event Created!',
        description: `"${values.title}" has been successfully created.`,
      });
      
      form.reset();
      setEventBanner(null);
      router.push('/');
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create event. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-1/3" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!user && !hasRedirected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Authentication Required</CardTitle>
            <CardDescription>Please log in to create events.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">You need to be logged in as an organizer to create events.</p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && user.role !== 'organizer' && !hasRedirected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Organizer Access Required</CardTitle>
            <CardDescription>Only organizers can create events.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You are currently logged in as a {user.role}. Only users with organizer privileges can create events.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
                Go to Home
              </Button>
              <Button onClick={() => router.push('/events')} className="flex-1">
                View Events
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't render the form if we're in the process of redirecting
  if (hasRedirected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Create New Event</CardTitle>
          <CardDescription>Fill out the details below to add a new event to the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl><Input placeholder="e.g., Spring Fling" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Textarea 
                        placeholder="Tell us more about the event..." 
                        {...field} 
                        rows={6}
                      />
                      <AIDescriptionGenerator
                        onDescriptionGenerated={(description) => {
                          form.setValue('description', description);
                        }}
                        eventTitle={form.watch('title')}
                        eventType={form.watch('category')}
                        location={form.watch('location')}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="e.g., Grand Hall" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl><Input placeholder="e.g., Social, Academic" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              {/* Banner Management */}
              <div className="space-y-4">
                <BannerManager
                  event={memoizedEvent}
                  onBannerUpdate={handleBannerUpdate}
                  disabled={isSubmitting}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating Event..." : "Create Event"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
