import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { job, user, pdfBase64 } = req.body;

    if (!job) {
      return res.status(400).json({ error: 'Missing job data' });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Build email body
    const partsList = job.parts.map(p => 
      `- ${p.name}: £${p.price.toFixed(2)} (${p.boughtFrom})`
    ).join('\n');

    const totalCost = job.parts.reduce((sum, p) => sum + p.price, 0).toFixed(2);

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: `Repair_Report_${(job.registrationPlate || "Vehicle").replace(/\s+/g, "_")}.pdf`,
        content: pdfBase64,
        encoding: 'base64'
      });
    }

    const mailOptions = {
      to: process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER,
      subject: `[FleetTrack] New Repair Logged: ${job.registrationPlate} - ${job.make} ${job.model}`,
      text: `
New job logged by ${user || 'Anonymous'}:

Vehicle: ${job.make} ${job.model}
Registration: ${job.registrationPlate}
${job.driver ? `Driver: ${job.driver}` : ''}
Color: ${job.color}
Yard: ${job.yard}
Date In: ${new Date(job.dateIn).toLocaleDateString()}
Status: ${job.status}

Repair Details:
${job.repairDetails}

Parts:
${partsList}

Total Parts Cost: £${totalCost}

---
This is an automated email from Van Mechanic Logger.
      `,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message || error,
    });
  }
}
