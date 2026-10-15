import { cronSecretValid } from './cron-secret'

describe('cronSecretValid', () => {
  it('fails closed when no secret is configured', () => {
    expect(cronSecretValid('anything', undefined)).toBe(false)
    expect(cronSecretValid(undefined, undefined)).toBe(false)
  })
  it('needs an exact match', () => {
    expect(cronSecretValid('s3cret', 's3cret')).toBe(true)
    expect(cronSecretValid('s3cre', 's3cret')).toBe(false)
    expect(cronSecretValid(['s3cret'], 's3cret')).toBe(false)
  })
})
