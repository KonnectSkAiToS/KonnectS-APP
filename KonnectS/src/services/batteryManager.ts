/**
 * Intelligent Battery Manager Service
 * Monitors device battery level and manages background power configurations.
 * Automatically reduces polling frequency & network background syncs when battery < 20% or battery saver is toggled.
 */

export interface BatteryStatus {
  level: number; // 0 to 100
  charging: boolean;
  batterySaver: boolean;
}

class BatteryManagerService {
  private level: number = 100;
  private charging: boolean = true;
  private batterySaver: boolean = false;
  private listeners: Set<(status: BatteryStatus) => void> = new Set();

  constructor() {
    this.batterySaver = localStorage.getItem('battery_saver_enabled') === 'true';
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;

    // Check if the experimental/standard Battery Status API is available
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.level = Math.round(battery.level * 100);
        this.charging = battery.charging;

        const updateBatteryDetails = () => {
          this.level = Math.round(battery.level * 100);
          this.charging = battery.charging;
          this.notify();
          
          // Trigger automatic optimization triggers if low battery
          if (this.isBatteryLow() && !this.charging) {
            console.warn('[BatteryManager] Low battery detected (<20%). Activating Auto Power Saver optimizations...');
            window.dispatchEvent(new CustomEvent('battery-saver-triggered', { detail: { auto: true } }));
          }
        };

        battery.addEventListener('levelchange', updateBatteryDetails);
        battery.addEventListener('chargingchange', updateBatteryDetails);
        updateBatteryDetails();
      } catch (err) {
        console.warn('Battery Status API blocked or unsupported:', err);
        this.loadSimulatedState();
      }
    } else {
      this.loadSimulatedState();
    }
  }

  private loadSimulatedState() {
    // If API unavailable, fallback or support a simulated dashboard level in Settings
    const cachedLevel = localStorage.getItem('simulated_battery_level');
    this.level = cachedLevel ? parseInt(cachedLevel, 10) : 78;
    this.charging = localStorage.getItem('simulated_battery_charging') !== 'false';
  }

  public getStatus(): BatteryStatus {
    return {
      level: this.level,
      charging: this.charging,
      batterySaver: this.isBatterySaverActive()
    };
  }

  public isBatteryLow(): boolean {
    return this.level < 20;
  }

  public isBatterySaverActive(): boolean {
    // Active if manually toggled in settings OR if physical battery drops below 20% on battery
    return this.batterySaver || (this.isBatteryLow() && !this.charging);
  }

  public setBatterySaver(enabled: boolean) {
    this.batterySaver = enabled;
    localStorage.setItem('battery_saver_enabled', String(enabled));
    this.notify();
    window.dispatchEvent(new CustomEvent('battery-saver-changed', { detail: { enabled } }));
  }

  public setSimulatedLevel(level: number) {
    this.level = level;
    localStorage.setItem('simulated_battery_level', String(level));
    this.notify();
    
    if (this.isBatteryLow() && !this.charging) {
      window.dispatchEvent(new CustomEvent('battery-saver-triggered', { detail: { auto: true } }));
    }
  }

  public setSimulatedCharging(charging: boolean) {
    this.charging = charging;
    localStorage.setItem('simulated_battery_charging', String(charging));
    this.notify();
  }

  public subscribe(cb: (status: BatteryStatus) => void) {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach(cb => cb(current));
    // Dispatch general CustomEvent for components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('battery-status-updated', { detail: current }));
    }
  }

  /**
   * Adjusts active sync rate based on power state.
   * Standard: 20s
   * Battery Saver or Low Battery: 120s (2 minutes)
   */
  public getSyncIntervalMs(): number {
    return this.isBatterySaverActive() ? 120000 : 20000;
  }

  /**
   * Adjusts location update frequency or limits geolocation polls
   * Standard: 30s
   * Low Power: 180s (3 minutes)
   */
  public getLocationIntervalMs(): number {
    return this.isBatterySaverActive() ? 180000 : 30000;
  }
}

export const batteryManager = new BatteryManagerService();
