import crypto from 'crypto';
import QRCode from 'qrcode';
import { supabase } from '../config/supabase';
import { config } from '../config/env';
import { CertificateSettings, CourseRegistration, IssuedCertificate, TrainingSession } from '../types';
import { renderHtmlToPdf } from '../utils/html-pdf.util';
import { renderCertificatePageHtml, CertTemplateConfig } from '../utils/certificate-render.util';
import {
  createTrainingCertificateSignedUrl,
  uploadTrainingCertificate,
} from './training-certificate-storage.service';
import { setupStatusService } from './setup-status.service';
import { getSchoolMailer } from './email.service';
import { sendEmail } from './mail';

const FRONTEND_BASE_URL = config.frontend.url.replace(/\/$/, '');

interface RegistrationRow {
  id: string;
  session_id: string;
  student_type: 'internal' | 'external';
  student_id: string | null;
  ext_student_name: string | null;
  payment_status: string;
  registration_status: string;
  attendance_status: boolean;
  final_score: number | null;
  student?: {
    id: string;
    student_number: string;
    profile?: { first_name: string; last_name: string; email: string | null };
  } | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

class TrainingCertificateService {
  /**
   * Attendance is a single boolean on course_registrations (no per-session attendance log),
   * so "attendance rate" is pragmatically mapped to 100% when marked present and 0% otherwise.
   * This is a deliberate simplification, not a full attendance-tracking system.
   */
  checkEligibility(registration: RegistrationRow, settings: CertificateSettings): EligibilityResult {
    const reasons: string[] = [];

    if (registration.registration_status !== 'confirmed') {
      reasons.push('Registration is not confirmed');
    }

    if (settings.min_attendance_rate > 0) {
      const attendanceRate = registration.attendance_status ? 100 : 0;
      if (attendanceRate < settings.min_attendance_rate) {
        reasons.push(`Attendance ${attendanceRate}% below required ${settings.min_attendance_rate}%`);
      }
    }

    if (settings.min_passing_grade > 0) {
      if (registration.final_score === null || registration.final_score === undefined) {
        reasons.push('Final score not recorded');
      } else if (registration.final_score < settings.min_passing_grade) {
        reasons.push(`Score ${registration.final_score} below required ${settings.min_passing_grade}`);
      }
    }

    if (settings.require_payment_cleared && registration.payment_status !== 'paid') {
      reasons.push('Payment not cleared');
    }

    return { eligible: reasons.length === 0, reasons };
  }

  private participantName(reg: RegistrationRow): string {
    if (reg.student_type === 'internal') {
      const p = reg.student?.profile;
      return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || reg.student?.student_number || 'Participant' : 'Participant';
    }
    return reg.ext_student_name || 'Participant';
  }

  private participantEmail(reg: RegistrationRow): string | null {
    if (reg.student_type === 'internal') return reg.student?.profile?.email ?? null;
    return null; // external/walk-in registrants have no email field captured today
  }

  async buildCertificateData(
    reg: RegistrationRow,
    session: TrainingSession,
    verificationCode: string
  ): Promise<Record<string, any>> {
    let campus: any = null;
    try {
      campus = await setupStatusService.getCampusById(session.school_id);
    } catch {
      // Non-fatal — certificate still renders with blank campus tokens.
    }

    const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : '');

    return {
      participant_name: this.participantName(reg),
      participant_email: this.participantEmail(reg) ?? '',
      participant_phone: '',
      session_title: session.title,
      session_category: session.category ?? '',
      start_date: fmt(session.start_date),
      end_date: fmt(session.end_date),
      total_duration_hours: session.total_duration_hours != null ? String(session.total_duration_hours) : '',
      instructor_name: session.instructor_name ?? '',
      delivery_mode: session.delivery_mode ?? '',
      location_venue: session.location_venue_link ?? '',
      completion_date: fmt(session.end_date),
      final_score: reg.final_score != null ? String(reg.final_score) : '',
      verification_code: verificationCode,
      campus_name: campus?.name ?? '',
      campus_address: campus?.address ?? '',
      school_name: campus?.name ?? '',
      school_logo: campus?.logo_url ?? '',
      current_date: new Date().toLocaleDateString(),
      issue_date: new Date().toLocaleDateString(),
      achievement_title: 'Certificate of Completion',
      award_title: 'Certificate of Completion',
      issuing_authority: campus?.name ?? '',
      signature_1_name: '', // filled from certificate_settings.authorized_signatory by the caller
      signature_1_title: '',
    };
  }

  /**
   * The certificate builder has no dedicated "QR code" field type — verification_code is
   * just another {{token}} an admin could drop into a text field, which would render as
   * unreadable plain text. So when a session's certificate_settings.enable_verification_qr
   * is on, a real scannable QR (encoding the public verify-by-code URL) is generated here
   * and appended as an extra image field in the template's bottom-right corner, without the
   * admin needing to place anything in the builder themselves.
   */
  private async withVerificationQrField(config: CertTemplateConfig, verificationCode: string): Promise<CertTemplateConfig> {
    const verifyUrl = `${FRONTEND_BASE_URL}/verify-certificate/${verificationCode}`;
    const qrDataUri = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });

    const qrSize = 70;
    const margin = 20;
    return {
      ...config,
      fields: [
        ...config.fields,
        {
          id: '__verification_qr',
          label: 'Verification QR',
          token: qrDataUri,
          type: 'image',
          position: { x: config.layout.width - qrSize - margin, y: config.layout.height - qrSize - margin },
          size: { width: qrSize, height: qrSize },
        },
      ],
    };
  }

  private async fetchRegistration(registrationId: string, sessionId: string): Promise<RegistrationRow | null> {
    const { data, error } = await supabase
      .from('course_registrations')
      .select('*, student:students(id, student_number, profile:profiles(first_name, last_name, email))')
      .eq('id', registrationId)
      .eq('session_id', sessionId)
      .single();
    if (error || !data) return null;
    return data as any;
  }

  private async fetchSession(sessionId: string, schoolId: string): Promise<TrainingSession | null> {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .single();
    if (error || !data) return null;
    return data as any;
  }

  /**
   * Issues one certificate: renders the template's PDF, uploads it, records the
   * issuance, and delivers it per certificate_settings.distribution_methods.
   * Idempotent per (registration, template): re-issuing the exact same template
   * for a registration that already has one is rejected — use a different
   * templateId or delete the prior issuance first.
   */
  async issueCertificate(
    registrationId: string,
    sessionId: string,
    schoolId: string,
    templateId: string,
    issuedBy: string | null
  ): Promise<IssuedCertificate> {
    const session = await this.fetchSession(sessionId, schoolId);
    if (!session) throw new Error('Session not found');

    const reg = await this.fetchRegistration(registrationId, sessionId);
    if (!reg) throw new Error('Registration not found');

    const { data: existing } = await supabase
      .from('issued_certificates')
      .select('id')
      .eq('registration_id', registrationId)
      .eq('template_id', templateId)
      .maybeSingle();
    if (existing) throw new Error('Certificate already issued for this registration with this template');

    const { data: template, error: templateError } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('id', templateId)
      .eq('campus_id', schoolId)
      .single();
    if (templateError || !template) throw new Error('Certificate template not found');
    if (template.recipient_type !== 'training') {
      throw new Error('Template is not a training-recipient certificate template');
    }

    const verificationCode = crypto.randomUUID();
    const settings = (session.certificate_settings ?? {}) as CertificateSettings;
    const data = await this.buildCertificateData(reg, session, verificationCode);
    data.signature_1_name = settings.authorized_signatory ?? '';

    let templateConfig = template.template_config as CertTemplateConfig;
    if (settings.enable_verification_qr) {
      templateConfig = await this.withVerificationQrField(templateConfig, verificationCode);
    }

    const html = renderCertificatePageHtml(templateConfig, data);
    const pdfBuffer = await renderHtmlToPdf(html, {
      width: `${templateConfig.layout.width}px`,
      height: `${templateConfig.layout.height}px`,
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
    });

    const storageKey = `${schoolId}/${sessionId}/${registrationId}-${Date.now()}.pdf`;
    const uploaded = await uploadTrainingCertificate(storageKey, pdfBuffer);
    if (!uploaded) throw new Error('Failed to upload generated certificate');

    const distribution = settings.distribution_methods ?? { dashboard: true, email: false };

    const { data: issued, error: insertError } = await supabase
      .from('issued_certificates')
      .insert({
        session_id: sessionId,
        registration_id: registrationId,
        template_id: templateId,
        recipient_name: this.participantName(reg),
        pdf_storage_key: storageKey,
        verification_code: verificationCode,
        issued_by: issuedBy,
        delivery_dashboard: distribution.dashboard ?? true,
      })
      .select()
      .single();
    if (insertError) throw new Error(`Failed to record issued certificate: ${insertError.message}`);

    if (distribution.email) {
      await this.deliverByEmail(issued.id, reg, session, schoolId, pdfBuffer);
    }

    return this.withDownloadUrl(issued);
  }

  private async deliverByEmail(
    issuedCertificateId: string,
    reg: RegistrationRow,
    session: TrainingSession,
    schoolId: string,
    pdfBuffer: Buffer
  ): Promise<void> {
    const to = this.participantEmail(reg);
    if (!to) {
      await supabase
        .from('issued_certificates')
        .update({ delivery_email_error: 'No email on file for this participant' })
        .eq('id', issuedCertificateId);
      return;
    }

    try {
      const { transporter, fromAddress } = await getSchoolMailer(schoolId);
      await sendEmail({
        to,
        subject: `Your certificate — ${session.title}`,
        html: `<p>Congratulations! Your certificate for <strong>${session.title}</strong> is attached.</p>`,
        transporter,
        fromAddress,
        attachments: [{ filename: 'certificate.pdf', content: pdfBuffer, contentType: 'application/pdf' }],
      });

      await supabase
        .from('issued_certificates')
        .update({ delivery_email: true, delivery_email_sent_at: new Date().toISOString(), delivery_email_error: null })
        .eq('id', issuedCertificateId);
    } catch (err: any) {
      await supabase
        .from('issued_certificates')
        .update({ delivery_email_error: err.message ?? 'Failed to send email' })
        .eq('id', issuedCertificateId);
    }
  }

  /**
   * Re-evaluates auto-issuance eligibility for a single registration. Called after
   * attendance/payment/score mutations when certificate_settings.enable_auto_issuance is
   * on. No-op (never throws) if the session has no auto-issuance configured or no
   * certificate_template_id chosen yet, so callers can fire-and-forget this.
   */
  async maybeAutoIssue(registrationId: string, sessionId: string, schoolId: string): Promise<void> {
    const session = await this.fetchSession(sessionId, schoolId);
    if (!session) return;
    const settings = session.certificate_settings as CertificateSettings | null;
    if (!settings?.enable_auto_issuance || !settings.certificate_template_id) return;

    const reg = await this.fetchRegistration(registrationId, sessionId);
    if (!reg) return;

    const { eligible } = this.checkEligibility(reg, settings);
    if (!eligible) return;

    const { data: existing } = await supabase
      .from('issued_certificates')
      .select('id')
      .eq('registration_id', registrationId)
      .eq('template_id', settings.certificate_template_id)
      .maybeSingle();
    if (existing) return; // already issued for this template — never re-issue silently

    try {
      await this.issueCertificate(registrationId, sessionId, schoolId, settings.certificate_template_id, null);
    } catch (err) {
      console.error('Auto-issuance failed for registration', registrationId, err);
    }
  }

  async bulkIssueEligible(
    sessionId: string,
    schoolId: string,
    issuedBy: string | null
  ): Promise<{ issued: number; skipped: number; errors: Array<{ registrationId: string; error: string }> }> {
    const session = await this.fetchSession(sessionId, schoolId);
    if (!session) throw new Error('Session not found');
    const settings = session.certificate_settings as CertificateSettings | null;
    if (!settings?.certificate_template_id) throw new Error('No certificate template selected for this session');

    const { data: regs, error } = await supabase
      .from('course_registrations')
      .select('*, student:students(id, student_number, profile:profiles(first_name, last_name, email))')
      .eq('session_id', sessionId)
      .eq('registration_status', 'confirmed');
    if (error) throw error;

    let issuedCount = 0;
    let skipped = 0;
    const errors: Array<{ registrationId: string; error: string }> = [];

    for (const reg of (regs ?? []) as RegistrationRow[]) {
      const { eligible } = this.checkEligibility(reg, settings);
      if (!eligible) {
        skipped++;
        continue;
      }
      const { data: existing } = await supabase
        .from('issued_certificates')
        .select('id')
        .eq('registration_id', reg.id)
        .eq('template_id', settings.certificate_template_id)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }
      try {
        await this.issueCertificate(reg.id, sessionId, schoolId, settings.certificate_template_id, issuedBy);
        issuedCount++;
      } catch (err: any) {
        errors.push({ registrationId: reg.id, error: err.message ?? 'Unknown error' });
      }
    }

    return { issued: issuedCount, skipped, errors };
  }

  async listForRegistration(registrationId: string, sessionId: string, schoolId: string): Promise<IssuedCertificate[]> {
    const session = await this.fetchSession(sessionId, schoolId);
    if (!session) throw new Error('Session not found');

    const { data, error } = await supabase
      .from('issued_certificates')
      .select('*')
      .eq('registration_id', registrationId)
      .eq('session_id', sessionId)
      .order('issued_at', { ascending: false });
    if (error) throw error;

    return Promise.all((data ?? []).map((c: any) => this.withDownloadUrl(c)));
  }

  async verifyByCode(code: string): Promise<{ valid: boolean; recipient_name?: string; session_title?: string; issued_at?: string }> {
    const { data, error } = await supabase
      .from('issued_certificates')
      .select('recipient_name, issued_at, session:training_sessions(title)')
      .eq('verification_code', code)
      .maybeSingle();
    if (error || !data) return { valid: false };
    return {
      valid: true,
      recipient_name: data.recipient_name,
      session_title: (data as any).session?.title,
      issued_at: data.issued_at,
    };
  }

  private async withDownloadUrl(row: any): Promise<IssuedCertificate> {
    const download_url = await createTrainingCertificateSignedUrl(row.pdf_storage_key);
    return { ...row, download_url };
  }
}

export const trainingCertificateService = new TrainingCertificateService();
