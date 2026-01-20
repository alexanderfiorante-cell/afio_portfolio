import type { Context, Config } from "@netlify/functions";

interface FormSubmission {
  payload: {
    form_name: string;
    data: {
      name: string;
      email: string;
      service: string;
      budget?: string;
      message: string;
      subject?: string;
    };
    created_at: string;
  };
}

export default async (req: Request, context: Context) => {
  const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
  const RECIPIENT_EMAIL = "alexfiorante.dev@gmail.com";

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY environment variable is not set");
    return new Response("Email service not configured", { status: 500 });
  }

  try {
    const submission: FormSubmission = await req.json();
    const { form_name, data, created_at } = submission.payload;

    // Only process contact form submissions
    if (form_name !== "contact") {
      console.log(`Ignoring submission from form: ${form_name}`);
      return new Response("OK", { status: 200 });
    }

    const serviceLabels: Record<string, string> = {
      java: "Java development",
      python: "Python scripts / automation",
      web: "Web design / development",
      "bug-fix": "Bug fix",
      other: "Other",
    };

    const budgetLabels: Record<string, string> = {
      "under-50": "Under $50",
      "50-100": "$50 - $100",
      "100-250": "$100 - $250",
      "250-500": "$250 - $500",
      "500+": "$500+",
    };

    const serviceName = serviceLabels[data.service] || data.service;
    const budgetRange = data.budget ? budgetLabels[data.budget] || data.budget : "Not specified";
    const submittedAt = new Date(created_at).toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    });

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e; border-bottom: 2px solid #6ee7ff; padding-bottom: 10px;">New Contact Form Submission</h2>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 12px;"><strong>From:</strong> ${data.name}</p>
          <p style="margin: 0 0 12px;"><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
          <p style="margin: 0 0 12px;"><strong>Service Requested:</strong> ${serviceName}</p>
          <p style="margin: 0 0 12px;"><strong>Budget Range:</strong> ${budgetRange}</p>
          <p style="margin: 0;"><strong>Submitted:</strong> ${submittedAt}</p>
        </div>

        <h3 style="color: #1a1a2e; margin-top: 24px;">Project Details</h3>
        <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; white-space: pre-wrap;">${data.message}</div>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
        <p style="color: #666; font-size: 12px;">
          You can reply directly to this email to respond to ${data.name}.
        </p>
      </div>
    `;

    const emailText = `
New Contact Form Submission
============================

From: ${data.name}
Email: ${data.email}
Service Requested: ${serviceName}
Budget Range: ${budgetRange}
Submitted: ${submittedAt}

Project Details:
${data.message}

---
Reply directly to this email to respond to ${data.name}.
    `.trim();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Contact Form <onboarding@resend.dev>",
        to: [RECIPIENT_EMAIL],
        reply_to: data.email,
        subject: `New inquiry from ${data.name} - ${serviceName}`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to send email:", errorData);
      return new Response("Failed to send email", { status: 500 });
    }

    console.log(`Email sent successfully for submission from ${data.name}`);
    return new Response("Email sent", { status: 200 });
  } catch (error) {
    console.error("Error processing form submission:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
