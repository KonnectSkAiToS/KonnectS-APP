/**
 * Haptic Vibration Feedback Utility using empty mocks to remove local haptics hardware calls.
 * Safe for modern browsers, iframe previews, and headless testing.
 */
export const haptics = {
  isEnabled: () => false,
  isBookingsEnabled: () => false,
  isRidesEnabled: () => false,
  getIntensityMultiplier: () => 1.0,
  scale: (duration: number | number[]): number | number[] => duration,
  light: () => {
    // console.log('[Haptics Mock] Light tap');
  },
  interaction: () => {
    // console.log('[Haptics Mock] Interaction');
  },
  medium: () => {
    // console.log('[Haptics Mock] Medium');
  },
  success: () => {
    // console.log('[Haptics Mock] Success');
  },
  bookingSuccess: () => {
    // console.log('[Haptics Mock] Booking Success');
  },
  rideUpdate: () => {
    // console.log('[Haptics Mock] Ride Update');
  },
  rideArrival: () => {
    // console.log('[Haptics Mock] Ride Arrival');
  },
  messageNotification: () => {
    // console.log('[Haptics Mock] Message Notification');
  },
  error: () => {
    // console.log('[Haptics Mock] Error');
  },
  heavy: () => {
    // console.log('[Haptics Mock] Heavy warning');
  },
  beacon: () => {
    // console.log('[Haptics Mock] Beacon rhythm');
  }
};
