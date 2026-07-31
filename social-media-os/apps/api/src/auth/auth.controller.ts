import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Redirect,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
    },
  })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('oauth/:platform')
  @ApiOperation({ summary: 'Get OAuth URL for platform' })
  @Redirect()
  getOAuthUrl(@Param('platform') platform: string) {
    const url = this.authService.getOAuthUrl(platform);
    return { url, statusCode: 302 };
  }

  @Get('oauth/:platform/callback')
  @ApiOperation({ summary: 'Handle OAuth callback from platform' })
  @ApiQuery({ name: 'code', required: true, type: String })
  async oauthCallback(
    @Param('platform') platform: string,
    @Query('code') code: string,
  ) {
    return this.authService.handleOAuthCallback(platform, code);
  }
}
