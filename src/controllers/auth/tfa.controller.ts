import { Validate } from '../../decorators/validate.decorator';
import { Request } from 'express';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { AuthService } from '../../models/user/auth.service';
import { VerifyTfaDto } from './dtos/verifytfa.dto';
import { SetupTfaDto } from './dtos/setuptfa.dto';

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

export class TfaController extends Controller {
  protected authService: AuthService;

  public async make(request: Request): Promise<void> {
    this.authService = await this._app.getService<AuthService>(AuthService.name);
  }

  @Validate(VerifyTfaDto)
  public async verify(req: Request): Promise<ResponseBuilder> {
    const setup = await AuthService.GetTfa(req.session.user_id);
    if (!setup || setup.tempSecret !== req.body.tempSecret) {
      return ResponseBuilder.buildResponse().status(401).body({
        message: 'Auth Code error',
      });
    }
    const isVerified = speakeasy.totp.verify({
      secret: req.body.tempSecret,
      encoding: 'base32',
      token: req.body.authCode,
    });

    if (isVerified) {
      //User._update_tfa_secret(req);
      await AuthService.UpdateTfaSecret(req.body.tempSecret, req.session.user_id);
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
  public async setup(req: Request): Promise<ResponseBuilder> {
    if (req.body.user !== req.session.user_id) {
      return ResponseBuilder.buildResponse().status(401);
    }
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
    const dataURL = await QRCode.toDataURL(url);
    await AuthService.UpdateTfa(
      '',
      secret.base32,
      dataURL,
      secret.otpauth_url,
      req.session.user_id,
    );
    return ResponseBuilder.buildResponse().status(200);
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
