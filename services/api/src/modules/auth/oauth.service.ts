import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, generators, Issuer } from 'openid-client';
import { PrismaService } from '../../prisma/prisma.service';
import { USS_DOMAIN_REGEX } from '../../common/domain';
import { AuthService } from './auth.service';

export const OAUTH_STATE_COOKIE = 'uss_oauth_state';

export interface OAuthVerifierState {
  state: string;
  codeVerifier: string;
}

export interface AuthorizationUrlResult {
  url: string;
  verifier: OAuthVerifierState;
}

@Injectable()
export class OAuthService {
  private readonly client: Client;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {
    this.client = this.initClient();
  }

  private issuerUrl(): string {
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID');
    return `https://login.microsoftonline.com/${tenant}/v2.0`;
  }

  // Cliente openid-client construido "a mano" con el discovery público del tenant
  // USS (no requiere admin). El jwks_uri habilita la validación de firma RS256.
  private initClient(): Client {
    const issuer = new Issuer({
      issuer: this.issuerUrl(),
      authorization_endpoint: `${this.issuerUrl()}/authorize`,
      token_endpoint: `${this.issuerUrl()}/token`,
      jwks_uri: `${this.issuerUrl()}/discovery/v2.0/keys`,
    });
    return new issuer.Client({
      client_id: this.config.get<string>('MICROSOFT_CLIENT_ID') ?? '',
      client_secret: this.config.get<string>('MICROSOFT_CLIENT_SECRET'),
      redirect_uris: [this.config.get<string>('MICROSOFT_REDIRECT_URI') ?? ''],
      token_endpoint_auth_method: 'client_secret_post',
      response_types: ['code'],
    });
  }

  buildAuthorizationUrl(): AuthorizationUrlResult {
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();

    const url = this.client.authorizationUrl({
      scope: 'openid profile email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      response_mode: 'query',
    });

    return { url, verifier: { state, codeVerifier } };
  }

  async callback(
    params: Record<string, unknown>,
    verifier: OAuthVerifierState,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenSet = await this.client.oauthCallback(
      this.config.get<string>('MICROSOFT_REDIRECT_URI') ?? '',
      params,
      { state: verifier.state, code_verifier: verifier.codeVerifier },
    );

    const claims = tokenSet.claims();
    const email = String(claims.email ?? claims.preferred_username ?? '');
    if (!email || !USS_DOMAIN_REGEX.test(email)) {
      throw new UnauthorizedException('Email fuera del dominio @uss.cl');
    }

    const outlookId = String(claims.oid ?? claims.sub ?? '');
    const name = String(claims.name ?? email.split('@')[0]);

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, outlookId },
      create: { email, name, outlookId, role: 'student' },
    });

    return this.auth.issueTokens(user);
  }
}