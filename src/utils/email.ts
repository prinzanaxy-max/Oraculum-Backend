import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const emailConfig = {
  enabled: Boolean(resend),
  from: process.env.RESEND_FROM || 'Oraculum Support <onboarding@resend.dev>',
  supportEmail: process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || '',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const sendSupportContactEmail = async (input: {
  subject: string;
  message: string;
  userEmail?: string | null;
  userId?: string | null;
  requestId: string;
}) => {
  if (!resend || !emailConfig.supportEmail) {
    console.warn('Support email skipped: RESEND_API_KEY or SUPPORT_EMAIL is missing.');
    return;
  }

  const safeSubject = input.subject.trim();
  const safeMessage = input.message.trim();
  const submitter = input.userEmail || 'Unknown user';
  const htmlSubject = escapeHtml(safeSubject);
  const htmlMessage = escapeHtml(safeMessage);
  const htmlSubmitter = escapeHtml(submitter);
  const htmlRequestId = escapeHtml(input.requestId);
  const htmlUserId = input.userId ? escapeHtml(input.userId) : null;

  await resend.emails.send({
    from: emailConfig.from,
    to: emailConfig.supportEmail,
    replyTo: input.userEmail || undefined,
    subject: `Oraculum support: ${safeSubject}`,
    text: [
      'New Oraculum support request',
      '',
      `Request ID: ${input.requestId}`,
      `From: ${submitter}`,
      input.userId ? `User ID: ${input.userId}` : null,
      `Subject: ${safeSubject}`,
      '',
      safeMessage,
    ]
      .filter(Boolean)
      .join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin-bottom: 8px;">New Oraculum support request</h2>
        <p><strong>Request ID:</strong> ${htmlRequestId}</p>
        <p><strong>From:</strong> ${htmlSubmitter}</p>
        ${htmlUserId ? `<p><strong>User ID:</strong> ${htmlUserId}</p>` : ''}
        <p><strong>Subject:</strong> ${htmlSubject}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="white-space: pre-wrap;">${htmlMessage}</p>
      </div>
    `,
  });
};
