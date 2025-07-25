
"use client";

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import type { Registration } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, updateDoc, where, query } from 'firebase/firestore';

interface RegistrationContextType {
  userRegistrations: Registration[];
  allRegistrations: Registration[];
  registerForEvent: (eventId: string) => Promise<void>;
  isUserRegistered: (eventId: string) => boolean;
  markAttendance: (registrationId: string) => Promise<void>;
  loading: boolean;
}

export const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export const RegistrationProvider = ({ children }: { children: ReactNode }) => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const fetchRegistrations = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      const regsCollection = collection(db, 'registrations');
      let q;
      if(user?.role === 'organizer') {
        q = regsCollection; // Organizers see all registrations
      } else if (user?.role === 'student') {
        q = query(regsCollection, where('userId', '==', user.id)); // Students only see their own
      } else {
        setRegistrations([]);
        setLoading(false);
        return;
      }
      const querySnapshot = await getDocs(q);
      const fetchedRegs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Registration[];
      setRegistrations(fetchedRegs);
    } catch (error) {
      console.error("Error fetching registrations:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, authLoading]); // Use stable user properties instead of user object
  
  // Initial fetch - only run when user changes, not when fetchRegistrations changes
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!authLoading) {
      fetchRegistrations();
    }
  }, [user?.id, user?.role, authLoading]); // Remove fetchRegistrations from dependencies

  const registerForEvent = useCallback(async (eventId: string) => {
    if (!user) {
      console.error("User must be logged in to register.");
      return;
    }
    const registrationId = `${user.id}-${eventId}`;
    if (registrations.some(reg => reg.id === registrationId)) return;

    const newRegistration: Registration = {
      id: registrationId,
      userId: user.id,
      eventId: eventId,
      registrationDate: new Date().toISOString(),
      checkedIn: false,
    };

    try {
      await setDoc(doc(db, 'registrations', registrationId), newRegistration);
      // After successful registration, refetch to update the UI
      await fetchRegistrations();
    } catch (error) {
      console.error("Error creating registration:", error);
    }
  }, [user, registrations, fetchRegistrations]);

  const markAttendance = useCallback(async (registrationId: string) => {
    try {
      const regDocRef = doc(db, 'registrations', registrationId);
      const checkedInAt = new Date().toISOString();
      await updateDoc(regDocRef, { 
        checkedIn: true,
        checkedInAt: checkedInAt
      });
      
       // Re-fetch all registrations for organizer to get immediate update
      if (user?.role === 'organizer') {
         await fetchRegistrations();
      } else {
         setRegistrations(prev =>
            prev.map(reg =>
              reg.id === registrationId ? { ...reg, checkedIn: true, checkedInAt: checkedInAt } : reg
            )
          );
      }

    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  }, [user?.role, fetchRegistrations]);

  const userRegistrations = useMemo(() => 
    user ? registrations.filter(reg => reg.userId === user.id) : [],
    [user, registrations]
  );

  const isUserRegistered = useCallback((eventId: string) => {
    if (!user) return false;
    return userRegistrations.some(reg => reg.eventId === eventId);
  }, [user, userRegistrations]);

  const allRegistrations = useMemo(() => 
    user?.role === 'organizer' ? registrations : [],
    [user?.role, registrations]
  );

  const contextValue = useMemo(() => ({
    userRegistrations,
    allRegistrations,
    registerForEvent,
    isUserRegistered,
    markAttendance,
    loading
  }), [userRegistrations, allRegistrations, registerForEvent, isUserRegistered, markAttendance, loading]);

  return (
    <RegistrationContext.Provider value={contextValue}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistrations = () => {
  const context = useContext(RegistrationContext);
  if (context === undefined) {
    throw new Error('useRegistrations must be used within a RegistrationProvider');
  }
  return context;
};
