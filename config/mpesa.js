const axios = require('axios');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.businessShortCode = process.env.MPESA_BUSINESS_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackURL = process.env.MPESA_CALLBACK_URL;
  }

  async getAccessToken() {
    try {
      const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });
      
      return response.data.access_token;
    } catch (error) {
      console.error('Error getting M-Pesa access token:', error);
      throw error;
    }
  }

  async initiateSTKPush(phone, amount, accountReference, transactionDesc) {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.businessShortCode}${this.passkey}${timestamp}`).toString('base64');
      
      const url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
      
      const data = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: this.businessShortCode,
        PhoneNumber: phone,
        CallBackURL: `${this.callbackURL}/api/payment/callback`,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc
      };

      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error initiating STK Push:', error);
      throw error;
    }
  }

  async checkTransactionStatus(checkoutRequestID) {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.businessShortCode}${this.passkey}${timestamp}`).toString('base64');
      
      const url = 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
      
      const data = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error checking transaction status:', error);
      throw error;
    }
  }
}

module.exports = new MpesaService();