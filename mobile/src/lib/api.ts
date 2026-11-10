import {
  authApi,
  classDiaryApi,
  createApiClient,
  eventsApi,
  grievancesApi,
  mediaApi,
  messagingApi,
  parentDashboardApi,
  teacherApi,
  assignmentsApi,
  examsApi,
  platformApi,
  quizApi,
  studentDashboardApi,
  type AccountGate, adminSchoolApi, campusesApi, schoolDashboardApi, twoFaApi, agreementApi, adminStudentsApi, adminAcademicsApi, adminParentsApi, adminCustomFieldsApi, adminEmployeesApi, adminFieldOrdersApi, adminSignupsApi, adminSchoolDataImportApi, exportTemplatesApi, adminParentAgreementApi, adminGroupAssignApi, adminMailApi, adminAnalyticsApi, adminDesignationsApi, adminFeesApi, adminBillingElementsApi, adminAccountingApi, adminSalaryApi, adminGradesApi, adminSchedulingApi, adminQuizApi, adminOnlineClassesApi, adminActivitiesApi, adminAttendanceApi, adminStaffAbsencesApi, adminDisciplineApi, adminEntryExitApi, adminMiqatApi, adminInspectionsApi, adminPerformanceApi, adminTimetableApi, adminPeriodsApi, adminCalendarsApi, adminGeneratorApi, adminPortalApi, adminRolloverApi, adminCalculationsApi, adminTrainingApi, adminWeatherApi, adminServicesApi, adminUserProfilesApi, adminPushApi, adminPublicPagesApi, adminHostelApi, adminLibraryApi, adminTextbooksApi, adminQirtasiApi, adminResourcesApi, adminVaultApi, adminHifziApi, quranApi, finaApi, adminSpeedReadingApi, hadithFortyApi, adminCoursesApi, adminTeacherProgramsApi, jitsiApi, adminHistoricalGradesApi, adminHumanResourcesApi, adminLetterTemplatesApi, portalApi, learningResourcesApi, teacherInspectionsApi, readingLogsApi, inspectorApi, librarianApi, jahbadhGradesApi, jahbadhControlApi, jahbadhOfficialApi, jahbadhAssessmentApi, idCardsApi } from '@studently/api-client'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import i18n from '@/i18n'

import { env } from './env'
import { supabase } from './supabase'

type GateListener = (gate: AccountGate, message?: string) => void
const gateListeners = new Set<GateListener>()

/** The auth shell subscribes to show 2FA / suspended / trial / agreement screens. */
export function onAccountGate(listener: GateListener) {
  gateListeners.add(listener)
  return () => {
    gateListeners.delete(listener)
  }
}

/**
 * On Android with the new architecture, `fetch` + FormData + file:// URIs silently fails.
 * XMLHttpRequest uses the OkHttp layer directly and handles file URIs reliably.
 */
function xhrFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  const body = init?.body

  if (Platform.OS !== 'android' || !(body instanceof FormData)) {
    return globalThis.fetch(input, init)
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(init?.method ?? 'GET', url, true)

    const headers = init?.headers as Record<string, string> | undefined
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        // Let XHR set Content-Type automatically for FormData (it adds the boundary)
        if (k.toLowerCase() !== 'content-type') xhr.setRequestHeader(k, v)
      }
    }

    xhr.onload = () => {
      const responseHeaders = new Headers()
      xhr.getAllResponseHeaders()
        .trim()
        .split(/\r?\n/)
        .forEach((line) => {
          const idx = line.indexOf(':')
          if (idx > 0) responseHeaders.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
        })
      resolve(new Response(xhr.responseText, { status: xhr.status, headers: responseHeaders }))
    }
    xhr.onerror = () => reject(new TypeError('Network request failed'))
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'))

    if (init?.signal) {
      init.signal.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')) })
    }

    xhr.send(body)
  })
}

export const api = createApiClient({
  baseUrl: env.apiUrl,
  fetch: xhrFetch,
  async getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
  async onUnauthorized() {
    await supabase.auth.signOut({ scope: 'local' })
  },
  onAccountGate(gate, message) {
    gateListeners.forEach((l) => l(gate, message))
  },
  getHeaders: () => ({
    'X-App-Version': Constants.expoConfig?.version ?? '0',
    'Accept-Language': i18n.language,
  }),
})

export const auth = authApi(api)
export const twoFa = twoFaApi(api)
export const agreement = agreementApi(api)
export const student = studentDashboardApi(api)
export const parent = parentDashboardApi(api)
export const teacher = teacherApi(api)
export const homework = assignmentsApi(api)
export const exams = examsApi(api)
export const messaging = messagingApi(api)
export const complaints = grievancesApi(api)
export const events = eventsApi(api)
export const classDiary = classDiaryApi(api)
export const quiz = quizApi(api)
export const media = mediaApi(api)
export const platform = platformApi(api)

// School admin (campus passed per call as campus_id)
export const campuses = campusesApi(api)
export const adminSchoolDataImport = adminSchoolDataImportApi(api)
export const exportTemplates = exportTemplatesApi(api)
export const adminParentAgreement = adminParentAgreementApi(api)
export const schoolDashboard = schoolDashboardApi(api)
export const adminSchool = adminSchoolApi(api)
export const adminStudents = adminStudentsApi(api)
export const adminAcademics = adminAcademicsApi(api)
export const adminParents = adminParentsApi(api)
export const adminCustomFields = adminCustomFieldsApi(api)
export const adminEmployees = adminEmployeesApi(api)
export const adminFieldOrders = adminFieldOrdersApi(api)
export const adminSignups = adminSignupsApi(api)
export const adminGroupAssign = adminGroupAssignApi(api)
export const adminMail = adminMailApi(api)
export const adminAnalytics = adminAnalyticsApi(api)
export const adminDesignations = adminDesignationsApi(api)
export const adminFees = adminFeesApi(api)
export const adminBillingElements = adminBillingElementsApi(api)
export const adminAccounting = adminAccountingApi(api)
export const adminSalary = adminSalaryApi(api)
export const adminGrades = adminGradesApi(api)
export const adminScheduling = adminSchedulingApi(api)
export const adminQuiz = adminQuizApi(api)
export const adminOnlineClasses = adminOnlineClassesApi(api)
export const adminActivities = adminActivitiesApi(api)
export const adminHistoricalGrades = adminHistoricalGradesApi(api)
export const jahbadhGrades = jahbadhGradesApi(api)
export const jahbadhControl = jahbadhControlApi(api)
export const jahbadhOfficial = jahbadhOfficialApi(api)
export const jahbadhAssessment = jahbadhAssessmentApi(api)
export const adminHumanResources = adminHumanResourcesApi(api)
export const adminLetterTemplates = adminLetterTemplatesApi(api)
export const adminAttendance = adminAttendanceApi(api)
export const adminStaffAbsences = adminStaffAbsencesApi(api)
export const adminDiscipline = adminDisciplineApi(api)
export const adminEntryExit = adminEntryExitApi(api)
export const adminMiqat = adminMiqatApi(api)
export const adminInspections = adminInspectionsApi(api)
export const adminPerformance = adminPerformanceApi(api)
export const adminTimetable = adminTimetableApi(api)
export const adminPeriods = adminPeriodsApi(api)
export const adminCalendars = adminCalendarsApi(api)
export const adminGenerator = adminGeneratorApi(api)
export const adminPortal = adminPortalApi(api)
export const adminRollover = adminRolloverApi(api)
export const adminCalculations = adminCalculationsApi(api)
export const adminTraining = adminTrainingApi(api)
export const adminWeather = adminWeatherApi(api)
export const adminServices = adminServicesApi(api)
export const adminUserProfiles = adminUserProfilesApi(api)
export const adminPush = adminPushApi(api)
export const adminPublicPages = adminPublicPagesApi(api)
export const adminHostel = adminHostelApi(api)
export const adminLibrary = adminLibraryApi(api)
export const adminTextbooks = adminTextbooksApi(api)
export const adminQirtasi = adminQirtasiApi(api)
export const adminResources = adminResourcesApi(api)
export const adminVault = adminVaultApi(api)
export const adminHifzi = adminHifziApi(api)
export const quran = quranApi(api)
export const fina = finaApi(api)
export const adminSpeedReading = adminSpeedReadingApi(api)
export const hadithForty = hadithFortyApi(api)
export const adminCourses = adminCoursesApi(api)
export const adminTeacherPrograms = adminTeacherProgramsApi(api)
export const jitsi = jitsiApi(api)

// Student, parent and teacher apps
export const portal = portalApi(api)
export const learningResources = learningResourcesApi(api)
export const teacherInspections = teacherInspectionsApi(api)
export const readingLogs = readingLogsApi(api)
export const inspector = inspectorApi(api)
export const librarian = librarianApi(api)
export const idCards = idCardsApi(api)
