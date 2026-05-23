export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET;

  if (
    nodeEnv === 'production' &&
    (!jwtSecret || jwtSecret === 'dev_jwt_secret_do_not_use_in_production')
  ) {
    throw new Error(
      'FATAL: A secure JWT_SECRET environment variable is strictly required in production mode!',
    );
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

    database: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://root:secret@localhost:5432/dride?schema=public',
    },

    jwt: {
      secret: jwtSecret || 'dev_jwt_secret_do_not_use_in_production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    paymob: {
      apiKey: process.env.PAYMOB_API_KEY || '',
      hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
      iframeId: process.env.PAYMOB_IFRAME_ID || '',
      integrationId: process.env.PAYMOB_INTEGRATION_ID || '',
      walletIntegrationId: process.env.PAYMOB_WALLET_INTEGRATION_ID || '',
    },

    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
    },
  };
};
