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
  type AccountGate, adminSchoolApi, campusesApi, schoolDashboardApi, twoFaApi, agreementApi, adminStudentsApi, adminAcademicsApi, adminParentsApi, adminCustomFieldsApi, adminEmployeesApi, adminFieldOrdersApi, adminSignupsApi, adminSchoolDataImportApi, exportTemplatesApi, adminParentAgreementApi, adminGroupAssignApi, adminMailApi, adminAnalyticsApi, adminDesignationsApi, adminFeesApi, adminBillingElementsApi, adminAccountingApi, adminSalaryApi, adminGradesApi, adminSchedulingApi, adminQuizApi, adminOnlineClassesApi, adminActivitiesApi, adminAttendanceApi, adminStaffAbsencesApi, adminDisciplineApi, adminEntryExitApi, adminMiqatApi, adminInspectionsApi, adminPerformanceApi, adminTimetableApi, adminPeriodsApi, adminCalendarsApi, adminGeneratorApi, adminPortalApi, adminRolloverApi, adminCalculationsApi, adminTrainingApi, adminWeatherApi, adminServicesApi, adminUserProfilesApi, adminPushApi, adminPublicPagesApi, adminHostelApi, adminLibraryApi, adminTextbooksApi, adminQirtasiApi, adminResourcesApi, adminVaultApi, adminHifziApi, quranApi, finaApi, adminSpeedReadingApi, hadithFortyApi, adminCoursesApi, adminTeacherProgramsApi, jitsiApi, adminHistoricalGradesApi, adminHumanResourcesApi, adminLetterTemplatesApi, portalApi, learningResourcesApi, teacherInspectionsApi, readingLogsApi, inspectorApi, librarianApi, jahbadhGradesApi, jahbadhControlApi } from '@studently/api-client'
import Constants from 'expo-constants'

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

export const api = createApiClient({
  baseUrl: env.apiUrl,
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
