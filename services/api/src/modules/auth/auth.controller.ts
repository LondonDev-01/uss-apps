import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from './public.decorator';
import { AuthService, REFRESH_COOKIE } from './auth.service';
import {
  OAUTH_STATE_COOKIE,
  OAuthService,
} from './oauth.service';
import { AuthenticatedUser } from './jwt.strategy';

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días
const OAUTH_STATE_MAX_AGE = 10 * 60 * 1000; // 10 min
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado actual' })
  me(@Req() req: Request) {
    return this.authService.me(req.user as AuthenticatedUser);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Rota el access + refresh token usando la cookie httpOnly' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new BadRequestException('No hay refresh token en la cookie');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);
    res.cookie(REFRESH_COOKIE, newRefreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: SECURE_COOKIE,
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: '/',
    });
    return { accessToken };
  }

  @Post('logout')
  @Public()
  @ApiOperation({ summary: 'Revoca el refresh token y limpia la cookie de sesión' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(refreshToken);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('microsoft/login')
  @Public()
  @ApiOperation({ summary: 'Inicia OAuth Microsoft: redirige a la URL de autorización' })
  async microsoftLogin(@Res() res: Response) {
    const { url, verifier } = await this.oauthService.buildAuthorizationUrl();
    res.cookie(OAUTH_STATE_COOKIE, verifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: OAUTH_STATE_MAX_AGE,
      path: '/',
    });
    res.redirect(url);
  }

  @Get('microsoft/callback')
  @Public()
  @ApiOperation({ summary: 'Callback Microsoft: emite JWT y redirige con token' })
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    const successRedirect = this.config.get<string>(
      'AUTH_SUCCESS_REDIRECT',
      'http://localhost:3000/',
    );

    const verifier = req.cookies?.[OAUTH_STATE_COOKIE] as
      | { state: string; codeVerifier: string; nonce: string }
      | undefined;
    if (!verifier || verifier.state !== req.query.state) {
      res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
      return res.redirect(`${successRedirect}?error=state_mismatch`);
    }

    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

    try {
      const { accessToken, refreshToken } = await this.oauthService.callback(
        this.verifierCallbackParams(req),
        verifier,
      );

      res.cookie(REFRESH_COOKIE, refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: SECURE_COOKIE,
        maxAge: REFRESH_COOKIE_MAX_AGE,
        path: '/',
      });

      // Token en fragment (#) y no en query (?): el fragment no viaja al servidor
      // de destino (PLAN_V3 §4.3).
      res.redirect(`${successRedirect}#access_token=${encodeURIComponent(accessToken)}`);
    } catch {
      return res.redirect(`${successRedirect}?error=oauth_callback_failed`);
    }
  }

  // Extrae los parámetros del callback OAuth de la request.
  private verifierCallbackParams(req: Request): Record<string, unknown> {
    return {
      code: typeof req.query.code === 'string' ? req.query.code : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      error: req.query.error,
      error_description: req.query.error_description,
    };
  }
}