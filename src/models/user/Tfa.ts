import { type } from 'os';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../Model';
import { User } from './User';

const tableName: string = 'tfa';

@Entity(tableName)
export class Tfa extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  secret: string;

  @Column()
  tempSecret: string;

  @Column()
  dataURL: string;

  @Column()
  tfaURL: string;

  @Column({ name: 'user' })
  userId: number;

  @OneToOne(() => User, (user) => user.tfa)
  @JoinColumn({ name: 'user' })
  user: User;

  public getTableName(): string {
    return tableName;
  }
}
