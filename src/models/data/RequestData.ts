// src/RequestData.ts

import Query from '../../database/Query';
import { User } from '../user/User';

interface BodyType {
  addr?: string;
  allowed_from?: string;
  ca?: number;
  cluster?: number;
  code?: number;
  comment?: string;
  crt?: number;
  cn?: string;
  customer?: number;
  days?: number;
  email?: string;
  enabled?: number;
  firewall?: number;
  fwcloud?: number;
  image?: string;
  install_dir?: string;
  install_name?: string;
  interface?: number;
  ip_version?: number;
  ipobj_g?: number;
  ipobj?: number;
  mark?: number;
  name?: string;
  new_position?: number;
  new_rule?: number;
  openvpn?: number;
  pass?: string;
  password?: string;
  phone?: string;
  position_order?: number;
  position?: number;
  prefix?: number;
  role?: number;
  rule?: number;
  sshpass?: string;
  sshuser?: string;
  type?: number;
  user?: number;
  username?: string;
  web?: string;
  [key: string]: any;
}

interface SessionType {
  user_id?: number;
  customer_id?: number;
  username?: string;
  user?: User;
  pgp?: {
    public: string;
    private: string;
  };
  socketId?: string;
}

interface RequestDataType {
  body?: BodyType;
  dbCon?: Query;
  session?: SessionType;
  caId?: number;
  params?: { [key: string]: any };
  query?: { [key: string]: any };
}

class RequestData {
  body?: BodyType;
  dbCon?: Query;
  session?: SessionType;
  caId?: number;
  inputs?: Map<string, string>;
  params?: { [key: string]: any };
  query?: { [key: string]: any };

  constructor(data: RequestDataType) {
    this.body = data.body;
    this.dbCon = data.dbCon;
    this.session = data.session;
    this.caId = data.caId;
    this.params = data.params;
    this.query = data.query;
  }
}

export default RequestData;
