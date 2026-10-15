import { describe, expect, it } from 'vitest'

import { ADMIN_GROUP_WAVE, ADMIN_MENU, adminMenuHrefs, filterAdminMenu, type AdminMenuGroup } from './admin-menu'

const MENU: AdminMenuGroup[] = [
  { title: 'dashboard', href: '/admin/dashboard', items: [] },
  {
    title: 'students',
    href: '#',
    items: [
      { title: 'list', href: '/admin/students' },
      { title: 'reports_label', href: '#', label: true },
      { title: 'letters', href: '/admin/students/print-letters' },
      { title: 'atlas', href: '/admin/students/atlas', plugin: 'human_atlas' },
    ],
  },
  { title: 'hifzi', href: '#', plugin: 'hifzi', items: [{ title: 'circles', href: '/admin/hifzi' }] },
  { title: 'fees', href: '#', items: [{ title: 'payments', href: '/admin/fees/payments' }] },
]

const hrefs = (g: AdminMenuGroup[]) => adminMenuHrefs(g)

describe('admin menu snapshot', () => {
  it('has the admin sidebar with pages', () => {
    expect(ADMIN_MENU.length).toBeGreaterThan(30)
    expect(adminMenuHrefs().length).toBeGreaterThan(250)
  })

  it('every web admin group has a build wave (update ADMIN_GROUP_WAVE when the web adds one)', () => {
    expect(ADMIN_MENU.map((g) => g.title).filter((t) => !(t in ADMIN_GROUP_WAVE))).toEqual([])
  })
})

describe('filterAdminMenu', () => {
  it('admin with no plugins sees everything not plugin-gated', () => {
    expect(hrefs(filterAdminMenu({ role: 'admin', plugins: [] }, MENU))).toEqual([
      '/admin/dashboard',
      '/admin/students',
      '/admin/students/print-letters',
      '/admin/fees/payments',
    ])
  })

  it('plugins switch on gated groups and items', () => {
    const out = hrefs(filterAdminMenu({ role: 'admin', plugins: ['hifzi', 'human_atlas'] }, MENU))
    expect(out).toContain('/admin/hifzi')
    expect(out).toContain('/admin/students/atlas')
  })

  it("the school's deny-list hides pages and empty groups", () => {
    const out = filterAdminMenu({ role: 'admin', plugins: [], deniedModules: ['/admin/fees/payments', '/admin/students/print-letters'] }, MENU)
    expect(out.map((g) => g.title)).toEqual(['dashboard', 'students'])
    // the label had no page left under it
    expect(out[1].items.map((i) => i.title)).toEqual(['list'])
  })

  it('staff see only what their profile allows; no profile = nothing', () => {
    const perms = [{ module_key: '/admin/students', can_use: true, can_edit: false }]
    expect(hrefs(filterAdminMenu({ role: 'staff', plugins: [], permissions: perms }, MENU))).toEqual(['/admin/students'])
    expect(hrefs(filterAdminMenu({ role: 'staff', plugins: [], permissions: null }, MENU))).toEqual([])
  })

  it('custom order applies only with the custom_menu plugin', () => {
    const order = ['fees', 'students']
    expect(filterAdminMenu({ role: 'admin', plugins: [], customOrder: order }, MENU)[0].title).toBe('dashboard')
    expect(filterAdminMenu({ role: 'admin', plugins: ['custom_menu'], customOrder: order }, MENU).map((g) => g.title)).toEqual(['fees', 'students', 'dashboard'])
  })
})

import { filterAdminMenu as filterMenu, ROLE_MENUS } from './admin-menu'

describe('role menus', () => {
  it('has the student, parent and teacher sidebars', () => {
    expect(ROLE_MENUS.student.some((g) => g.href === '/student/dashboard')).toBe(true)
    expect(ROLE_MENUS.parent.length).toBeGreaterThan(5)
    expect(ROLE_MENUS.teacher.length).toBeGreaterThan(5)
  })
  it('hides plugin pages until the plugin is on, and keeps the rest without a profile', () => {
    const off = filterMenu({ role: 'student', plugins: [] }, ROLE_MENUS.student).flatMap((g) => g.items.map((i) => i.href))
    const on = filterMenu({ role: 'student', plugins: ['qirtasi'] }, ROLE_MENUS.student).flatMap((g) => g.items.map((i) => i.href))
    expect(off).not.toContain('/student/qirtasi/worksheets')
    expect(on).toContain('/student/qirtasi/worksheets')
    expect(off).toContain('/student/attendance')
  })
})
