import express from 'express'
import type { AddressInfo } from 'net'
import router from './client-errors.routes'

let base = ''
let server: any
const logged: string[] = []
let spy: jest.SpyInstance
beforeAll((done) => {
  spy = jest.spyOn(console, 'error').mockImplementation((line: string) => void logged.push(line))
  const app = express()
  app.use(express.json())
  app.use('/api/client-errors', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/client-errors`
    done()
  })
})
afterAll(() => {
  server.close()
  spy.mockRestore()
})

const post = (body: unknown) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('client-errors route', () => {
  it('logs one capped line per report and needs a message', async () => {
    expect((await post({})).status).toBe(400)
    expect((await post({ message: 'x'.repeat(5000), stack: 'y'.repeat(9000), platform: 'ios', extra: 'ignored' })).status).toBe(202)
    const line = logged.find((l) => l.startsWith('[client-error] '))!
    const report = JSON.parse(line.slice('[client-error] '.length))
    expect(report.message).toHaveLength(1000)
    expect(report.stack).toHaveLength(4000)
    expect(report.platform).toBe('ios')
    expect(report.extra).toBeUndefined()
  })

  it('rate limits a flood from one address', async () => {
    let last = 0
    for (let i = 0; i < 35; i++) last = (await post({ message: 'm' })).status
    expect(last).toBe(429)
  })
})
