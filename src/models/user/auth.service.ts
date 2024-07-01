import { getRepository } from 'typeorm';
import { Service } from '../../fonaments/services/service';
import { Tfa } from './Tfa';

export class AuthService extends Service {
  public static async UpdateTfa(
    secret: string,
    tempSecret: string,
    dataURL: string,
    tfaURL: string,
    userId: number,
  ) {
    const tfData = {
      secret: secret,
      tempSecret: tempSecret,
      dataURL: dataURL,
      tfaURL: tfaURL,
      userId: userId,
    };
    await getRepository(Tfa).insert(tfData);
    return tfData;
  }

  public static async UpdateTfaSecret(tempSecret: string) {
    await getRepository(Tfa)
      .createQueryBuilder('tfa')
      .update()
      .set({ secret: tempSecret })
      .where('tempSecret = :tempSecret', { tempSecret: tempSecret })
      .execute();
  }

  public static async GetTfa(userId: number) {
    const pet = await getRepository(Tfa)
      .createQueryBuilder('tfa')
      .select()
      .where('tfa.userId = :id', { id: userId })
      .getOne();

    return pet;
  }

  public static async deleteTfa(userId: number) {
    await getRepository(Tfa)
      .createQueryBuilder('tfa')
      .delete()
      .from('tfa')
      .where('user = :id', { id: userId })
      .execute();
  }
}
