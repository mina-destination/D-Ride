const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const prisma = new PrismaClient();
const JWT_SECRET = 'dride_dev_s3cret_k3y_ch4ng3_1n_pr0duct10n_2026!'; // from .env
const ticketId = '1f505a30-4c8d-48b5-87f7-a0aceded9849'; // ticket from query results

async function main() {
  // Find owner user
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' }
  });
  if (!user) {
    console.error('Owner user not found in DB!');
    return;
  }
  console.log('Using OWNER user:', user.email);

  // Generate JWT token
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  // Call Resolve Endpoint
  try {
    const url = `http://localhost:3000/api/support/tickets/${ticketId}/resolve`;
    console.log('Sending PUT to:', url);
    const res = await axios.put(url, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(res.data, null, 2));

    // Verify ticket in DB
    const dbTicket = await prisma.supportTicket.findUnique({
      where: { id: ticketId }
    });
    console.log('Ticket in DB status after resolve:', dbTicket.status);
  } catch (error) {
    if (error.response) {
      console.error('API Error Status:', error.response.status);
      console.error('API Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }

  await prisma.$disconnect();
}

main();
