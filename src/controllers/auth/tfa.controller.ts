import { Validate } from '../../decorators/validate.decorator';
import { Request } from 'express';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { AuthService } from '../../models/user/auth.service';
import { VerifyTfaDto } from './dtos/verifytfa.dto';
import { SetupTfaDto } from './dtos/setuptfa.dto';

import speakeasy from 'speakeasy';
const QRCode = require('qrcode');

export class TfaController extends Controller {
  protected authService: AuthService;

  public async make(request: Request): Promise<void> {
    this.authService = await this._app.getService<AuthService>(AuthService.name);
  }

  @Validate(VerifyTfaDto)
  public async verify(req: Request): Promise<ResponseBuilder> {
    const isVerified = speakeasy.totp.verify({
      secret: req.body.tempSecret,
      encoding: 'base32',
      token: req.body.authCode,
    });

    if (isVerified) {
      //User._update_tfa_secret(req);
      await AuthService.UpdateTfaSecret(req.body.tempSecret);
      //res.status(200).json({"secret":req.body.tempSecret})
      return ResponseBuilder.buildResponse().status(200).body({
        status: 'OK',
      });
    } else {
      return ResponseBuilder.buildResponse().status(401).body({
        message: 'Auth Code error',
      });
    }
  }

  @Validate(SetupTfaDto)
  public setup(req: Request): Promise<ResponseBuilder> {
    return new Promise((resolve, reject) => {
      const secret = speakeasy.generateSecret({
        length: 10,
        name: req.body.username,
        issuer: 'FWCLOUD - SOLTECSIS',
      });
      const url = speakeasy.otpauthURL({
        secret: secret.base32,
        label: req.body.username,
        issuer: 'FWCLOUD - SOLTECSIS',
        encoding: 'base32',
      });
      QRCode.toDataURL(url, async (err, dataURL) => {
        const tfa = {
          secret: '',
          tempSecret: secret.base32,
          dataURL,
          tfaURL: secret.otpauth_url,
          userId: req.body.user,
        };
        await AuthService.UpdateTfa(
          tfa.secret,
          tfa.tempSecret,
          tfa.dataURL,
          tfa.tfaURL,
          tfa.userId,
        );
      });
      resolve(ResponseBuilder.buildResponse().status(200));
    });
  }

  @Validate()
  public async getSetup(req: Request): Promise<ResponseBuilder> {
    const tfa = await AuthService.GetTfa(req.session.user_id);

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        enabled: tfa !== undefined,
        tfa,
      });
  }

  @Validate()
  public async deleteSetup(req: Request): Promise<ResponseBuilder> {
    await AuthService.deleteTfa(req.session.user_id);
    return ResponseBuilder.buildResponse().status(204);
  }
}
