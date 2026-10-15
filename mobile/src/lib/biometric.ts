import * as LocalAuthentication from 'expo-local-authentication'

/**
 * Re-confirm the user before showing sensitive data (Face ID / fingerprint, falling back to the
 * device passcode). Devices with no lock screen at all are allowed through: there is nothing to
 * check against, and the session itself is already authenticated.
 */
export async function confirmIdentity(reason: string): Promise<boolean> {
  const [hasHardware, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ])
  if (!hasHardware && level === LocalAuthentication.SecurityLevel.NONE) return true
  if (level === LocalAuthentication.SecurityLevel.NONE) return true
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false })
  return res.success
}
