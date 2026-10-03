import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  async register(email: string, username: string, password: string) {
    if (!email || !username || !password) {
      throw new BadRequestException('Email, username and password are required');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already taken');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerifyToken = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: { email, username, passwordHash, emailVerifyToken, isEmailVerified: false },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    // Send verification email (non-blocking)
    this.mail.sendVerificationEmail(email, username, emailVerifyToken).catch(() => {});

    return { user, message: 'Sprawdź swoją skrzynkę email, aby potwierdzić konto.' };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });
    if (!user) {
      throw new BadRequestException('Nieprawidłowy lub wygasły token weryfikacji');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyToken: null },
    });
    const jwtToken = this.jwt.sign({ userId: user.id, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      token: jwtToken,
      message: 'Email został potwierdzony!',
    };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'Jeśli konto istnieje, wysłaliśmy email weryfikacyjny.' };
    }
    if (user.isEmailVerified) {
      return { message: 'Email jest już potwierdzony.' };
    }
    const emailVerifyToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken },
    });
    this.mail.sendVerificationEmail(email, user.username, emailVerifyToken).catch(() => {});
    return { message: 'Jeśli konto istnieje, wysłaliśmy email weryfikacyjny.' };
  }

  async login(login: string, password: string) {
    if (!login || !password) {
      throw new BadRequestException('Login and password are required');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
        isActive: true,
      },
    });
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Potwierdź swój adres email przed zalogowaniem. Sprawdź skrzynkę pocztową.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    const token = this.jwt.sign({ userId: user.id, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      token,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return same message to prevent email enumeration
    const msg = { message: 'Jeśli konto z tym emailem istnieje, wysłaliśmy link do resetu hasła.' };
    if (!user) return msg;

    const passwordResetToken = randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken, passwordResetExpires },
    });
    this.mail.sendPasswordResetEmail(email, user.username, passwordResetToken).catch(() => {});
    return msg;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Nieprawidłowy lub wygasły token resetu hasła');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });
    return { message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarUrl: true, role: true, createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
