import jwt, { JwtHeader, SigningKeyCallback, VerifyOptions } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';

import { logger } from '../util/logger';

export class AuthenticationService {
  #client: jwksClient.JwksClient;
  #options: VerifyOptions;

  constructor(auth0Domain: string, auth0Audience: string) {
    this.#client = jwksClient({
      jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
    });
    this.#options = {
      algorithms: ['RS256'],
      audience: auth0Audience,
      issuer: `https://${auth0Domain}/`,
    };
  }

  async verifyToken(token: string): Promise<string | jwt.Jwt | jwt.JwtPayload | undefined> {
    const boundGetKey = this.#getKey.bind(this);
    return new Promise((resolve, reject) => {
      jwt.verify(token, boundGetKey, this.#options, function (error, result) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  #getKey(header: JwtHeader, callback: SigningKeyCallback) {
    this.#client.getSigningKey(header.kid, function (err, key) {
      if (err) {
        logger.error('Error loading jwt signing key', { exception: err });
        callback(err);
      } else {
        const signingKey = (key as RsaSigningKey).rsaPublicKey;
        callback(null, signingKey);
      }
    });
  }
}
