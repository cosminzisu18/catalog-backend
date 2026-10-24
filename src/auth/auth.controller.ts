import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AllowInactiveDirector } from '../common/decorators/allow-inactive-director.decorator';
import { AllowPendingPassword } from '../common/decorators/allow-pending-password.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterSchoolDto } from '../schools/dto/register-school.dto';
import {
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth-cookies';
import { AuthService, type AuthResult } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// strict limit on routes that check passwords (brute force)
const CREDENTIALS_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

// tokens reach the browser only as httpOnly cookies;
// the response body has just the user profile
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.secureCookies =
      config.get<string>('COOKIE_SECURE') === 'true' ||
      config.get<string>('NODE_ENV') === 'production';
  }

  private respond(res: Response, result: AuthResult) {
    setAuthCookies(res, result.session, this.secureCookies);
    return { user: result.user };
  }

  @Throttle(CREDENTIALS_THROTTLE)
  @Post('register')
  async register(
    @Body() dto: RegisterSchoolDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.authService.registerSchool(dto));
  }

  @Throttle(CREDENTIALS_THROTTLE)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.authService.loginDirector(dto));
  }

  @Throttle(CREDENTIALS_THROTTLE)
  @HttpCode(200)
  @Post('login/:slug')
  async loginInstitution(
    @Param('slug') slug: string,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.loginInstitution(slug, dto),
    );
  }

  @Throttle(REFRESH_THROTTLE)
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return this.respond(
        res,
        await this.authService.refresh(readCookie(req, REFRESH_COOKIE)),
      );
    } catch (err) {
      clearAuthCookies(res, this.secureCookies);
      throw err;
    }
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.secureCookies);
  }

  @Throttle(CREDENTIALS_THROTTLE)
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle(CREDENTIALS_THROTTLE)
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Throttle(CREDENTIALS_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @AllowPendingPassword()
  @AllowInactiveDirector()
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.changePassword(
        user.id,
        dto,
        readCookie(req, REFRESH_COOKIE),
      ),
    );
  }

  @UseGuards(JwtAuthGuard)
  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }
}
