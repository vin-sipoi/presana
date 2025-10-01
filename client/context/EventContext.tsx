'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { suiClient } from '@/lib/sui-client';
import { getSessionStorage, setSessionStorage, isCacheValid, STORAGE_KEYS, EventsCacheData } from '@/utils/storage';

interface RewardPool {
  amount: number
  maxParticipants: number
  status: 'none' | 'locked' | 'distributed' | 'cancelled'
  contractEventId?: string
  distributionMethod: 'attendance' | 'manual'
  participants: string[]
  distributedAt?: Date
  createdAt: Date
}

interface Event {
  rsvpTimes: any
  id: string
  title: string
  description: string
  date: string
  endDate?: string
  time: string
  endTime?: string
  startTimestamp?: number
  endTimestamp?: number
  location: string
  capacity?: string
  ticketPrice?: string
  isFree: boolean
  requiresApproval?: boolean
  isPrivate: boolean
  poapEnabled?: boolean
  qrCode?: string
  eventUrl?: string
  type: string
  rsvps?: string[]
  attendance?: string[]
  pending_approvals?: string[]
  approved_attendees?: string[]
  image?: string
  bannerUrl?: string
  nftImageUrl?: string
  poapImageUrl?: string
  tags?: string[]
  registered?: number
  creator?: string
  organizer?: {
    name: string
    avatar?: string
    title?: string
  }
  price?: string
  category?: string
  rewardPool?: RewardPool
}

interface EventContextType {
  events: Event[]
  addEvent: (event: Event) => void
  getEvent: (id: string) => Event | undefined
  updateEvent: (id: string, updates: Partial<Event>) => void
  deleteEvent: (id: string) => void
  markAttendance: (eventId: string, attendee: string) => void
  fetchEvents: (forceRefresh?: boolean) => Promise<void>
  isLoading: boolean
}

const EventContext = createContext<EventContextType | undefined>(undefined)

export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch events from the blockchain
  const fetchEvents = async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    
    // Check for cached events unless force refresh is requested
    if (!forceRefresh) {
      const cachedEvents = getSessionStorage<EventsCacheData>(STORAGE_KEYS.EVENTS_CACHE);
      if (cachedEvents && isCacheValid(cachedEvents.timestamp)) {
        setEvents(cachedEvents.events);
        console.log('Loaded events from cache');
        setIsLoading(false);
        return;
      }
    }

    try {
      const eventRegistryId = process.env.NEXT_PUBLIC_EVENT_REGISTRY_ID
      if (!eventRegistryId) {
        console.error('Event registry ID not configured')
        return
      }

      // First get the registry to find the events table ID and attendance_records table ID
      const registryObject = await suiClient.getObject({
        id: eventRegistryId,
        options: {
          showContent: true,
        },
      })

      if (!registryObject.data?.content || registryObject.data.content.dataType !== 'moveObject') {
        console.error('Invalid registry object')
        return
      }

      const registryFields = registryObject.data.content.fields as any
      const eventsTableId = registryFields.events?.fields?.id?.id
      const attendanceRecordsTableId = registryFields.attendance_records?.fields?.id?.id

      if (!eventsTableId) {
        console.log('No events table found in registry')
        setEvents([])
        return
      }

      console.log('Events table ID:', eventsTableId)
      console.log('Attendance records table ID:', attendanceRecordsTableId)

      // Get dynamic fields (events) from the events table
      const dynamicFields = await suiClient.getDynamicFields({
        parentId: eventsTableId,
      })

      console.log('Dynamic fields from events table:', dynamicFields)

      if (!dynamicFields.data || dynamicFields.data.length === 0) {
        console.log('No events found in table')
        setEvents([])
        return
      }

      // Fetch attendance records if the table exists
      let attendanceMap: Map<string, string[]> = new Map()
      if (attendanceRecordsTableId) {
        try {
          console.log('Fetching attendance records from table:', attendanceRecordsTableId)
          const attendanceFields = await suiClient.getDynamicFields({
            parentId: attendanceRecordsTableId,
          })

          console.log('Attendance records table fields:', attendanceFields.data?.length || 0)

          // Fetch each attendance record
          for (const field of attendanceFields.data || []) {
            try {
              console.log('Fetching attendance record for field:', field.objectId)
              const attendanceObject = await suiClient.getObject({
                id: field.objectId,
                options: {
                  showContent: true,
                },
              })

              console.log('Attendance object data:', attendanceObject.data?.content)

              if (attendanceObject.data?.content && attendanceObject.data.content.dataType === 'moveObject') {
                const attendanceData = attendanceObject.data.content.fields as any
                console.log('Raw attendance data:', attendanceData)

                // The key is the event ID (field.name.value for Table entries)
                const eventId = field.name?.value || field.name
                console.log('Event ID from field:', eventId)

                // Parse the VecSet of addresses - try multiple possible structures
                let attendeesList: string[] = []

                // Try different possible VecSet structures
                if (attendanceData.value?.fields?.contents) {
                  // Table entry: { name: eventId, value: { fields: { contents: [...] } } }
                  attendeesList = attendanceData.value.fields.contents.filter((addr: any) => typeof addr === 'string')
                  console.log('Parsed attendees from value.fields.contents:', attendeesList)
                } else if (attendanceData.value?.contents) {
                  // Table entry: { name: eventId, value: { contents: [...] } }
                  attendeesList = attendanceData.value.contents.filter((addr: any) => typeof addr === 'string')
                  console.log('Parsed attendees from value.contents:', attendeesList)
                } else if (attendanceData.fields?.contents) {
                  // Direct VecSet: { fields: { contents: [...] } }
                  attendeesList = attendanceData.fields.contents.filter((addr: any) => typeof addr === 'string')
                  console.log('Parsed attendees from fields.contents:', attendeesList)
                } else if (attendanceData.contents) {
                  // Direct VecSet: { contents: [...] }
                  attendeesList = attendanceData.contents.filter((addr: any) => typeof addr === 'string')
                  console.log('Parsed attendees from contents:', attendeesList)
                } else if (Array.isArray(attendanceData.value)) {
                  // Direct array in value
                  attendeesList = attendanceData.value.filter((addr: any) => typeof addr === 'string')
                  console.log('Parsed attendees from value array:', attendeesList)
                } else {
                  console.log('No recognized attendance data structure found, raw data:', JSON.stringify(attendanceData, null, 2))
                }

                if (eventId && attendeesList.length > 0) {
                  const eventIdStr = typeof eventId === 'string' ? eventId : (eventId?.toString?.() ?? JSON.stringify(eventId))
                  attendanceMap.set(eventIdStr, attendeesList)
                  console.log(`Event ${eventIdStr}: ${attendeesList.length} attendees checked in:`, attendeesList)
                } else {
                  console.log('No valid eventId or attendees found for this record')
                }
              } else {
                console.log('Attendance object is not a moveObject or has no content')
              }
            } catch (err) {
              console.error('Error fetching attendance record:', field.objectId, err)
            }
          }
        } catch (err) {
          console.error('Error fetching attendance records table:', err)
        }
      } else {
        console.log('No attendance records table found')
      }

      // Filter for event entries in the Table
      const eventFields = dynamicFields.data.filter(field => 
        field.name.type && field.name.type.includes('0x2::object::ID')
      )

      // Fetch all event objects
      const eventPromises = dynamicFields.data.map(async (field) => {
        try {
          // Get the actual event object
          const eventObject = await suiClient.getObject({
            id: field.objectId,
            options: {
              showContent: true,
              showType: true,
            },
          })

          console.log('Event object:', field.objectId, eventObject)
          if (
            eventObject.data?.content &&
            eventObject.data.content.dataType === 'moveObject' &&
            'fields' in eventObject.data.content
          ) {
            console.log('Event data fields:', (eventObject.data.content as { fields: any }).fields)
          } else {
            console.log('Event data fields: not a moveObject or missing fields')
          }

          if (eventObject.data?.content && eventObject.data.content.dataType === 'moveObject') {
            const wrapper = eventObject.data.content.fields as any
            
            // The event data is nested in the value field for table entries
            const eventData = wrapper.value?.fields || wrapper
            
            // Parse the event ID from the wrapper or use the actual event ID
            // For table entries, the name field contains the event ID
            const eventId = wrapper.name || eventData.id?.id || field.objectId
            
            // Parse attendees from multiple sources
            let rsvpList: string[] = []
            let approvedAttendees: string[] = []
            let pendingApprovals: string[] = []
            
            // Debug logging
            console.log('Raw event data for RSVPs:', {
              attendees: eventData.attendees,
              approved_attendees: eventData.approved_attendees,
              pending_approvals: eventData.pending_approvals,
              all_fields: Object.keys(eventData)
            })
            
            // Helper function to parse VecSet<address> structure
            const parseVecSet = (vecSetData: any): string[] => {
              if (!vecSetData) return []
              
              if (Array.isArray(vecSetData)) {
                return vecSetData.filter(item => typeof item === 'string')
              } else if (vecSetData.fields?.contents) {
                const contents = vecSetData.fields.contents
                return Array.isArray(contents) ? contents.filter(item => typeof item === 'string') : []
              } else if (vecSetData.contents) {
                return Array.isArray(vecSetData.contents) ? vecSetData.contents.filter((item: any) => typeof item === 'string') : []
              }
              return []
            }
            
            // Parse attendees (confirmed registrations)
            if (eventData.attendees) {
              const attendeesList = parseVecSet(eventData.attendees)
              console.log('Parsed attendees:', attendeesList)
              rsvpList.push(...attendeesList)
            }
            
            // Parse approved_attendees
            if (eventData.approved_attendees) {
              approvedAttendees = parseVecSet(eventData.approved_attendees)
              console.log('Parsed approved_attendees:', approvedAttendees)
              // Add approved attendees to rsvp list if not already there
              approvedAttendees.forEach(addr => {
                if (!rsvpList.includes(addr)) {
                  rsvpList.push(addr)
                }
              })
            }
            
            // Parse pending_approvals
            if (eventData.pending_approvals) {
              pendingApprovals = parseVecSet(eventData.pending_approvals)
              console.log('Parsed pending_approvals:', pendingApprovals)
              // Add pending approvals to rsvp list for admin visibility
              pendingApprovals.forEach(addr => {
                if (!rsvpList.includes(addr)) {
                  rsvpList.push(addr)
                }
              })
            }

            // Get attendance list from the separate attendance_records table
            // The eventId is used to look up the attendance data
            let attendanceList: string[] = attendanceMap.get(eventId) || []
            
            // Log event stats if there's meaningful data
            if (rsvpList.length > 0 || attendanceList.length > 0) {
              console.log(`Event ${eventId}: ${rsvpList.length} registered, ${attendanceList.length} checked in`)
            }

            return {
              id: eventId,
              title: eventData.title || eventData.name || '',
              description: eventData.description || '',
              date: eventData.start_date ? new Date(parseInt(eventData.start_date)).toLocaleDateString() : '',
              time: eventData.start_date ? new Date(parseInt(eventData.start_date)).toLocaleTimeString() : '',
              endDate: eventData.end_date ? new Date(parseInt(eventData.end_date)).toLocaleDateString() : undefined,
              endTime: eventData.end_date ? new Date(parseInt(eventData.end_date)).toLocaleTimeString() : undefined,
              startTimestamp: eventData.start_date ? parseInt(eventData.start_date) : Date.now(),
              endTimestamp: eventData.end_date ? parseInt(eventData.end_date) : undefined,
              location: eventData.location || '',
              capacity: eventData.capacity || eventData.max_attendees ? (eventData.capacity || eventData.max_attendees).toString() : 'Unlimited',
              ticketPrice: eventData.price?.toString() || eventData.ticket_price?.toString() || '0',
              isFree: !eventData.price || eventData.price === '0',
              requiresApproval: eventData.requires_approval || false,
              isPrivate: eventData.is_private || false,
              bannerUrl: eventData.banner_url || '',
              nftImageUrl: eventData.nft_image_url || '',
              poapImageUrl: eventData.poap_image_url || '',
              category: eventData.category || '',
              type: 'Event',
              rsvps: rsvpList,
              attendance: attendanceList,
              approved_attendees: approvedAttendees,
              pending_approvals: pendingApprovals,
              creator: eventData.creator || '',
              organizer: {
                name: eventData.creator || 'Unknown',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SuiLens',
              }
            } as Event
          }
          return null
        } catch (error) {
          console.error('Error fetching event:', field.objectId, error)
          return null
        }
      })

      const fetchedEvents = await Promise.all(eventPromises)
      const validEvents = fetchedEvents.filter(e => e !== null) as Event[]
      
      // Cache the fetched events
      const eventsCacheData: EventsCacheData = {
        events: validEvents,
        timestamp: Date.now(),
      };
      setSessionStorage(STORAGE_KEYS.EVENTS_CACHE, eventsCacheData);
      
      console.log(`Fetched ${validEvents.length} events from blockchain and cached them`);
      setEvents(validEvents)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch events on mount only
  useEffect(() => {
    fetchEvents()
    
    // Remove auto-refresh to prevent too many requests
    // Users can manually refresh or it will refresh after specific actions
  }, [])

  const addEvent = (event: Event) => {
    // Add event locally for immediate UI update
    setEvents(prev => [...prev, event])
    // Clear cache since we added a new event
    setSessionStorage(STORAGE_KEYS.EVENTS_CACHE, {
      events: [...events, event],
      timestamp: Date.now(),
    });
    // Trigger a refresh to get the latest from blockchain
    setTimeout(() => fetchEvents(true), 2000)
  }

  const getEvent = (id: string) => {
    return events.find(event => event.id === id)
  }

  const updateEvent = (id: string, updates: Partial<Event>) => {
    setEvents(prev => 
      prev.map(event => 
        event.id === id ? { ...event, ...updates } : event
      )
    )
    // Update cache as well
    const cachedEvents = getSessionStorage<EventsCacheData>(STORAGE_KEYS.EVENTS_CACHE);
    if (cachedEvents) {
      const updatedEvents = cachedEvents.events.map(event => 
        event.id === id ? { ...event, ...updates } : event
      );
      setSessionStorage(STORAGE_KEYS.EVENTS_CACHE, {
        events: updatedEvents,
        timestamp: Date.now(),
      });
    }
  }

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id))
    // Update cache as well
    const cachedEvents = getSessionStorage<EventsCacheData>(STORAGE_KEYS.EVENTS_CACHE);
    if (cachedEvents) {
      const updatedEvents = cachedEvents.events.filter(event => event.id !== id);
      setSessionStorage(STORAGE_KEYS.EVENTS_CACHE, {
        events: updatedEvents,
        timestamp: Date.now(),
      });
    }
  }

  const markAttendance = (eventId: string, attendee: string) => {
    setEvents(prev =>
      prev.map(event => {
        if (event.id === eventId) {
          const attendance = event.attendance || []
          if (!attendance.includes(attendee)) {
            return { ...event, attendance: [...attendance, attendee] }
          }
        }
        return event
      })
    )
    // Update cache as well
    const cachedEvents = getSessionStorage<EventsCacheData>(STORAGE_KEYS.EVENTS_CACHE);
    if (cachedEvents) {
      const updatedEvents = cachedEvents.events.map(event => {
        if (event.id === eventId) {
          const attendance = event.attendance || []
          if (!attendance.includes(attendee)) {
            return { ...event, attendance: [...attendance, attendee] }
          }
        }
        return event
      });
      setSessionStorage(STORAGE_KEYS.EVENTS_CACHE, {
        events: updatedEvents,
        timestamp: Date.now(),
      });
    }
  }

  return (
    <EventContext.Provider value={{
      events,
      addEvent,
      getEvent,
      updateEvent,
      deleteEvent,
      markAttendance,
      fetchEvents,
      isLoading
    }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEventContext() {
  const context = useContext(EventContext)
  if (context === undefined) {
    throw new Error('useEventContext must be used within an EventProvider')
  }
  return context
}
