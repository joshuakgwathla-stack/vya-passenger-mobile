import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Platform, Keyboard, Modal, FlatList,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import axios from 'axios'
import { tripsApi, bookingsApi, paymentsApi, pickupPointsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'
import { getSavedAddress, setSavedAddress } from '../../lib/savedAddress'

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ''

async function fetchSuggestions(input: string): Promise<any[]> {
  if (input.length < 3) return []
  try {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      { params: { input, key: PLACES_KEY, components: 'country:za', types: 'geocode|establishment', language: 'en' } }
    )
    return data.predictions || []
  } catch { return [] }
}

async function fetchPlaceDetail(placeId: string): Promise<string> {
  try {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      { params: { place_id: placeId, key: PLACES_KEY, fields: 'formatted_address' } }
    )
    return data.result?.formatted_address || ''
  } catch { return '' }
}

// ── Address input with GPS + Places autocomplete ──────────────
function AddressInput({
  value, onChange, placeholder, autoDetect = false, dotColor,
}: {
  value: string; onChange: (v: string) => void; placeholder: string
  autoDetect?: boolean; dotColor: string
}) {
  const [inputText, setInputText] = useState(value)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (autoDetect) detectGPS() }, [])
  useEffect(() => { setInputText(value); if (!value) setDetected(false) }, [value])

  const detectGPS = async () => {
    setDetecting(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setDetecting(false); return }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      try {
        const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: { latlng: `${pos.coords.latitude},${pos.coords.longitude}`, key: PLACES_KEY, result_type: 'street_address|premise', language: 'en' }
        })
        const addr = data.results?.[0]?.formatted_address
        if (addr) {
          const clean = addr.replace(/, South Africa$/, '')
          setInputText(clean); onChange(clean); setDetected(true); setDetecting(false); return
        }
      } catch {}
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      if (place) {
        const parts = [
          place.streetNumber && place.street ? `${place.streetNumber} ${place.street}` : place.street,
          place.district || place.subregion || place.city, place.region,
        ].filter(Boolean)
        const label = parts.join(', ')
        setInputText(label); onChange(label); setDetected(true)
      }
    } catch {}
    finally { setDetecting(false) }
  }

  const handleChangeText = (text: string) => {
    setInputText(text); onChange(text); setDetected(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 3) { setSuggestions([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(text)
      setSuggestions(results); setShowDropdown(results.length > 0)
    }, 350)
  }

  const handleSelect = async (prediction: any) => {
    Keyboard.dismiss(); setShowDropdown(false); setSuggestions([])
    const quick = prediction.description
    setInputText(quick); onChange(quick)
    const full = await fetchPlaceDetail(prediction.place_id)
    if (full) { const clean = full.replace(/, South Africa$/, ''); setInputText(clean); onChange(clean) }
  }

  return (
    <View>
      <View style={styles.addressRow}>
        <View style={[styles.addressDot, { backgroundColor: dotColor }]} />
        <View style={{ flex: 1 }}>
          {detecting ? (
            <View style={styles.detectingRow}>
              <ActivityIndicator color={COLORS.navy} size="small" />
              <Text style={styles.detectingText}>Detecting your location…</Text>
            </View>
          ) : (
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.addressInput, detected && styles.addressInputDetected]}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textMuted}
                value={inputText}
                onChangeText={handleChangeText}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                returnKeyType="done"
              />
              {detected && <View style={styles.gpsTag}><Text style={styles.gpsTagText}>📍 GPS</Text></View>}
            </View>
          )}
        </View>
      </View>
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.slice(0, 5).map((p, i) => (
            <TouchableOpacity
              key={p.place_id}
              style={[styles.dropdownItem, i < Math.min(suggestions.length, 5) - 1 && styles.dropdownItemBorder]}
              onPress={() => handleSelect(p)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownMain} numberOfLines={1}>{p.structured_formatting?.main_text || p.description}</Text>
                <Text style={styles.dropdownSub} numberOfLines={1}>{p.structured_formatting?.secondary_text || ''}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ── Hub picker modal ──────────────────────────────────────────
function HubModal({
  visible, hubs, onSelect, onClose, discountPct,
}: {
  visible: boolean; hubs: any[]; onSelect: (hub: any) => void; onClose: () => void; discountPct: number
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Choose a pickup hub</Text>
          <Text style={styles.modalSubtitle}>
            Save {discountPct}% on your trip — meet your driver at one of these convenient spots instead of door-to-door pickup.
          </Text>
          <FlatList
            data={hubs}
            keyExtractor={h => h.id}
            renderItem={({ item: h }) => (
              <TouchableOpacity style={styles.hubRow} onPress={() => onSelect(h)} activeOpacity={0.85}>
                <View style={styles.hubIconBox}>
                  <Text style={styles.hubIcon}>🏢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hubName}>{h.name}</Text>
                  <Text style={styles.hubAddress} numberOfLines={1}>{h.address}</Text>
                </View>
                <View style={styles.hubSaveBadge}>
                  <Text style={styles.hubSaveText}>−{h.discount_percentage}%</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.border }} />}
          />
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main booking screen ───────────────────────────────────────
export default function BookingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [seats, setSeats] = useState(1)
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [savedAddress, setSavedAddressState] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payMethod, setPayMethod] = useState<'card' | 'eft'>('card')

  // EFT proof-of-payment state (shown after booking is created)
  const [eftBookingId, setEftBookingId] = useState<string | null>(null)
  const [eftPickupCode, setEftPickupCode] = useState<string | null>(null)
  const [proofUri, setProofUri] = useState<string | null>(null)
  const [submittingProof, setSubmittingProof] = useState(false)

  // Hub state
  const [hubs, setHubs] = useState<any[]>([])
  const [selectedHub, setSelectedHub] = useState<any>(null)
  const [showHubModal, setShowHubModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [tripRes, saved] = await Promise.all([
          tripsApi.getTrip(tripId),
          getSavedAddress(),
        ])
        const t = tripRes.data.data
        setTrip(t)
        if (saved) {
          setSavedAddressState(saved)
          setPickup(saved)
        }
        if (t?.origin_city) {
          pickupPointsApi.getByCity(t.origin_city)
            .then(r => setHubs(r.data.data || []))
            .catch(() => {})
        }
      } catch {
        Alert.alert('Error', 'Could not load trip details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripId])

  const selectHub = (hub: any) => {
    setSelectedHub(hub)
    setPickup(`${hub.name}, ${hub.address}`)
    setShowHubModal(false)
  }

  const clearHub = () => {
    setSelectedHub(null)
    setPickup('')
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.navy} size="large" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    )
  }
  if (!trip) return null

  // ── Price calculations (needed by EFT screen and main booking form) ───────
  const dep = new Date(trip.departure_time)
  const pricePerSeat = Number(trip.price_per_seat)
  const availableSeats = trip.available_seats ?? 0
  const hubDiscount = selectedHub ? selectedHub.discount_percentage : 0
  const baseTotal = pricePerSeat * seats
  const discountAmount = parseFloat((baseTotal * hubDiscount / 100).toFixed(2))
  const finalTotal = (baseTotal - discountAmount).toFixed(2)

  const pickProofImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to upload proof of payment.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri)
    }
  }

  const submitEftProof = async () => {
    if (!proofUri || !eftBookingId) return
    setSubmittingProof(true)
    try {
      const formData = new FormData()
      const filename = proofUri.split('/').pop() || 'proof.jpg'
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      formData.append('proof_of_payment', { uri: proofUri, name: filename, type: mime } as any)
      await bookingsApi.submitEftProof(eftBookingId, formData)
      Alert.alert(
        '✅ Proof submitted!',
        'We\'ll verify your payment and confirm your booking. You\'ll be notified once approved.',
        [{ text: 'View Booking', onPress: () => router.replace(`/trip/${trip.id}?bookingId=${eftBookingId}`) }]
      )
    } catch (err: any) {
      Alert.alert('Upload failed', err.response?.data?.message || 'Please try again.')
    } finally { setSubmittingProof(false) }
  }

  // ── EFT proof-of-payment screen ───────────────────────────────────────────
  if (eftBookingId && eftPickupCode) {
    const bankName   = process.env.EXPO_PUBLIC_BANK_NAME || 'FNB'
    const accName    = process.env.EXPO_PUBLIC_BANK_ACCOUNT_NAME || 'Vya Shuttle (Pty) Ltd'
    const accNumber  = process.env.EXPO_PUBLIC_BANK_ACCOUNT_NUMBER || ''
    const branchCode = process.env.EXPO_PUBLIC_BANK_BRANCH_CODE || ''
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <View style={{ width: 36 }} />
          <Text style={styles.topTitle}>EFT Payment</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, { gap: 16 }]} showsVerticalScrollIndicator={false}>

          {/* Reference highlight */}
          <View style={styles.eftRefCard}>
            <Text style={styles.eftRefLabel}>YOUR PAYMENT REFERENCE</Text>
            <Text style={styles.eftRefCode}>{eftPickupCode}</Text>
            <Text style={styles.eftRefHint}>Use this exact reference when making your EFT. This is also your boarding code.</Text>
          </View>

          {/* Bank details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bank Details</Text>
            {[
              { label: 'Bank',           value: bankName },
              { label: 'Account name',   value: accName },
              { label: 'Account number', value: accNumber },
              { label: 'Branch code',    value: branchCode },
              { label: 'Reference',      value: eftPickupCode },
              { label: 'Amount',         value: `R${finalTotal}` },
            ].map(({ label, value }) => (
              <View key={label} style={styles.eftDetailRow}>
                <Text style={styles.eftDetailLabel}>{label}</Text>
                <Text style={[styles.eftDetailValue, label === 'Reference' && { color: COLORS.navy, fontWeight: '800' }]}>{value}</Text>
              </View>
            ))}
            <Text style={styles.eftEmailNote}>Upload your proof of payment below — we'll verify and confirm your booking within a few hours.</Text>
          </View>

          {/* Proof upload */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upload Proof of Payment</Text>
            <Text style={styles.eftProofSub}>Take a screenshot or photo of your EFT confirmation and upload it here. We'll verify and confirm your booking.</Text>
            <TouchableOpacity style={styles.eftUploadBtn} onPress={pickProofImage} activeOpacity={0.85}>
              {proofUri ? (
                <View style={styles.eftUploadDone}>
                  <Text style={styles.eftUploadDoneIcon}>✅</Text>
                  <Text style={styles.eftUploadDoneText}>Image selected — ready to submit</Text>
                  <TouchableOpacity onPress={pickProofImage}>
                    <Text style={styles.eftChangeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.eftUploadIcon}>📎</Text>
                  <Text style={styles.eftUploadText}>Tap to choose image</Text>
                  <Text style={styles.eftUploadSub}>JPG or PNG from your gallery</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.eftSubmitBtn, (!proofUri || submittingProof) && { opacity: 0.5 }]}
              onPress={submitEftProof}
              disabled={!proofUri || submittingProof}
              activeOpacity={0.85}
            >
              {submittingProof
                ? <ActivityIndicator color="white" />
                : <Text style={styles.eftSubmitText}>Submit Proof of Payment</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.eftLaterBtn}
              onPress={() => router.replace(`/trip/${trip.id}?bookingId=${eftBookingId}`)}
            >
              <Text style={styles.eftLaterText}>I'll submit proof later from My Bookings</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  const handleBook = async () => {
    if (!pickup.trim()) {
      Alert.alert('Pickup required', 'Enter your address or choose a pickup hub so your driver can find you.')
      return
    }
    setBooking(true)
    try {
      const { data } = await bookingsApi.create({
        trip_id: tripId,
        seats_booked: seats,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_point_id: selectedHub?.id || undefined,
        passengers: [{
          name: `${user?.first_name} ${user?.last_name}`,
          email: user?.email, phone: user?.phone, is_account_holder: true,
        }],
      })
      const bookingId = data.data.id
      const pickupCode = data.data.pickup_code

      // Save door-to-door address for next time (not hub addresses)
      if (!selectedHub && pickup.trim()) {
        setSavedAddress(pickup.trim()).catch(() => {})
      }

      if (payMethod === 'eft') {
        // Show EFT proof-of-payment screen instead of navigating away
        setEftBookingId(bookingId)
        setEftPickupCode(pickupCode)
        return
      }

      // Card — PayFast
      setPaying(true)
      const payRes = await paymentsApi.initiate(bookingId)
      const payUrl = payRes.data.data?.redirect_url || payRes.data.data?.payment_url
      if (payUrl) {
        await WebBrowser.openBrowserAsync(payUrl)
        const statusRes = await paymentsApi.getStatus(bookingId)
        if (statusRes.data.data?.payment_status === 'paid') {
          Alert.alert('Booking confirmed!', 'Your seat is secured. Check My Trips for details.')
          router.replace(`/trip/${trip.id}?bookingId=${bookingId}`)
        } else {
          Alert.alert('Payment pending', 'Finish payment to confirm your seat.', [
            { text: 'View Trip', onPress: () => router.replace(`/trip/${trip.id}?bookingId=${bookingId}`) },
          ])
        }
      } else {
        router.replace(`/trip/${trip.id}?bookingId=${bookingId}`)
      }
    } catch (err: any) {
      Alert.alert('Booking failed', err.response?.data?.message || 'Please try again.')
    } finally { setBooking(false); setPaying(false) }
  }

  const dayLabel = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const d = new Date(dep); d.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) return 'Today'
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return dep.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })
  })()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Book your seat</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Trip hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroRoute}>
            <View style={styles.heroCity}><View style={styles.dotGreen} /><Text style={styles.heroCityText}>{trip.origin_city}</Text></View>
            <View style={styles.heroLine} />
            <View style={styles.heroCity}><View style={styles.dotGold} /><Text style={styles.heroCityText}>{trip.destination_city}</Text></View>
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Date</Text>
              <Text style={styles.heroMetaValue}>{dayLabel}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Departs</Text>
              <Text style={styles.heroMetaValue}>{dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Available</Text>
              <Text style={[styles.heroMetaValue, availableSeats <= 2 && { color: '#f59e0b' }]}>
                {availableSeats} seat{availableSeats !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View style={styles.driverRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{trip.driver_first?.[0]}{trip.driver_last?.[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{trip.driver_first} {trip.driver_last}</Text>
              <Text style={styles.driverMeta}>⭐ {Number(trip.driver_rating || 0).toFixed(1)} · {trip.vehicle_make} {trip.vehicle_model}{trip.vehicle_color ? ` · ${trip.vehicle_color}` : ''}</Text>
            </View>
          </View>
        </View>

        {/* Seats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How many seats?</Text>
          <View style={styles.seatRow}>
            <TouchableOpacity style={[styles.seatBtn, seats <= 1 && styles.seatBtnDisabled]} onPress={() => setSeats(s => Math.max(1, s - 1))} disabled={seats <= 1}>
              <Text style={styles.seatBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.seatCountBox}>
              <Text style={styles.seatCount}>{seats}</Text>
              <Text style={styles.seatLabel}>{seats === 1 ? 'seat' : 'seats'}</Text>
            </View>
            <TouchableOpacity style={[styles.seatBtn, seats >= availableSeats && styles.seatBtnDisabled]} onPress={() => setSeats(s => Math.min(availableSeats, s + 1))} disabled={seats >= availableSeats}>
              <Text style={styles.seatBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.pricePerSeat}>R{pricePerSeat.toFixed(0)} / seat</Text>
          </View>
        </View>

        {/* Pickup mode toggle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where should your driver find you?</Text>

          {/* Mode tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, !selectedHub && styles.modeTabActive]}
              onPress={clearHub}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabText, !selectedHub && styles.modeTabTextActive]}>🏠  Door-to-door</Text>
              <Text style={[styles.modeTabSub, !selectedHub && { color: COLORS.navy }]}>Full price</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, !!selectedHub && styles.modeTabActive]}
              onPress={() => hubs.length > 0 ? setShowHubModal(true) : null}
              activeOpacity={0.8}
              disabled={hubs.length === 0}
            >
              <Text style={[styles.modeTabText, !!selectedHub && styles.modeTabTextActive]}>🏢  Hub pickup</Text>
              <Text style={[styles.modeTabSub, !!selectedHub && { color: COLORS.success }]}>
                {hubs.length > 0 ? `Save ${hubs[0]?.discount_percentage || 10}%` : 'Not available'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected hub display */}
          {selectedHub && (
            <View style={styles.selectedHubCard}>
              <View style={styles.selectedHubInfo}>
                <Text style={styles.selectedHubName}>{selectedHub.name}</Text>
                <Text style={styles.selectedHubAddress} numberOfLines={1}>{selectedHub.address}</Text>
              </View>
              <TouchableOpacity style={styles.changeHubBtn} onPress={() => setShowHubModal(true)}>
                <Text style={styles.changeHubText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Address fields */}
          <View style={[styles.addressBlock, selectedHub && { opacity: 0.5 }]} pointerEvents={selectedHub ? 'none' : 'auto'}>
            <AddressInput
              value={selectedHub ? `${selectedHub.name}, ${selectedHub.address}` : pickup}
              onChange={setPickup}
              placeholder="Your pickup address *"
              autoDetect={!selectedHub && !savedAddress}
              dotColor="#34d399"
            />
            <View style={styles.addressConnector} />
            <AddressInput
              value={dropoff}
              onChange={setDropoff}
              placeholder={`Drop-off in ${trip.destination_city} (optional)`}
              dotColor={COLORS.navy}
            />
          </View>

          {!selectedHub && savedAddress && pickup === savedAddress && (
            <View style={styles.savedAddressHint}>
              <Text style={styles.savedAddressHintText}>🏠 Using your saved address — tap the field to change</Text>
            </View>
          )}
          {!selectedHub && !savedAddress && (
            <Text style={styles.addressHint}>Your driver comes to your door — no taxi rank needed.</Text>
          )}
        </View>

        {/* Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What happens next</Text>
          {[
            'Pay securely via PayFast — your seat is held for 30 min',
            'Get a booking code to show your driver at pickup',
            'Track your driver live on the day of travel',
          ].map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Payment method */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How would you like to pay?</Text>
          {([
            { id: 'card', emoji: '💳', label: 'Card / Instant EFT', sub: 'Pay now securely via PayFast' },
            { id: 'eft',  emoji: '🏦', label: 'Manual EFT',         sub: 'Bank transfer + upload proof' },
          ] as const).map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.methodRow, payMethod === opt.id && styles.methodRowActive]}
              onPress={() => setPayMethod(opt.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.methodRadio, payMethod === opt.id && styles.methodRadioActive]}>
                {payMethod === opt.id && <View style={styles.methodRadioDot} />}
              </View>
              <Text style={styles.methodEmoji}>{opt.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodLabel, payMethod === opt.id && { color: COLORS.navy }]}>{opt.label}</Text>
                <Text style={styles.methodSub}>{opt.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky pay bar */}
      <View style={styles.payBar}>
        <View style={styles.payBarLeft}>
          <Text style={styles.payBarLabel}>{seats} seat{seats !== 1 ? 's' : ''}{selectedHub ? ` · ${hubDiscount}% hub discount` : ''}</Text>
          {selectedHub ? (
            <View style={styles.payBarPriceRow}>
              <Text style={styles.payBarStrike}>R{baseTotal.toFixed(2)}</Text>
              <Text style={styles.payBarTotal}>R{finalTotal}</Text>
            </View>
          ) : (
            <Text style={styles.payBarTotal}>R{finalTotal}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.payBtn, (booking || paying) && styles.payBtnBusy]}
          onPress={handleBook}
          disabled={booking || paying}
          activeOpacity={0.85}
        >
          {booking || paying
            ? <ActivityIndicator color={COLORS.navy} />
            : <Text style={styles.payBtnText}>
                {payMethod === 'card' ? 'Pay with PayFast →' : 'Reserve via EFT →'}
              </Text>
          }
        </TouchableOpacity>
      </View>

      <HubModal
        visible={showHubModal}
        hubs={hubs}
        discountPct={hubs[0]?.discount_percentage || 10}
        onSelect={selectHub}
        onClose={() => setShowHubModal(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.offWhite },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.navy, fontWeight: '600' },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy },
  scroll: { padding: 16, gap: 14 },

  heroCard: { backgroundColor: COLORS.navy, borderRadius: 20, padding: 20, gap: 16 },
  heroRoute: { flexDirection: 'row', alignItems: 'center' },
  heroCity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  heroCityText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  heroLine: { width: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399' },
  dotGold: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  heroMeta: { flexDirection: 'row', alignItems: 'center' },
  heroMetaItem: { flex: 1, alignItems: 'center' },
  heroMetaLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroMetaValue: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  heroMetaDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  driverName: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  driverMeta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },

  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  seatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  seatBtnDisabled: { backgroundColor: COLORS.border },
  seatBtnText: { fontSize: 22, color: 'white', fontWeight: '700', lineHeight: 26 },
  seatCountBox: { width: 52, alignItems: 'center' },
  seatCount: { fontSize: 28, fontWeight: '900', color: COLORS.navy },
  seatLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: -2 },
  pricePerSeat: { fontSize: 13, color: COLORS.textSecondary, marginLeft: 'auto' as any },

  // Mode tabs
  modeTabs: { flexDirection: 'row', gap: 10 },
  modeTab: {
    flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 3,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  modeTabActive: { borderColor: COLORS.navy, backgroundColor: '#f0f4ff' },
  modeTabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  modeTabTextActive: { color: COLORS.navy },
  modeTabSub: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  // Selected hub
  selectedHubCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ecfdf5', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.success + '44',
  },
  selectedHubInfo: { flex: 1 },
  selectedHubName: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  selectedHubAddress: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  changeHubBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.navy },
  changeHubText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  // Address block
  addressBlock: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, overflow: 'visible' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  addressConnector: { height: 1, backgroundColor: COLORS.border, marginLeft: 40 },
  addressDot: { width: 10, height: 10, borderRadius: 5, marginTop: 14, flexShrink: 0 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 8 },
  addressInputDetected: { color: COLORS.navy, fontWeight: '600' },
  gpsTag: { backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gpsTagText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  detectingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  detectingText: { fontSize: 14, color: COLORS.textSecondary },
  addressHint: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
  savedAddressHint: {
    backgroundColor: '#eff6ff', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  savedAddressHintText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  // Dropdown
  dropdown: {
    marginHorizontal: 14, marginTop: 2,
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8, zIndex: 999,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownIcon: { fontSize: 14 },
  dropdownMain: { fontSize: 14, fontWeight: '600', color: COLORS.navy },
  dropdownSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  // Steps
  stepsCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 14 },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 12, fontWeight: '700', color: COLORS.gold },
  stepText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, paddingTop: 2 },

  // EFT proof screen
  eftRefCard: {
    backgroundColor: COLORS.navy, borderRadius: 20, padding: 22, alignItems: 'center', gap: 8,
  },
  eftRefLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase' },
  eftRefCode: { fontSize: 36, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  eftRefHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18, marginTop: 4 },
  eftDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  eftDetailLabel: { fontSize: 13, color: COLORS.textSecondary },
  eftDetailValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  eftEmailNote: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginTop: 8 },
  eftProofSub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  eftUploadBtn: {
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 14,
    padding: 24, alignItems: 'center', gap: 6, backgroundColor: COLORS.offWhite,
  },
  eftUploadDone: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eftUploadDoneIcon: { fontSize: 20 },
  eftUploadDoneText: { fontSize: 14, fontWeight: '600', color: COLORS.success, flex: 1 },
  eftChangeText: { fontSize: 13, color: COLORS.navy, fontWeight: '600' },
  eftUploadIcon: { fontSize: 28 },
  eftUploadText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  eftUploadSub: { fontSize: 12, color: COLORS.textMuted },
  eftSubmitBtn: {
    backgroundColor: COLORS.navy, borderRadius: 14, padding: 16, alignItems: 'center',
  },
  eftSubmitText: { color: 'white', fontWeight: '800', fontSize: 15 },
  eftLaterBtn: { alignItems: 'center', padding: 12 },
  eftLaterText: { fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'underline' },

  // Payment method selector
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  methodRowActive: { borderColor: COLORS.navy, backgroundColor: '#f0f4ff' },
  methodRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  methodRadioActive: { borderColor: COLORS.navy },
  methodRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.navy },
  methodEmoji: { fontSize: 20 },
  methodLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  methodSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  // Sticky pay bar
  payBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  payBarLeft: { flex: 1 },
  payBarLabel: { fontSize: 12, color: COLORS.textMuted },
  payBarPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  payBarStrike: { fontSize: 14, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  payBarTotal: { fontSize: 24, fontWeight: '900', color: COLORS.navy },
  payBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center', minWidth: 160,
  },
  payBtnBusy: { opacity: 0.7 },
  payBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 15 },

  // Hub modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 16 },
  hubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  hubIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center' },
  hubIcon: { fontSize: 20 },
  hubName: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  hubAddress: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  hubSaveBadge: { backgroundColor: '#ecfdf5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  hubSaveText: { fontSize: 12, fontWeight: '800', color: COLORS.success },
  modalClose: {
    marginTop: 16, backgroundColor: COLORS.offWhite, borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  modalCloseText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
})
