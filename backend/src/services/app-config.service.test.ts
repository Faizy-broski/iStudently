import { readAppConfig } from './app-config.service'

describe('readAppConfig', () => {
  const now = new Date('2026-10-06T10:00:00.000Z')

  it('defaults to no limits, no maintenance, no flags', () => {
    expect(readAppConfig({}, now)).toEqual({
      ios: { min_version: null, latest_version: null, store_url: null },
      android: { min_version: null, latest_version: null, store_url: null },
      maintenance: { enabled: false, message: { en: null, ar: null } },
      flags: {},
      links: { privacy_url: null, terms_url: null, account_deletion_url: null, support_email: null },
      server_time: '2026-10-06T10:00:00.000Z',
    })
  })

  it('reads versions, store URLs, maintenance and flags', () => {
    const cfg = readAppConfig(
      {
        MOBILE_MIN_VERSION_IOS: '1.0.0',
        MOBILE_LATEST_VERSION_IOS: '1.2',
        MOBILE_MIN_VERSION_ANDROID: ' 1.1.0 ',
        MOBILE_STORE_URL_ANDROID: 'https://play.google.com/store/apps/details?id=ly.istudent.app',
        MOBILE_MAINTENANCE: 'TRUE',
        MOBILE_MAINTENANCE_MESSAGE_EN: 'Back soon',
        MOBILE_MAINTENANCE_MESSAGE_AR: 'نعود قريبًا',
        MOBILE_FLAGS: '{"social_wall":false,"miqat_scanner":true}',
      },
      now,
    )
    expect(cfg.ios).toMatchObject({ min_version: '1.0.0', latest_version: '1.2' })
    expect(cfg.android.min_version).toBe('1.1.0')
    expect(cfg.android.store_url).toContain('ly.istudent.app')
    expect(cfg.maintenance).toEqual({ enabled: true, message: { en: 'Back soon', ar: 'نعود قريبًا' } })
    expect(cfg.flags).toEqual({ social_wall: false, miqat_scanner: true })
  })

  it('ignores malformed versions and non-boolean or invalid flags', () => {
    const cfg = readAppConfig({ MOBILE_MIN_VERSION_IOS: 'latest', MOBILE_FLAGS: '{"a":true,"b":"yes"}' }, now)
    expect(cfg.ios.min_version).toBeNull()
    expect(cfg.flags).toEqual({ a: true })
    expect(readAppConfig({ MOBILE_FLAGS: 'not json' }, now).flags).toEqual({})
    expect(readAppConfig({ MOBILE_FLAGS: '[true]' }, now).flags).toEqual({})
  })

  it('maintenance only when explicitly true', () => {
    expect(readAppConfig({ MOBILE_MAINTENANCE: '1' }, now).maintenance.enabled).toBe(false)
  })

  it('links: https URLs and a valid support email only', () => {
    const cfg = readAppConfig(
      {
        MOBILE_PRIVACY_URL: ' https://istudent.ly/privacy ',
        MOBILE_TERMS_URL: 'http://istudent.ly/terms',
        MOBILE_ACCOUNT_DELETION_URL: 'javascript:alert(1)',
        MOBILE_SUPPORT_EMAIL: 'support@istudent.ly',
      },
      now,
    )
    expect(cfg.links).toEqual({ privacy_url: 'https://istudent.ly/privacy', terms_url: null, account_deletion_url: null, support_email: 'support@istudent.ly' })
    expect(readAppConfig({ MOBILE_SUPPORT_EMAIL: 'nope' }, now).links.support_email).toBeNull()
  })
})
