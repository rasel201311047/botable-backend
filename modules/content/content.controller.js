const Content = require('./content.model');
const ContactMessage = require('./contactMessage.model');
const FAQ = require('./faq.model');
const notificationService = require('../notification/notification.service');
const logger = require('../../utils/logger');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUpdatedAt(value) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const SUPPORT_EMAIL = 'support@bootble.com';

function normalizeBranding(value = '') {
  return String(value)
    .replace(/Bootble Fitness/g, 'Bootble')
    .replace(/admin@bootblefitness\.com/gi, SUPPORT_EMAIL)
    .replace(/support@bootblefitness\.com/gi, SUPPORT_EMAIL)
    .replace(/support@bootble\.com/gi, SUPPORT_EMAIL);
}

function parsePolicyContent(rawContent = '') {
  const lines = String(rawContent).split(/\r?\n/);
  const blocks = [];
  let intro = [];
  let currentSection = null;
  let currentSubsection = null;

  const flushSection = () => {
    if (!currentSection) return;
    blocks.push(currentSection);
    currentSection = null;
    currentSubsection = null;
  };

  const startSection = heading => {
    flushSection();
    currentSection = { heading, items: [] };
  };

  const startSubsection = label => {
    if (!currentSection) {
      currentSection = { heading: null, items: [] };
    }
    currentSubsection = { label, points: [] };
    currentSection.items.push(currentSubsection);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^\d+\.\s+/.test(line)) {
      startSection(line);
      continue;
    }

    if (/^[A-Za-z][A-Za-z0-9 ,/&()-]{1,80}:$/.test(line)) {
      startSubsection(line.slice(0, -1));
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      const point = line.replace(/^[-•]\s+/, '');
      if (currentSubsection) {
        currentSubsection.points.push(point);
      } else if (currentSection) {
        currentSection.items.push({ type: 'text', value: point });
      } else {
        intro.push(point);
      }
      continue;
    }

    if (currentSubsection) {
      currentSubsection.points.push(line);
      continue;
    }

    if (currentSection) {
      currentSection.items.push({ type: 'text', value: line });
      continue;
    }

    intro.push(line);
  }

  flushSection();

  return { intro, blocks };
}

function renderPolicyPage({ title, content, updatedAt }) {
  const safeTitle = escapeHtml(normalizeBranding(title || 'Privacy Policy'));
  const safeUpdatedAt = escapeHtml(formatUpdatedAt(updatedAt));
  const { intro, blocks } = parsePolicyContent(normalizeBranding(content));
  const introHtml = intro.length
    ? intro.map(line => `<p>${escapeHtml(line)}</p>`).join('')
    : '<p>Welcome to our Privacy Policy.</p>';

  const sectionsHtml = blocks.length
    ? blocks
        .map(block => {
          const sectionBody = block.items
            .map(item => {
              if (item.type === 'text') {
                return `<p class="section-text">${escapeHtml(item.value)}</p>`;
              }

              const pointsHtml = item.points.length
                ? `<ul>${item.points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`
                : '';

              return `
            <div class="subsection">
              <h3>${escapeHtml(item.label)}</h3>
              ${pointsHtml}
            </div>`;
            })
            .join('');

          return `
          <section class="policy-section">
            <h2>${escapeHtml(block.heading || 'Details')}</h2>
            ${sectionBody}
          </section>`;
        })
        .join('')
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${safeTitle}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #10203a;
      --muted: #5d6b82;
      --border: #dce4f0;
      --accent: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: linear-gradient(180deg, #edf4ff 0%, var(--bg) 38%, #eef2f7 100%);
      color: var(--text);
      line-height: 1.7;
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
      padding: 32px 18px 56px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 30px;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
    }
    .eyebrow {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      background: #e8f1ff;
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: clamp(30px, 5vw, 48px);
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 18px;
      color: var(--muted);
      font-size: 14px;
    }
    .meta span {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #fbfdff;
    }
    .content {
      margin-top: 24px;
      padding: 24px;
      border-radius: 20px;
      background: #fcfdff;
      border: 1px solid var(--border);
    }
    .content > p {
      margin: 0 0 16px;
      color: var(--muted);
      font-size: 16px;
    }
    .policy-section {
      margin-top: 20px;
      padding: 18px 18px 6px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid var(--border);
    }
    .policy-section h2 {
      margin: 0 0 12px;
      font-size: 20px;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }
    .section-text,
    .subsection p {
      margin: 0 0 12px;
      color: #334155;
    }
    .subsection {
      margin: 12px 0 18px;
      padding: 14px 14px 6px;
      border-radius: 16px;
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
      border: 1px solid #e7eef8;
    }
    .subsection h3 {
      margin: 0 0 10px;
      font-size: 16px;
      color: var(--accent);
    }
    ul {
      margin: 0 0 12px;
      padding-left: 20px;
      color: #334155;
    }
    li {
      margin-bottom: 8px;
    }
    @media (max-width: 640px) {
      .wrap { padding: 16px 12px 40px; }
      .hero { padding: 20px; border-radius: 20px; }
      .content { padding: 18px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <span class="eyebrow">Privacy Policy</span>
      <h1>${safeTitle}</h1>
      <div class="meta">
        <span>Updated at: ${safeUpdatedAt}</span>
      </div>
      <article class="content">
        ${introHtml}
        ${sectionsHtml || '<p>No privacy policy content available.</p>'}
      </article>
    </section>
  </main>
</body>
</html>`;
}

class ContentController {
  /**
   * @desc    Get Terms & Conditions
   * @route   GET /api/content/terms
   * @access  Public
   */
  static async getTerms(req, res, next) {
    try {
      const terms = await Content.findOne({
        type: 'terms',
        isActive: true,
      }).select('-lastUpdatedBy');

      if (!terms) {
        return res.status(404).json({
          status: 'error',
          message: 'Terms & Conditions not found',
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          content: {
            ...terms.toObject(),
            title: normalizeBranding(terms.title),
            content: normalizeBranding(terms.content),
            supportEmail: SUPPORT_EMAIL,
          },
        },
      });
    } catch (error) {
      logger.error(`Get terms error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get Privacy Policy
   * @route   GET /api/content/privacy
   * @access  Public
   */
  static async getPrivacy(req, res, next) {
    try {
      const privacy = await Content.findOne({
        type: 'privacy',
        isActive: true,
      }).select('-lastUpdatedBy');

      if (!privacy) {
        return res
          .status(404)
          .type('html')
          .send(
            renderPolicyPage({
              title: 'Privacy Policy not found',
              content: 'The privacy policy page is currently unavailable.',
              updatedAt: null,
            }),
          );
      }

      res
        .status(200)
        .type('html')
        .send(
          renderPolicyPage({
            ...privacy.toObject(),
            title: normalizeBranding(privacy.title),
            content: normalizeBranding(privacy.content),
          }),
        );
    } catch (error) {
      logger.error(`Get privacy error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get FAQs
   * @route   GET /api/content/faqs
   * @access  Public
   */
  static async getFaqs(req, res, next) {
    try {
      const { category } = req.query;

      const query = { isActive: true };
      if (category) query.category = category;

      const faqs = await FAQ.find(query)
        .select('-createdBy -updatedBy')
        .sort({ category: 1, order: 1 })
        .lean();

      const normalisedFaqs = faqs.map(faq => ({
        ...faq,
        question: normalizeBranding(faq.question),
        answer: normalizeBranding(faq.answer),
        category: normalizeBranding(faq.category),
      }));

      // Group by category
      const groupedFaqs = normalisedFaqs.reduce((acc, faq) => {
        const cat = faq.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(faq);
        return acc;
      }, {});

      res.status(200).json({
        status: 'success',
        data: {
          faqs: normalisedFaqs,
          groupedByCategory: groupedFaqs,
          total: normalisedFaqs.length,
          appName: 'Bootble',
        },
      });
    } catch (error) {
      logger.error(`Get FAQs error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Submit contact/support message
   * @route   POST /api/contact-support
   * @access  Public
   */
  static async submitContact(req, res, next) {
    try {
      const { name, email, subject, message, category = 'general', attachmentUrl } = req.body;

      // Validation
      if (!name || !email || !subject || !message) {
        return res.status(400).json({
          status: 'error',
          message: 'All fields are required (name, email, subject, message)',
        });
      }

      // Create contact message
      const contactData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: normalizeBranding(subject.trim()).replace(/Inquiry/gi, 'Enquiry'),
        message: message.trim(),
        category,
        priority: ['security', 'billing'].includes(category)
          ? 'high'
          : category === 'technical'
            ? 'medium'
            : 'medium',
        attachmentUrl: attachmentUrl || null,
        ticketId: `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        confirmationState: 'confirmed',
        confirmedAt: new Date(),
      };

      // If user is authenticated, attach userId
      if (req.user && req.user.id) {
        contactData.userId = req.user.id;
      }

      const contactMessage = await ContactMessage.create(contactData);

      if (req.user && req.user.id) {
        try {
          await notificationService.createNotification({
            userId: req.user.id,
            type: 'SYSTEM',
            category: 'support',
            title: 'Support request received',
            message: `Your support request ${contactMessage.ticketId} has been received.`,
            priority: 'MEDIUM',
            sourceModule: 'content',
            sourceId: contactMessage._id.toString(),
            deepLink: '/contactSupport',
            dedupeKey: `support:${contactMessage.ticketId}`,
            payload: {
              ticketId: contactMessage.ticketId,
              category: contactMessage.category,
            },
          });
        } catch (notificationError) {
          logger.error(`Support notification error: ${notificationError.message}`);
        }
      }

      // Optional: Send email notification to admin
      // You can integrate with your email service here
      // await sendEmailToAdmin(contactMessage);

      res.status(201).json({
        status: 'success',
        message: 'Your message has been sent successfully. We will get back to you soon.',
        data: {
          ticketId: contactMessage.ticketId,
          messageId: contactMessage._id,
          createdAt: contactMessage.createdAt,
          confirmationState: contactMessage.confirmationState,
          supportEmail: SUPPORT_EMAIL,
        },
      });
    } catch (error) {
      logger.error(`Submit contact error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get user's own contact messages (if authenticated)
   * @route   GET /api/my-contacts
   * @access  Private
   */
  static async getMyContacts(req, res, next) {
    try {
      const messages = await ContactMessage.find({ userId: req.user.id })
        .select('-adminNotes') // Don't show admin notes to users
        .sort({ createdAt: -1 });

      res.status(200).json({
        status: 'success',
        data: { messages },
      });
    } catch (error) {
      logger.error(`Get my contacts error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = ContentController;
