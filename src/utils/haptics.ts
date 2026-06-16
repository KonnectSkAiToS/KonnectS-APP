/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Haptic Vibration Feedback Utility using the HTML5 Vibration API.
 * Ensures compatibility inside modern browsers and mobile device views.
 */
export const haptics = {
  /**
   * Helper to check if haptics are globally enabled by the user.
   */
  isEnabled: () => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('haptics_enabled') !== 'false';
    }
    return true;
  },

  /**
   * Helper to check if haptics are enabled for successful bookings.
   */
  isBookingsEnabled: () => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('haptics_bookings') !== 'false';
    }
    return true;
  },

  /**
   * Helper to check if haptics are enabled for incoming ride updates.
   */
  isRidesEnabled: () => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('haptics_rides') !== 'false';
    }
    return true;
  },

  /**
   * Returns a multiplier for vibration duration based on user preference:
   * 'subtle' => 0.5, 'medium' => 1.0, 'strong' => 1.8.
   */
  getIntensityMultiplier: () => {
    if (typeof localStorage !== 'undefined') {
      const mode = localStorage.getItem('haptics_intensity') || 'medium';
      if (mode === 'subtle') return 0.5;
      if (mode === 'strong') return 1.8;
    }
    return 1.0;
  },

  /**
   * Multiplies array of vibration pulses or single pulse duration by the intensity multiplier.
   */
  scale: (duration: number | number[]): number | number[] => {
    const factor = haptics.getIntensityMultiplier();
    if (Array.isArray(duration)) {
      return duration.map((d, idx) => (idx % 2 === 0 ? Math.round(d * factor) : d));
    }
    return Math.round(duration * factor);
  },

  /**
   * Short light tap for standard button clicks and small interaction elements.
   */
  light: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale(15));
    }
  },

  /**
   * General interaction event feedback.
   */
  interaction: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale(25));
    }
  },

  /**
   * Medium single pulse for intermediate alerts, checkpoints, or list selection.
   */
  medium: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale(55));
    }
  },

  /**
   * Double pulse indicating success (general success triggers).
   */
  success: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale([70, 35, 70]));
    }
  },

  /**
   * Dedicated subtle pulse pattern for successful booking confirmation.
   */
  bookingSuccess: () => {
    if (haptics.isEnabled() && haptics.isBookingsEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      // Shorter, softer success pulses
      navigator.vibrate(haptics.scale([40, 25, 40, 25, 40]));
    }
  },

  /**
   * Dedicated vibration indicator for incoming ride actions / updates.
   */
  rideUpdate: () => {
    if (haptics.isEnabled() && haptics.isRidesEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      // Oscillating notice for ride movements
      navigator.vibrate(haptics.scale([30, 60, 30]));
    }
  },

  /**
   * Quick distinct double hazard rhythm for error conditions.
   */
  error: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale([120, 60, 120]));
    }
  },

  /**
   * Single heavy vibration feedback for high-risk tactile warning screens (e.g. panic alarm).
   */
  heavy: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale(180));
    }
  },

  /**
   * Rhythm pulse feedback pattern indicating scanning, beacon, voice-cmd, or maps search radar.
   */
  beacon: () => {
    if (haptics.isEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(haptics.scale([90, 45, 90, 45, 120]));
    }
  }
};
