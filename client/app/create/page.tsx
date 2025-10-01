"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "../../context/UserContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import {
  ArrowLeft,
  Edit3,
  Camera,
  Plus,
  Loader2,
  Menu,
  X,
  Upload,
  Image as ImageIcon,
  Award,
  Ticket,
} from "lucide-react"
import Link from "next/link"
import { useEventContext } from "@/context/EventContext"
import { mintPOAP, suilensService } from "@/lib/sui-client"
import Header from '@/components/Header'
import { uploadImageToImgBB, validateImageFile } from '@/utils/imageUtils'
import { toast } from 'sonner'
import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction'
import { Transaction } from '@mysten/sui/transactions'
import LocationInput from '@/components/LocationInput'
import { events } from "@/lib/community"
import { eventAPI } from '@/lib/api'

export default function CreateEventPage() {
  const { user } = useUser()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { addEvent } = useEventContext()
  const { sponsorAndExecute, isConnected } = useSponsoredTransaction()

  // Redirect to signin if not logged in
  useEffect(() => {
    if (!user) {
      const timeoutId = setTimeout(() => {
        router.push('/landing')
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [user, router])

  const [eventData, setEventData] = useState({
    title: "",
    description: "",
    date: "",
    endDate: "",
    time: "",
    endTime: "",
    location: "",
    latitude: null as number | null,
    longitude: null as number | null,
    category: "",
    communityId: "",
    capacity: "",
    ticketPrice: "",
    isFree: true,
    requiresApproval: false,
    isPrivate: false,
    timezone: "GMT+03:00 Nairobi",
  })

  const [communities, setCommunities] = useState([])
  const [loadingCommunities, setLoadingCommunities] = useState(false)
  const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;


  // Fetch communities on component mount
  useEffect(() => {
    const fetchCommunities = async () => {
      setLoadingCommunities(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/communities`)
        if (response.ok) {
          const data = await response.json()
          setCommunities(data.communities || [])
        } else {
          console.error('Failed to fetch communities')
        }
      } catch (error) {
        console.error('Error fetching communities:', error)
      } finally {
        setLoadingCommunities(false)
      }
    }

    fetchCommunities()
  }, [])

  // Handle location coordinates change
  const handleLocationCoordinatesChange = (lat: number, lng: number) => {
    setEventData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }))
  }

  const [isCreating, setIsCreating] = useState(false)
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false)
  const [capacityDialogOpen, setCapacityDialogOpen] = useState(false)
  const [poapDialogOpen, setPoapDialogOpen] = useState(false)
  const [tempTicketData, setTempTicketData] = useState({
    isFree: eventData.isFree,
    ticketPrice: eventData.ticketPrice,
  })
  const [tempCapacityData, setTempCapacityData] = useState({
    capacity: eventData.capacity,
  })

  // Three separate image states
  const [bannerImage, setBannerImage] = useState<{
    file: File | null;
    preview: string | null;
    url: string | null;
  }>({ file: null, preview: null, url: null })

  const [nftImage, setNftImage] = useState<{
    file: File | null;
    preview: string | null;
    url: string | null;
  }>({ file: null, preview: null, url: null })

  const [poapImage, setPoapImage] = useState<{
    file: File | null;
    preview: string | null;
    url: string | null;
  }>({ file: null, preview: null, url: null })

  // Upload states
  const [uploadingImages, setUploadingImages] = useState({
    banner: false,
    nft: false,
    poap: false,
  })

  // POAP data state
  const [poapData, setPoapData] = useState({
    name: "",
    description: "",
  })

  // Handle image upload for each type
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    imageType: 'banner' | 'nft' | 'poap'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const preview = event.target?.result as string
      
      // Update the appropriate state
      if (imageType === 'banner') {
        setBannerImage({ file, preview, url: null })
      } else if (imageType === 'nft') {
        setNftImage({ file, preview, url: null })
      } else if (imageType === 'poap') {
        setPoapImage({ file, preview, url: null })
      }
    }
    reader.readAsDataURL(file)
  }

  // Upload images to imgBB and return the URLs
  const uploadImagesToCloud = async () => {
    const imageUrls = {
      bannerUrl: bannerImage.url || '',
      nftImageUrl: nftImage.url || '',
      poapImageUrl: poapImage.url || ''
    }
    
    // Create an array to hold upload promises
    const uploadPromises: Promise<void>[] = []
    
    // Upload banner image
    if (bannerImage.file && !bannerImage.url) {
      uploadPromises.push(
        uploadImageToImgBB(bannerImage.file, `${eventData.title}_banner_${Date.now()}`)
          .then(url => {
            setBannerImage(prev => ({ ...prev, url }))
            imageUrls.bannerUrl = url
          })
          .catch(error => {
            console.error('Error uploading banner image:', error)
            toast.error(`Failed to upload banner image: ${error.message}`)
            // Don't re-throw to prevent canceling other uploads
          })
      )
    }
    
    // Upload NFT image
    if (nftImage.file && !nftImage.url) {
      uploadPromises.push(
        uploadImageToImgBB(nftImage.file, `${eventData.title}_nft_${Date.now()}`)
          .then(url => {
            setNftImage(prev => ({ ...prev, url }))
            imageUrls.nftImageUrl = url
          })
          .catch(error => {
            console.error('Error uploading NFT image:', error)
            toast.error(`Failed to upload NFT image: ${error.message}`)
            // Don't re-throw to prevent canceling other uploads
          })
      )
    }
    
    // Upload POAP image
    if (poapImage.file && !poapImage.url) {
      uploadPromises.push(
        uploadImageToImgBB(poapImage.file, `${eventData.title}_poap_${Date.now()}`)
          .then(url => {
            setPoapImage(prev => ({ ...prev, url }))
            imageUrls.poapImageUrl = url
          })
          .catch(error => {
            console.error('Error uploading POAP image:', error)
            toast.error(`Failed to upload POAP image: ${error.message}`)
            // Don't re-throw to prevent canceling other uploads
          })
      )
    }
    
    if (uploadPromises.length > 0) {
      toast.info('Uploading images...')
      // Wait for all uploads to complete, but don't fail if one fails
      await Promise.allSettled(uploadPromises)
      toast.success('Image upload process completed!')
    }
    
    return imageUrls
  }

  // Generate QR code using qr-server.com API (free, no API key needed)
  const generateQRCode = async (eventId: string) => {
    try {
      const eventUrl = `${window.location.origin}/event/${eventId}/register`
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(eventUrl)}`
      
      return {
        qrCodeUrl: qrCodeUrl,
        eventUrl: eventUrl,
        qrCodeImage: qrCodeUrl,
      }
    } catch (error) {
      console.error('Error generating QR code:', error)
      // Fallback to the same URL
      const eventUrl = `${window.location.origin}/event/${eventId}/register`
      return {
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(eventUrl)}`,
        eventUrl: eventUrl,
        qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(eventUrl)}`,
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      // Validate required fields
      if (!eventData.title || !eventData.description || !eventData.date || !eventData.time || !eventData.location) {
        toast.error('Please fill in all required fields')
        setIsCreating(false)
        return
      }

      // Validate that at least banner image is uploaded
      if (!bannerImage.file) {
        toast.error('Please upload at least an event banner image')
        setIsCreating(false)
        return
      }

      // Check if user has wallet connection
      if (!isConnected) {
        toast.error('Please connect your wallet before creating an event')
        setIsCreating(false)
        return
      }

      // Upload images to imgBB and get the URLs
      const imageUrls = await uploadImagesToCloud()

      // Skip profile creation as requested - focus only on event creation
      console.log('Skipping profile creation, focusing on event creation only')

      // Now create the event with the uploaded image URLs
      // Convert timestamps to milliseconds for Move contract (matches clock::timestamp_ms())
      const startTimestamp = new Date(`${eventData.date} ${eventData.time}`).getTime();
      const endTimestamp = new Date(`${eventData.endDate || eventData.date} ${eventData.endTime || eventData.time}`).getTime();

      // Validate timestamps
      const currentTime = Date.now();
      if (startTimestamp <= currentTime) {
        toast.error('Event start time must be in the future')
        setIsCreating(false)
        return
      }
      if (endTimestamp <= startTimestamp) {
        toast.error('Event end time must be after start time')
        setIsCreating(false)
        return
      }

      const tx = await suilensService.createEvent({
        name: eventData.title,
        description: eventData.description,
        bannerUrl: imageUrls.bannerUrl,
        nftImageUrl: imageUrls.nftImageUrl,
        poapImageUrl: imageUrls.poapImageUrl,
        location: eventData.location,
        category: eventData.category,
        startTime: startTimestamp,
        endTime: endTimestamp,
        maxAttendees: parseInt(eventData.capacity) || 100,
        ticketPrice: eventData.isFree ? 0 : parseInt(eventData.ticketPrice) || 0,
        requiresApproval: eventData.requiresApproval,
        poapTemplate: poapData.name || '',
      })
      
      // Execute the transaction with Enoki zkLogin
      const result = await sponsorAndExecute({ tx })
      console.log('Create event transaction result:', result)

      // Event created successfully onchain
      toast.success('Event created successfully!')

      // Extract event ID from transaction result
      const eventId = result?.effects?.created?.[0]?.reference?.objectId || result?.digest



      // Redirect to discover page
      router.push(`/discover`)
    } catch (error) {
      console.error('Error creating event:', error)
      if (error instanceof Error && error.message.includes('Wallet connection required')) {
        toast.error('Please connect your wallet before creating an event.')
      } else {
        toast.error('Failed to create event. Please try again.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleTicketSave = () => {
    setEventData({
      ...eventData,
      isFree: tempTicketData.isFree,
      ticketPrice: tempTicketData.ticketPrice,
    })
    setTicketDialogOpen(false)
  }

  const handleCapacitySave = () => {
    setEventData({
      ...eventData,
      capacity: tempCapacityData.capacity,
    })
    setCapacityDialogOpen(false)
  }

  const handlePoapSave = () => {
    setPoapDialogOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />
      
      {/* Form Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <Link href="/landing" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create a New Event</h1>
          <p className="text-gray-600 text-sm">Fill out the details to create your event</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Banner Image Upload */}
          <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                {bannerImage.preview ? (
                  <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden">
                    <img src={bannerImage.preview} alt="Banner" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Click to upload banner or drag and drop<br />
                SVG, PNG, JPG or GIF (max. 800x400px)
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'banner')}
                  className="hidden"
                />
                <Button type="button" variant="outline" className="pointer-events-none">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </Button>
              </label>
            </CardContent>
          </Card>

          {/* Event Name */}
          <div>
            <Label htmlFor="eventName" className="text-sm font-medium text-gray-700 mb-2 block">
              Event Name
            </Label>
            <Input
              id="eventName"
              placeholder="Enter event name"
              value={eventData.title}
              onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          {/* Community Selection */}
          <div>
            <Label htmlFor="community" className="text-sm font-medium text-gray-700 mb-2 block">
              Community
            </Label>
            <select
              id="community"
              value={eventData.communityId}
              onChange={(e) => setEventData({ ...eventData, communityId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select community</option>
              {events.map((community) => (
                <option key={community.id} value={community.slug}>
                  {community.title}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date & Time */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Start</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={eventData.date}
                onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
              <Input
                type="time"
                value={eventData.time}
                onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* End Date & Time */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">End</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={eventData.endDate}
                onChange={(e) => setEventData({ ...eventData, endDate: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
              <Input
                type="time"
                value={eventData.endTime}
                onChange={(e) => setEventData({ ...eventData, endTime: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Event Location */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Add Location
            </Label>
            <LocationInput
              value={eventData.location}
              onChange={(value) => setEventData({ ...eventData, location: value })}
              onCoordinatesChange={handleLocationCoordinatesChange}
              placeholder="Enter location or virtual link"
            />
          </div>

          {/* Add Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium text-gray-700 mb-2 block">
              Add Description
            </Label>
            <Textarea
              id="description"
              placeholder="What's your event about?"
              rows={4}
              value={eventData.description}
              onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
              required
            />
          </div>

          {/* Tickets */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Tickets</Label>
            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between border-gray-300 hover:border-gray-400"
                  onClick={() => {
                    setTempTicketData({
                      isFree: eventData.isFree,
                      ticketPrice: eventData.ticketPrice,
                    })
                  }}
                >
                  <span>{eventData.isFree ? "Free" : `$${eventData.ticketPrice || "0"}`}</span>
                  <Edit3 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95%] max-w-md mx-auto bg-white">
                <DialogHeader>
                  <DialogTitle>Edit Tickets</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="free-ticket"
                      checked={tempTicketData.isFree}
                      onCheckedChange={(checked) =>
                        setTempTicketData({ ...tempTicketData, isFree: checked })
                      }
                    />
                    <Label htmlFor="free-ticket">Free Event</Label>
                  </div>
                  {!tempTicketData.isFree && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="price" className="text-right">
                        Price ($)
                      </Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="0.00"
                        value={tempTicketData.ticketPrice}
                        onChange={(e) =>
                          setTempTicketData({ ...tempTicketData, ticketPrice: e.target.value })
                        }
                        className="col-span-3"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={handleTicketSave}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Save changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Require Approval */}
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="approval" className="text-sm font-medium text-gray-700">
              Require Approval
            </Label>
            <Switch
              id="approval"
              checked={eventData.requiresApproval}
              onCheckedChange={(checked) => setEventData({ ...eventData, requiresApproval: checked })}
            />
          </div>

          {/* Maximum Capacity */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Maximum Capacity</Label>
            <Dialog open={capacityDialogOpen} onOpenChange={setCapacityDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between border-gray-300 hover:border-gray-400"
                  onClick={() => {
                    setTempCapacityData({
                      capacity: eventData.capacity,
                    })
                  }}
                >
                  <span>{eventData.capacity || "Unlimited"}</span>
                  <Edit3 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95%] max-w-md mx-auto bg-white">
                <DialogHeader>
                  <DialogTitle>Edit Capacity</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="capacity" className="text-right">
                      Limit guests
                    </Label>
                    <Input
                      id="capacity"
                      type="number"
                      placeholder="0"
                      value={tempCapacityData.capacity}
                      onChange={(e) =>
                        setTempCapacityData({ ...tempCapacityData, capacity: e.target.value })
                      }
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={handleCapacitySave}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Save changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Add POAP Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Add POAP to your event</h3>
            
            {/* POAP Image Upload */}
            <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  {poapImage.preview ? (
                    <div className="w-16 h-16 mx-auto rounded-full overflow-hidden">
                      <img src={poapImage.preview} alt="POAP" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <Award className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Click to upload POAP or drag and drop<br />
                  SVG, PNG, JPG or GIF (max. 800x400px)
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'poap')}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="pointer-events-none">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Files
                  </Button>
                </label>
              </CardContent>
            </Card>

            {/* POAP Details */}
            {poapImage.file && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="poap-name">POAP Name</Label>
                  <Input
                    id="poap-name"
                    placeholder="Enter POAP name"
                    value={poapData.name}
                    onChange={(e) => setPoapData({ ...poapData, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="poap-description">POAP Description</Label>
                  <Textarea
                    id="poap-description"
                    placeholder="Describe your POAP"
                    rows={3}
                    value={poapData.description}
                    onChange={(e) => setPoapData({ ...poapData, description: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* NFT Image Upload - moved after POAP */}
            <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  {nftImage.preview ? (
                    <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden">
                      <img src={nftImage.preview} alt="NFT" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                      <Ticket className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Click to upload NFT or drag and drop<br />
                  SVG, PNG, JPG or GIF (max. 800x400px)
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'nft')}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="pointer-events-none">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Files
                  </Button>
                </label>
              </CardContent>
            </Card>
          </div>

          {/* Create Event Button */}
          <Button
            type="submit"
            disabled={isCreating || !bannerImage.file}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Event...
              </>
            ) : (
              'Create Event'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}