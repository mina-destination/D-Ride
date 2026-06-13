import { Test, TestingModule } from '@nestjs/testing';
import { SupportService } from './support.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('SupportService', () => {
  let service: SupportService;
  let mockPrismaService: any;
  let mockWhatsappService: any;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+201001234567',
    role: 'PASSENGER',
  };

  const mockAdminUser = {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@example.com',
    phone: '+201009876543',
    role: 'ADMIN',
  };

  const mockTicket = {
    id: 'ticket-1',
    userId: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+201001234567',
    subject: 'Test Issue',
    message: 'Need help with booking',
    status: 'OPEN',
    replies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      supportTicket: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      chatMessage: {
        findMany: jest.fn(),
      },
    };

    mockWhatsappService = {
      sendWhatsAppMessage: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WhatsappService,
          useValue: mockWhatsappService,
        },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitTicket', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.submitTicket('nonexistent', {
          subject: 'Test',
          message: 'Help',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user has 5 open tickets', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.supportTicket.count.mockResolvedValue(5);

      await expect(
        service.submitTicket('user-1', {
          subject: 'Test',
          message: 'Help',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a support ticket', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.supportTicket.count.mockResolvedValue(0);
      mockPrismaService.supportTicket.create.mockResolvedValue(mockTicket);

      const result = await service.submitTicket('user-1', {
        subject: 'Test Issue',
        message: 'Need help with booking',
      });

      expect(result).toBeDefined();
      expect(result._id).toBe('ticket-1');
    });
  });

  describe('getAllTickets', () => {
    it('should return all tickets', async () => {
      mockPrismaService.supportTicket.findMany.mockResolvedValue([mockTicket]);

      const result = await service.getAllTickets();

      expect(result).toHaveLength(1);
    });
  });

  describe('resolveTicket', () => {
    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.supportTicket.update.mockRejectedValue(new Error());

      await expect(service.resolveTicket('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark ticket as resolved', async () => {
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status: 'RESOLVED',
      });

      const result = await service.resolveTicket('ticket-1');

      expect(result.status).toBe('RESOLVED');
    });
  });

  describe('replyToTicket', () => {
    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        service.replyToTicket('nonexistent', 'Reply text', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should add reply to ticket', async () => {
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        replies: [
          {
            text: 'Reply text',
            createdAt: expect.any(String),
            adminName: 'Admin',
          },
        ],
      });

      const result = await service.replyToTicket(
        'ticket-1',
        'Reply text',
        'Admin',
      );

      expect(result).toBeDefined();
    });

    it('should forward reply via WhatsApp for WhatsApp support sessions', async () => {
      const whatsAppTicket = {
        ...mockTicket,
        subject: 'WhatsApp Support Session',
        phone: '+201001234567',
      };
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(
        whatsAppTicket,
      );
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...whatsAppTicket,
        replies: [
          {
            text: 'Reply',
            createdAt: new Date().toISOString(),
            adminName: 'Admin',
          },
        ],
      });

      await service.replyToTicket('ticket-1', 'Your response', 'Admin');

      expect(mockWhatsappService.sendWhatsAppMessage).toHaveBeenCalledWith(
        '+201001234567',
        'Your response',
      );
    });
  });

  describe('getTicketMessages', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getTicketMessages('ticket-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if ticket not found for non-admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        service.getTicketMessages('ticket-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin tries to access another user ticket', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.supportTicket.findUnique.mockResolvedValue({
        ...mockTicket,
        userId: 'other-user',
      });

      await expect(
        service.getTicketMessages('ticket-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return messages for ticket owner', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.chatMessage.findMany.mockResolvedValue([
        { id: 'msg-1', text: 'Hello', createdAt: new Date() },
      ]);

      const result = await service.getTicketMessages('ticket-1', 'user-1');

      expect(result).toHaveLength(1);
    });

    it('should allow admin to access any ticket messages', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);
      mockPrismaService.chatMessage.findMany.mockResolvedValue([
        { id: 'msg-1', text: 'Hello', createdAt: new Date() },
      ]);

      const result = await service.getTicketMessages('ticket-1', 'admin-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getUserTickets', () => {
    it('should return tickets for a user', async () => {
      mockPrismaService.supportTicket.findMany.mockResolvedValue([mockTicket]);

      const result = await service.getUserTickets('user-1');

      expect(result).toHaveLength(1);
    });
  });
});
