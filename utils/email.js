const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendTicketEmail(to, ticketData, qrBuffer) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `Your Ticket for ${ticketData.eventName}`,
        html: `
          <h1>🎟️ Your Ticket is Ready!</h1>
          <p>Hello ${ticketData.buyerName},</p>
          <p>Thank you for purchasing a ticket for <strong>${ticketData.eventName}</strong>.</p>
          <p><strong>Event Details:</strong></p>
          <ul>
            <li>Date: ${new Date(ticketData.eventDate).toLocaleDateString()}</li>
            <li>Location: ${ticketData.eventLocation}</li>
            <li>Ticket Type: ${ticketData.ticketTier}</li>
            <li>Amount Paid: KES ${ticketData.amount}</li>
          </ul>
          <p>Your QR code is attached to this email. Present it at the event for entry.</p>
          <p>You can also download the QR code from your purchase confirmation page.</p>
          <p>See you at the event!</p>
          <br>
          <p>Best regards,<br>The Event Team</p>
        `,
        attachments: [
          {
            filename: 'ticket-qr.png',
            content: qrBuffer,
            contentType: 'image/png'
          }
        ]
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Ticket email sent to ${to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw error, just log it
    }
  }

  async sendWithdrawalConfirmation(to, withdrawalData) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'Withdrawal Request Confirmation',
        html: `
          <h1>💰 Withdrawal Request Received</h1>
          <p>Hello,</p>
          <p>Your withdrawal request has been received and is being processed.</p>
          <p><strong>Withdrawal Details:</strong></p>
          <ul>
            <li>Amount: KES ${withdrawalData.amount}</li>
            <li>Status: ${withdrawalData.status}</li>
            <li>Request Date: ${new Date(withdrawalData.createdAt).toLocaleDateString()}</li>
          </ul>
          <p>You will receive the funds within 1-3 business days.</p>
          <br>
          <p>Best regards,<br>The Event Team</p>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Withdrawal confirmation email sent to ${to}`);
    } catch (error) {
      console.error('Error sending withdrawal email:', error);
    }
  }
}

module.exports = new EmailService();