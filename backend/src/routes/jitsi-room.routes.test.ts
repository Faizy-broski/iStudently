// Students and parents join Jitsi rooms but may not create them.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.profile = { id: 'p1', role: req.headers['x-test-role'], school_id: 's1' }
    next()
  },
}))
const ok = (_req: any, res: any) => res.json({ data: {}, error: null })
jest.mock('../controllers/jitsi-room.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './jitsi-room.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/jitsi/rooms', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/jitsi/rooms`
    done()
  })
})
afterAll(() => server.close())

const create = (role: string) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-role': role }, body: JSON.stringify({ title: 'Room' }) })

it.each(['student', 'parent'])('%s cannot create a room', async (role) => {
  expect((await create(role)).status).toBe(403)
})

it.each(['teacher', 'admin'])('%s can create a room', async (role) => {
  expect((await create(role)).status).toBe(200)
})
