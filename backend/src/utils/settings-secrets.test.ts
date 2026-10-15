import { withoutSettingsSecrets } from './settings-secrets'

describe('withoutSettingsSecrets', () => {
  it('drops credential columns and keeps the rest', () => {
    const out = withoutSettingsSecrets({
      school_id: 's1',
      active_plugins: { fina: true },
      smtp_pass: 'pw',
      social_login_config: { google_client_secret: 'x' },
      vlaby_config: { token: 't' },
    })
    expect(out).toEqual({ school_id: 's1', active_plugins: { fina: true } })
  })
})
