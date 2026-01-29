import { prisma } from '@/lib/db';
import { User, UserRole } from '@/types';
import { hashPassword } from '@/lib/auth';

export class UserService {
  private normalizeTgUsername(tg_username?: string): string | undefined {
    if (!tg_username) return undefined;
    return tg_username.startsWith('@') ? tg_username.slice(1) : tg_username;
  }

  async create(data: {
    name?: string;
    phone_number?: string;
    tg_id?: string;
    tg_username?: string;
    password?: string;
    role?: UserRole;
    working?: boolean;
    work_start_time?: string;
    work_end_time?: string;
    profile_image?: string;
  }, currentUser?: { id: number; role: UserRole }): Promise<User> {
    if (data.role === UserRole.ADMIN) {
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        throw new Error('ADMIN role\'ga ega foydalanuvchini faqat SUPER_ADMIN yarata oladi');
      }
    }

    if (data.role === UserRole.DOCTOR) {
      if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
        throw new Error('DOCTOR role\'ga ega foydalanuvchini faqat ADMIN yoki SUPER_ADMIN yarata oladi');
      }
    }

    if (data.tg_username) {
      data.tg_username = this.normalizeTgUsername(data.tg_username);
    }

    if (data.tg_id) {
      const existing = await prisma.user.findUnique({
        where: { tg_id: data.tg_id },
      });
      if (existing) {
        throw new Error(`Bu tg_id (${data.tg_id}) bilan foydalanuvchi allaqachon mavjud`);
      }
    }

    if (data.tg_username) {
      const existing = await prisma.user.findUnique({
        where: { tg_username: data.tg_username },
      });
      if (existing) {
        throw new Error(`Bu tg_username (${data.tg_username}) bilan foydalanuvchi allaqachon mavjud`);
      }
    }

    if (data.password) {
      const isAlreadyHashed = /^\$2[aby]\$\d{2}\$/.test(data.password);
      if (!isAlreadyHashed) {
        data.password = await hashPassword(data.password);
      }
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        phone_number: data.phone_number,
        tg_id: data.tg_id,
        tg_username: data.tg_username,
        password: data.password,
        role: data.role || UserRole.CLIENT,
        working: data.working ?? false,
        work_start_time: data.work_start_time,
        work_end_time: data.work_end_time,
        profile_image: data.profile_image,
      },
    });

    return user as User;
  }

  async findOne(id: number): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientBookings: true,
        doctorBookings: true,
      },
    });
    return user as User | null;
  }

  async findByTgUsername(tgUsername: string): Promise<User | null> {
    if (!tgUsername) return null;
    const normalized = this.normalizeTgUsername(tgUsername);
    const user = await prisma.user.findUnique({
      where: { tg_username: normalized },
    });
    return user as User | null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    if (!phoneNumber) return null;
    const user = await prisma.user.findFirst({
      where: { phone_number: phoneNumber },
    });
    return user as User | null;
  }

  async findDefaultDoctor(): Promise<User | null> {
    const doctor = await prisma.user.findFirst({
      where: { role: UserRole.DOCTOR },
      orderBy: { created_at: 'asc' },
    });
    return doctor as User | null;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: { role },
    });
    return users as User[];
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    // Фильтруем только разрешенные поля для обновления
    const allowedFields: (keyof User)[] = [
      'name',
      'phone_number',
      'tg_id',
      'tg_username',
      'password',
      'role',
      'working',
      'work_start_time',
      'work_end_time',
      'profile_image',
    ];

    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (field in data && data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (updateData.tg_username) {
      updateData.tg_username = this.normalizeTgUsername(updateData.tg_username);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    return user as User;
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany({
      include: {
        clientBookings: true,
        doctorBookings: true,
      },
    });
    return users as User[];
  }
}
