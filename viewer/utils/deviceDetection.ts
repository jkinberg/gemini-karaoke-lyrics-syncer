/**
 * Device detection utilities for determining mobile vs desktop
 */

/**
 * Detects if the current device is a mobile device based on user agent.
 * Used to choose between YouTube embed (desktop) and HTML5 audio player (mobile).
 *
 * @returns true if the device is iOS or Android mobile
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();

  // Check for iOS devices (iPhone, iPad, iPod)
  const isIOS = /iphone|ipad|ipod/.test(userAgent);

  // Check for Android devices
  const isAndroid = /android/.test(userAgent);

  // Additional check for mobile-specific indicators
  const isMobileUA = /mobile|webos|blackberry|opera mini|opera mobi|iemobile/.test(userAgent);

  return isIOS || isAndroid || isMobileUA;
}

/**
 * Detects if the device is specifically iOS (Safari)
 * Useful for iOS-specific audio handling
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}
