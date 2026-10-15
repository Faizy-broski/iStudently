// Real router; auth and controllers stubbed. Students may read only their own loans and fines.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1' }
    next()
  },
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/library.controller', () => ({
  libraryController: new Proxy({}, { get: () => jest.fn(ok) }),
}))
jest.mock('../controllers/elibrary-reading.controller', () => ({
  elibraryReadingController: new Proxy({}, { get: () => jest.fn(ok) }),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './library.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use('/api/library', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/library`
    done()
  })
})
afterAll(() => server.close())

const get = (path: string, role: string) => fetch(`${base}${path}`, { headers: { 'x-test-role': role } })

describe('library student loan routes', () => {
  it('a student reads only their own loans and fines', async () => {
    for (const p of ['loans/active', 'loans/overdue', 'loans/history', 'fines/unpaid']) {
      expect((await get(`/students/p1/${p}`, 'student')).status).toBe(200)
      expect((await get(`/students/p2/${p}`, 'student')).status).toBe(403)
    }
    expect((await get('/students/p2/loans/active', 'librarian')).status).toBe(200)
    expect((await get('/students/p2/loans/active', 'parent')).status).toBe(403)
  })
})
