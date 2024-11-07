import { IsNull, MigrationInterface, Not, QueryRunner, Repository } from 'typeorm';
import { User } from '../../../models/user/User';
import { Firewall } from '../../../models/firewall/Firewall';
import { Buffer } from 'buffer';

const crypto = require('crypto');

const config = require('../../../config/config');
const utils = require('../../../utils/utils');

export class UpdateEncryptionScheme1727938107354 implements MigrationInterface {
  private userRepository: Repository<User>;
  private firewallRepository: Repository<Firewall>;

  public async up(queryRunner: QueryRunner): Promise<void> {
    this.userRepository = queryRunner.manager.getRepository(User);
    this.firewallRepository = queryRunner.manager.getRepository(Firewall);

    const secret = config.get('crypt').secret;

    // Expand the column that will store the encrypted data
    await queryRunner.query(`
            ALTER TABLE firewall MODIFY COLUMN install_apikey VARCHAR(512);
            ALTER TABLE firewall MODIFY COLUMN install_user VARCHAR(512);
            ALTER TABLE firewall MODIFY COLUMN install_pass VARCHAR(512);
        `);

    const firewalls = await this.firewallRepository.find({
      where: [
        { install_apikey: Not(IsNull()) },
        { install_user: Not(IsNull()) },
        { install_pass: Not(IsNull()) },
      ],
    });

    for (const firewall of firewalls) {
      let updated = false;

      // Validate the data before attempting to decrypt and encrypt it
      if (firewall.install_apikey) {
        const oldDecryptedApiKey = this.decryptWithDeprecatedMethod(
          firewall.install_apikey,
          secret,
        );
        firewall.install_apikey = this.encryptData(oldDecryptedApiKey, secret);
        updated = true;
      }

      if (firewall.install_user) {
        const oldDecryptedInstallUser = this.decryptWithDeprecatedMethod(
          firewall.install_user,
          secret,
        );
        firewall.install_user = this.encryptData(oldDecryptedInstallUser, secret);
        updated = true;
      }

      if (firewall.install_pass) {
        const oldDecryptedInstallPass = this.decryptWithDeprecatedMethod(
          firewall.install_pass,
          secret,
        );
        firewall.install_pass = this.encryptData(oldDecryptedInstallPass, secret);
        updated = true;
      }

      // Save the changes if there was any update
      if (updated) {
        await this.firewallRepository.save(firewall);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    this.userRepository = queryRunner.manager.getRepository(User);
    this.firewallRepository = queryRunner.manager.getRepository(Firewall);

    const secret = config.get('crypt').secret;

    // Revert the column sizes to their original values
    await queryRunner.query(`
        ALTER TABLE firewall MODIFY COLUMN install_apikey VARCHAR(255);
        ALTER TABLE firewall MODIFY COLUMN install_user VARCHAR(250);
        ALTER TABLE firewall MODIFY COLUMN install_pass VARCHAR(250);
    `);

    // Process firewalls with encrypted data
    const firewalls = await this.firewallRepository.find({
      where: [
        { install_apikey: Not(IsNull()) },
        { install_user: Not(IsNull()) },
        { install_pass: Not(IsNull()) },
      ],
    });

    for (const firewall of firewalls) {
      let updated = false;

      if (firewall.install_apikey) {
        const newDecryptedApiKey = this.decryptData(firewall.install_apikey, secret);
        firewall.install_apikey = this.encryptWithDeprecatedMethod(newDecryptedApiKey, secret);
        updated = true;
      }

      if (firewall.install_user) {
        const newDecryptedInstallUser = this.decryptData(firewall.install_user, secret);
        firewall.install_user = this.encryptWithDeprecatedMethod(newDecryptedInstallUser, secret);
        updated = true;
      }

      if (firewall.install_pass) {
        const newDecryptedInstallPass = this.decryptData(firewall.install_pass, secret);
        firewall.install_pass = this.encryptWithDeprecatedMethod(newDecryptedInstallPass, secret);
        updated = true;
      }

      if (updated) {
        await this.firewallRepository.save(firewall);
      }
    }
  }

  private encryptData(data: string, secret: string): string {
    const algorithm = config.get('crypt').algorithm;
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = Buffer.alloc(16, 0);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let crypted = cipher.update(data, 'utf8', 'hex');
    crypted += cipher.final('hex');

    return crypted;
  }

  private decryptData(data: string, secret: string): string {
    const algorithm = config.get('crypt').algorithm;
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = Buffer.alloc(16, 0);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');

    return dec;
  }

  // Method to encrypt using the old (deprecated) method
  private encryptWithDeprecatedMethod(text: string, secret: string): string {
    const cipher = crypto.createCipher(config.get('crypt').algorithm, config.get('crypt').secret);
    let crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');

    return crypted;
  }

  // Method to decrypt using the old (deprecated) method.
  private decryptWithDeprecatedMethod(text: string, secret: string): string {
    const decipher = crypto.createDecipher(
      config.get('crypt').algorithm,
      config.get('crypt').secret,
    );
    let dec = decipher.update(text, 'hex', 'utf8');
    dec += decipher.final('utf8');

    return dec;
  }
}
