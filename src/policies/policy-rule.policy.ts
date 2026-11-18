import { User } from './../models/user/User';
import { Firewall } from './../models/firewall/Firewall';
import { Policy, Authorization } from './../fonaments/authorization/policy';
import { authorizeFirewall } from './policy-authorization';

export class PolicyRulePolicy extends Policy {
  static async read(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }

  static async download(firewall: Firewall, user: User): Promise<Authorization> {
    return authorizeFirewall(firewall, user);
  }
}
