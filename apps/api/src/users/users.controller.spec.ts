import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AddCrmNoteDto } from './dto/add-crm-note.dto';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findPaginated: jest.fn(),
    findAll: jest.fn(),
    findAllByRole: jest.fn(),
    getRolePermissions: jest.fn(),
    updateRolePermissions: jest.fn(),
    addCrmNote: jest.fn(),
    findOne: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsersByRole', () => {
    it('should find paginated users when page and limit are provided', async () => {
      const mockResult = { data: [], total: 0 };
      mockUsersService.findPaginated.mockResolvedValue(mockResult);

      const response = await controller.getUsersByRole('PASSENGER', '2', '10');
      expect(response).toEqual(mockResult);
      expect(service.findPaginated).toHaveBeenCalledWith('PASSENGER', 10, 10);
    });

    it('should find all users when role is not provided and page/limit are missing', async () => {
      const mockResult = [{ id: '1' }];
      mockUsersService.findAll.mockResolvedValue(mockResult);

      const response = await controller.getUsersByRole();
      expect(response).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith(100);
    });

    it('should find all users by role when role is provided and page/limit are missing', async () => {
      const mockResult = [{ id: '1', role: 'PASSENGER' }];
      mockUsersService.findAllByRole.mockResolvedValue(mockResult);

      const response = await controller.getUsersByRole('PASSENGER');
      expect(response).toEqual(mockResult);
      expect(service.findAllByRole).toHaveBeenCalledWith('PASSENGER', 100);
    });
  });

  describe('getRolePermissions', () => {
    it('should return role permissions list', async () => {
      const mockResult = [{ role: 'ADMIN', permissions: [] }];
      mockUsersService.getRolePermissions.mockResolvedValue(mockResult);

      const response = await controller.getRolePermissions();
      expect(response).toEqual(mockResult);
      expect(service.getRolePermissions).toHaveBeenCalled();
    });
  });

  describe('updateRolePermissions', () => {
    it('should update role permissions', async () => {
      const body: UpdateRolePermissionsDto = {
        role: Role.ADMIN,
        permissions: ['routes', 'bookings'],
      };
      const mockResult = { role: 'ADMIN', permissions: ['routes', 'bookings'] };
      mockUsersService.updateRolePermissions.mockResolvedValue(mockResult);

      const response = await controller.updateRolePermissions(body);
      expect(response).toEqual(mockResult);
      expect(service.updateRolePermissions).toHaveBeenCalledWith(Role.ADMIN, [
        'routes',
        'bookings',
      ]);
    });
  });

  describe('addCrmNote', () => {
    it('should add a CRM note to user', async () => {
      const body: AddCrmNoteDto = {
        text: 'User complained about driver',
        adminName: 'Admin John',
      };
      const mockResult = { id: 'note-1', text: body.text };
      mockUsersService.addCrmNote.mockResolvedValue(mockResult);

      const response = await controller.addCrmNote('user-1', body);
      expect(response).toEqual(mockResult);
      expect(service.addCrmNote).toHaveBeenCalledWith(
        'user-1',
        body.text,
        body.adminName,
      );
    });
  });

  describe('getUser', () => {
    it('should return user details by ID', async () => {
      const mockResult = { id: 'user-1', name: 'John' };
      mockUsersService.findOne.mockResolvedValue(mockResult);

      const response = await controller.getUser('user-1');
      expect(response).toEqual(mockResult);
      expect(service.findOne).toHaveBeenCalledWith('user-1');
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const body: CreateUserDto = {
        email: 'test@example.com',
        name: 'Test User',
        phone: '01001234567',
        role: Role.DRIVER,
      };
      const mockResult = { id: 'user-1', ...body };
      mockUsersService.createUser.mockResolvedValue(mockResult);

      const response = await controller.createUser(body);
      expect(response).toEqual(mockResult);
      expect(service.createUser).toHaveBeenCalledWith(body);
    });
  });

  describe('updateUser', () => {
    it('should update user details', async () => {
      const body: UpdateUserDto = {
        name: 'New Name',
      };
      const mockResult = { id: 'user-1', name: 'New Name' };
      mockUsersService.updateUser.mockResolvedValue(mockResult);

      const response = await controller.updateUser('user-1', body);
      expect(response).toEqual(mockResult);
      expect(service.updateUser).toHaveBeenCalledWith('user-1', body);
    });
  });

  describe('deleteUser', () => {
    it('should delete user by ID', async () => {
      mockUsersService.deleteUser.mockResolvedValue({ success: true });

      const response = await controller.deleteUser('user-1');
      expect(response).toEqual({ success: true });
      expect(service.deleteUser).toHaveBeenCalledWith('user-1');
    });
  });
});
