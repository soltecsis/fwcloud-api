/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Service } from "../fonaments/services/service";
import { Request } from "express";
import { PolicyRule } from '../models/policy/PolicyRule';
import { Interface } from '../models/interface/Interface';
import { Tree } from '../models/tree/Tree';
import { PolicyRuleToInterface } from '../models/policy/PolicyRuleToInterface';
import { IPObj } from '../models/ipobj/IPObj';
import { PolicyRuleToIPObj } from "../models/policy/PolicyRuleToIPObj";
import { IPObjGroup } from '../models/ipobj/IPObjGroup';
import { StdChains, TcpFlags, PolicyTypeMap, PositionMap, GroupablePositionMap, ModulesIgnoreMap, IptablesSaveStats } from './iptables-save.data';
import { getRepository } from 'typeorm';
import { PolicyGroup } from '../models/policy/PolicyGroup';
import { RuleCompiler } from '../compiler/RuleCompiler';
import { PolicyRuleToOpenVPN } from '../models/policy/PolicyRuleToOpenVPN';
const Joi = require('joi');
const sharedSch = require('../middleware/joi_schemas/shared');


export class IptablesSaveToFWCloud extends Service {
  protected req: Request;
  protected statefulFirewall: boolean;
  protected line: number;
  protected data: string[];
  protected items: string[];
  protected table: string;
  protected chain: string;
  private policyType: number;
  protected ipProtocol: string;
  protected previousRuleId: any;
  protected ruleId: any;
  protected ruleOrder: number;
  protected ruleTarget: string;
  protected ruleTargetSet: boolean;
  protected ruleWithStatus: boolean;
  protected ruleGroupId: number;
  protected ruleGroupName: string;
  protected customChainsMap: Map<string, number[]>;
  protected stats: IptablesSaveStats;

  protected generateCustomChainsMap(): Promise<void> {
    let chain: string = this.items[0].substr(1);

    // Ignore standard chains names.
    if (StdChains.has(chain)) return;

    // Search all the lines that have data for this custom chain.
    let value: number[] = [];
    let items: string[];
    for(let p=this.line+1; p < this.data.length; p++) {
      items = this.data[p].trim().split(/\s+/);
      if (items[0] === 'COMMIT') break;
      if (items[0] === '-A' && items[1] === chain) value.push(p);
    }

    this.customChainsMap.set(this.items[0].substr(1),value);
  }


  protected async generateRule(): Promise<boolean> {
    this.items.shift(); // -A

    // If the new chain is a standard one and is different from the current one, reset rule position.
    if (StdChains.has(this.items[0]) && this.chain!==this.items[0]) 
      this.ruleOrder = 1;
    this.chain = this.items[0];
    this.items.shift();

    // Ignore iptables rules for custom chains because they have already been processed.
    if (this.customChainsMap.has(this.chain)) return false;

    let policy_rData = {
      id: null,
      firewall: this.req.body.firewall,
      rule_order: this.ruleOrder++,
      action: 1, // By default action rule is ACCEPT
      active: 1,
      options: 0,
      //comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`,
      comment: '',
      type: 0,
    };

    // If don't find type map, ignore this rule.
    this.policyType = PolicyTypeMap.get(`${this.table}:${this.chain}`);
    if (!this.policyType) return false;
    policy_rData.type = this.policyType ;

    if (this.table==='filter') {
      let action: string;
      let itemsCopy = this.items;
      
      // If exists, remove comment from itemsCopy.
      for (let i=0; i<(itemsCopy.length-4); i++) {
        if (itemsCopy[i]==='-m' && itemsCopy[i+1]==='comment' && itemsCopy[i+2]==='--comment') {
          // Remove comment from itemsCopy.
          let itemsCopy2 = itemsCopy.slice(i+3);
          try { 
            await this.eatCommentString(itemsCopy2); 
            itemsCopy = itemsCopy.slice(0,i).concat(itemsCopy2);
          } catch(err) { throw new Error(`Error eating rule comment string: ${JSON.stringify(err)}`); }
        }
      }

      action = `${itemsCopy[0]} ${itemsCopy[1]} ${itemsCopy[2]} ${itemsCopy[3]} ${itemsCopy[4]} ${itemsCopy[5]}`;
    
      // Ignore RELATED,ESTABLISHED rules.
      if (action === '-m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT') return false;
      if (action === '-m state --state RELATED,ESTABLISHED -j ACCEPT') return false;
    
      // Ignore catch all rules.
      action = `${itemsCopy[0]} ${itemsCopy[1]}`;
      if (action==='-j ACCEPT' || action==='-j DROP' || action==='-j REJECT') return false;
    }

    // Create new policy rule.
    try {
      await PolicyRule.reorderAfterRuleOrder(this.req.dbCon, this.req.body.firewall, policy_rData.type, policy_rData.rule_order);
      this.ruleId = await PolicyRule.insertPolicy_r(policy_rData);
    } catch(err) { throw new Error(`Error creating policy rule: ${JSON.stringify(err)}`); }
  
    this.ruleTarget = null;
    this.ruleTargetSet = false;
    this.ruleWithStatus = false;

    this.stats.rules++;

    return true;
  }


  protected async fillRulePositions(line: number): Promise<void> {
    let lineItems = this.data[line].trim().split(/\s+/); 
    lineItems.shift(); // -A
    lineItems.shift(); // Chain name

    this.ruleTarget = '';

    while(lineItems.length > 0)
      await this.eatRuleData(line, lineItems);

    // If rule doesn't follow the firewall stateness change its stateness options.
    if (this.table==='filter' && this.ruleTarget==='ACCEPT' && this.statefulFirewall!=this.ruleWithStatus ) {
      const ruleData: any = await PolicyRule.getPolicy_r(this.req.dbCon, this.req.body.firewall, this.ruleId);
      const policy_rData = { id: this.ruleId, options: ruleData.options }
      policy_rData.options = this.ruleWithStatus ? policy_rData.options | 1 : policy_rData.options | 2;
      await PolicyRule.updatePolicy_r(this.req.dbCon, policy_rData);
    }
  
    let lines: number[] = this.customChainsMap.get(this.ruleTarget);
    if (lines) { // Target is a custom chain.
      for(let l of lines) {
        await this.fillRulePositions(l); // RECURSIVE CALL!!!
      }
    } else if (this.ruleTarget !== 'ACCEPT') { // Target is a builtin one or an extension.
      const policy_rData = { id: this.ruleId, action: 1 }
    
      if (this.ruleTarget === 'DROP')
        policy_rData.action = 2;
      else if (this.ruleTarget === 'REJECT')
        policy_rData.action = 3;

      await PolicyRule.updatePolicy_r(this.req.dbCon, policy_rData);
    }

    // Warning, keep in mind that this method executes recursively, then  any coded here
    // will be executed with each recursion.
  }


  private async eatRuleData(line: number, lineItems: string[]): Promise<void> {
    // Negate rule position.
    if (lineItems[0] === '!') {
      lineItems.shift();
      await this.negateRulePosition(lineItems[0]);
    }

    const item = lineItems[0];
    lineItems.shift();

    switch(item) {
      case '-s':
      case '-d':
        await this.eatAddr(item,lineItems[0]);
        lineItems.shift();
        break;

      case '-o':
      case '-i':
        await this.eatInterface(item,lineItems[0]);
        lineItems.shift();
        break;

      case '-p':
        await this.eatProtocol(lineItems[0]);
        lineItems.shift();
        break;

      case '--sport':
      case '--dport':
      case '--tcp-flags':
        await this.composeAndEatPort(item,lineItems);
        break;
          
      case '-m':
        await this.eatModule(lineItems[0], lineItems);
        break;

      /*
        -j, --jump target
        This specifies the target of the rule; i.e., what to do if the packet matches it. 
        The target can be a user-defined chain (other than the one this rule is in), one of the special builtin targets which decide the fate of 
        the packet immediately, or an extension (see EXTENSIONS below). If this option is omitted in a rule (and -g is not used), then matching 
        the rule will have no effect on the packet's fate, but the counters on the rule will be incremented. 
      */       
      case '-j':
        this.ruleTarget = lineItems[0];
        lineItems.shift();
        if (this.ruleTarget === 'RETURN')
          await this.negateLinePositions(line);
        else if (this.ruleTarget === 'SNAT' || this.ruleTarget === 'DNAT') {
          if (!this.ruleTargetSet) 
            await this.eatNAT(lineItems[0], lineItems[1]);
          lineItems.shift(); lineItems.shift();
        }
        else if (this.ruleTarget === 'MASQUERADE') {
          if (lineItems[0] === '--to-ports') {
            await this.eatPort('0',lineItems[1],null,null,'--to-ports');
            lineItems.shift(); lineItems.shift();
          }
        }
        else if (this.ruleTarget === 'REJECT') {
          if (lineItems[0] === '--reject-with') { // For now ignore the --reject-with option.
            lineItems.shift(); lineItems.shift();
          }
        }
        else if (this.ruleTarget === 'LOG')
          await this.eatLOG(lineItems);
        break;

      /*
      [!] -f, --fragment
      This means that the rule only refers to second and further fragments of fragmented packets. 
      Since there is no way to tell the source or destination ports of such a packet (or ICMP type), 
      such a packet will not match any rules which specify them. When the "!" argument precedes the "-f" 
      flag, the rule will only match head fragments, or unfragmented packets.
      */
      case '-f': // For now ignore it.
        break;
    
      default:
        throw new Error('Bad iptables-save data');
    }
  }


  private async eatModule(module: string, items: string[]): Promise<void> {
    items.shift(); 
    
    if (ModulesIgnoreMap.has(module)) {
      const moduleOptions: string[][] = ModulesIgnoreMap.get(module);

      // Ignore the negation string: '!'
      if (items[0]==='!') items.shift();

      while (items.length > 0) {
        let found = false;

        for (let i=0; i<moduleOptions.length && !found; i++) {
          for (let j=0; j <= i; j++) {
            if (items[0] === moduleOptions[i][j]) {
              // Ignore module option name.
              items.shift();
              
              // Ignore the negation string: '!'
              if (items[0]==='!') items.shift();

              // Ignore module option parameters.
              for (let k=1; k<=i; k++) items.shift();

              found = true;
              break;
            }
          }
        }

        if (!found) break;
      }

      // Add the ingnored module to statistics information.
      if (this.stats.modulesIgnored.indexOf(module) === -1)
        this.stats.modulesIgnored.push(module);

      return;
    }

    const opt = items[0];
    const data = items[1];

    switch (module) {
      /*
      multiport

      This module matches a set of source or destination ports. Up to 15 ports can be specified. A port range (port:port) counts as two ports. It can only be used in conjunction with -p tcp or -p udp.
      --source-ports [!] port[,port[,port:port...]]
      Match if the source port is one of the given ports. The flag --sports is a convenient alias for this option.
      --destination-ports [!] port[,port[,port:port...]]
      Match if the destination port is one of the given ports. The flag --dports is a convenient alias for this option.
      --ports [!] port[,port[,port:port...]]
      Match if either the source or destination ports are equal to one of the given ports.
      */
      case 'mport':
      case 'multiport':
        if (this.ipProtocol!=='tcp' && this.ipProtocol!=='udp')
          throw new Error('IPTables multiport module can only be used in conjunction with -p tcp or -p udp');
        if (opt!=='--source-ports' && opt!=='--sports' && opt!=='--destination-ports' && opt!=='--dports' && opt!=='--ports')
          throw new Error(`Bad ${module} module option`);

        const portsList = data.trim().split(',');
        for (let ports of portsList) {
          const sports = (opt==='--source-ports' || opt==='--sports' || opt==='--ports') ? ports : '0';
          const dports = (opt==='--destination-ports' || opt==='--dports' || opt==='--ports') ? ports : '0';
          await this.eatPort(sports,dports,null,null);
        }
        items.shift(); items.shift();
        break;

      case 'tcp':
      case 'udp':
        items.shift();
        await this.composeAndEatPort(opt,items);
        break;

      /*
        icmp

        This extension is loaded if '--protocol icmp' is specified. It provides the following option:
        --icmp-type [!] typename
        This allows specification of the ICMP type, which can be a numeric ICMP type, or one of the ICMP type names shown by the command
        iptables -p icmp -h
      */  
      case 'icmp':
        if (this.ipProtocol!=='icmp')
          throw new Error('IPTables icmp module can only be used in conjunction with -p icmp');
        if (opt!=='--icmp-type')
          throw new Error(`Bad ${module} module option`);
        await this.eatICMP(data);
        items.shift(); items.shift();
        break;

      /*
        iprange

        This matches on a given arbitrary range of IPv4 addresses
        [!]--src-range ip-ip
        Match source IP in the specified range.
        [!]--dst-range ip-ip
        Match destination IP in the specified range.
      */
      case 'iprange':
        await this.eatIPRange(opt,data);
        items.shift(); items.shift();
        break;

      case 'comment': 
        items.shift(); // --comment
        await this.eatRuleComment(items);     
        break;

      case 'conntrack':
        if (opt==='--ctstate' && data==='NEW')
          this.ruleWithStatus = true;
        // Ignore the other conntrack options (--ctproto, --ctorigsrc, etc.).
        items.shift(); items.shift();
        break;
  
      case 'state':
        if (opt==='--state' && data==='NEW')
          this.ruleWithStatus = true;
        items.shift(); items.shift();
        break;

      default: 
        throw new Error(`IPTables module not supported: ${module}`);
    }  
  }

  private async negateRulePosition(item: string): Promise<void> {
    const rulePosition = PositionMap.get(`${this.table}:${this.chain}:${item}`);
    if (rulePosition) {
      try { 
        await PolicyRule.negateRulePosition(this.req.dbCon,this.req.body.firewall,this.ruleId,rulePosition);
      } catch(err) { throw new Error(`Error negating rule position: ${JSON.stringify(err)}`); }
    }
  }

  private async negateLinePositions(line: number): Promise<void> {
    let items = this.data[line].trim().split(/\s+/);

    for (let item of items) {
      if (item.charAt(0) === '-') await this.negateRulePosition(item);
    }
  }


  private async eatNAT(item: string, data: string): Promise<void> {
    if (this.ruleTarget === 'SNAT' && item !== '--to-source')
      throw new Error('Bad iptables-save data in SNAT target');
    if (this.ruleTarget === 'DNAT' && item !== '--to-destination')
      throw new Error('Bad iptables-save data in DNAT target');

    const items = data.split(':');

    if (items[0])
      await this.eatAddr(`${item}_ip`,`${items[0]}/32`);
    if (items[1])
      await this.eatPort('0',items[1],null,null,`${item}_port`);

    this.ruleTargetSet = true;
  }


  private async eatLOG(items: string[]): Promise<void> {
    // Enable rule logging.
    try {
      const ruleData: any = await PolicyRule.getPolicy_r(this.req.dbCon, this.req.body.firewall, this.ruleId);
      let policy_rData = { id: this.ruleId, options: ruleData.options | 4 }
      await PolicyRule.updatePolicy_r(this.req.dbCon, policy_rData);
    } catch(err) { throw new Error(`Error enabling rule log: ${JSON.stringify(err)}`); }  

    for (;;) {
      const item = items[0];

      if (item==='--log-level') {
        items.shift(); items.shift();
      }
      else if (item==='--log-prefix') {
        items.shift();
        if (items[0].charAt(0) === '"') { // Log prefix string.
          items.shift();
          while(items.length>0 && items[0].charAt(items[0].length-1)!=='"')
            items.shift();
          if (items[0].charAt(items[0].length-1) != '"') throw new Error('End of log prefix not found'); 
        }
        items.shift();
      }
      else if (item==='--log-tcp-sequence' || item==='--log-tcp-options' || item==='--log-ip-options' || item==='--log-uid')
        items.shift();
      else break;
    }
  }


  private async eatCommentString(items: string[]): Promise<string> {
    if (items.length === 0) throw new Error('Comment data not found');

    let comment: string;
    let item = items[0];
    let size = item.length;
    
    items.shift();

    // Comment is a single word without double quotes.
    if (item.charAt(0) !== '"') 
      return item;

    // Comment is surrounded by double quotes.
    comment = item.substr(1); // Remove start double quote.
    if (size>1 && item.charAt(size-1)==='"' && item.charAt(size-2)!=='\\') { // Comment is a single word surrounded by double quotes.
    } else { // Comment is a several items string surrounded by doble quotes.
      let endFound =  false;

      while(items.length > 0) {
        item=items[0]; 
        size=item.length;

        comment = `${comment} ${item}`;
        items.shift();

        if (item==='"' || (size>1 && item.charAt(size-1)==='"' && item.charAt(size-2)!=='\\')) {
          endFound = true;
          break; // End of comment string.          
        }
      }
      if (!endFound) throw new Error('End of rule comment not found');
    }

    comment = comment.substr(0,comment.length-1); // Remove end double quote.
    return comment.replace(/\\\"/g,'"');
  }

  private async eatRuleComment(items: string[]): Promise<void> {
    // Update rule comment and metadata.
    try {
      let comment: string = await this.eatCommentString(items);
  
      // If comment contains stringify version of a JSON rule metadata object.
      let ruleMetadata: object = null;
      if (comment.charAt(0) === '{') {
        const end: number = comment.search('}');
        if (end !== -1) {
          ruleMetadata = JSON.parse(comment.substr(0,end+1));
          comment = comment.substr(end+1);
        }
      }
  
      const ruleData: any = await PolicyRule.getPolicy_r(this.req.dbCon, this.req.body.firewall, this.ruleId);
      let policy_rData = { 
        id: this.ruleId, 
        comment: comment 
      }

      if (ruleMetadata) {
        // Rule style.
        if (ruleMetadata['fwc_rs']) policy_rData['style'] = ruleMetadata['fwc_rs'];
        
        // Rule group name.
        if (ruleMetadata['fwc_rgn']) {
          // The rule belongs to the current rules group.
          if (this.ruleGroupName && this.ruleGroupName===ruleMetadata['fwc_rgn'])
            policy_rData['idgroup'] = this.ruleGroupId;
          else { // Create new rules group.
            const policyGroupRepository = getRepository(PolicyGroup);
            let policyGroup = policyGroupRepository.create({
              name: ruleMetadata['fwc_rgn'],
              firewallId: this.req.body.firewall
            });
            if (ruleMetadata['fwc_rgs']) policyGroup['groupstyle'] = ruleMetadata['fwc_rgs'];
            policyGroup = await policyGroupRepository.save(policyGroup);
            this.ruleGroupId = policyGroup.id;
            this.ruleGroupName = ruleMetadata['fwc_rgn'];
            policy_rData['idgroup'] = this.ruleGroupId;
          }
        }
      }

      await PolicyRule.updatePolicy_r(this.req.dbCon, policy_rData);
    } catch(err) { throw new Error(`Error updating rule comment: ${JSON.stringify(err)}`); }  
  }


  private async composeAndEatPort(item: string, items: string[]): Promise<void> {
    if ((item==='--source-port' || item==='--sport' || item==='--destination-port' || item==='--dport') && this.ipProtocol!=='tcp' && this.ipProtocol!=='udp')
      throw new Error('--sport/--dport can only be used in conjunction with -p tcp or -p udp');
    if (item==='--tcp-flags' && this.ipProtocol!=='tcp')
      throw new Error('--tcp-flags can only be used in conjunction with -p tcp');
    
    let srcPorts = '0';
    let dstPorts = '0';
    let tcpFlags = 0;
    let tcpFlagsSet = 0;
    
    while(items.length > 0) {
      if (item==='--source-port' || item==='--sport') srcPorts = items[0];
      else if (item==='--destination-port' || item==='--dport') dstPorts = items[0];
      else if (item==='--tcp-flags') { 
        tcpFlags = await this.generateBitMask(items[0]); 
        tcpFlagsSet = await this.generateBitMask(items[1]);
        items.shift();
      }
      else if (item==='--syn') { 
        tcpFlags = await this.generateBitMask('SYN,RST,ACK,FIN'); 
        tcpFlagsSet = await this.generateBitMask('SYN');
        items.unshift(item); // This is the unique option without parameter.
      }
      else if (item==='--tcp-option' || item==='--mss') {  // Ignore these options.
      }
      else { // Other item.
        items.unshift(item);
        break;
      }

      items.shift();
      item = items[0];
      items.shift();
    } 
  
    await this.eatPort(srcPorts,dstPorts,tcpFlags,tcpFlagsSet);
  }

  private async generateBitMask(data: string): Promise<number> {
    if (data==='NONE') return 0;
    if (data==='ALL') return 63;

    let mask = 0;
    const items = data.split(',');
    for(let item of items) {
      mask |= TcpFlags.get(item);
    }

    return mask;
  }

  private async eatInterface(dir: string, _interface: string): Promise<void> {
    // IMPORTANT: Validate data before process it.
    await Joi.validate(_interface, sharedSch.name);

    // Search to find out if it already exists.
    let interfaceId = await Interface.searchInterfaceInFirewallByName(this.req.dbCon, this.req.body.fwcloud, this.req.body.firewall, _interface);

    // If not found create it.
    if (!interfaceId) {
      let interfaceData = {
        id: null,
        firewall: this.req.body.firewall,
        name: _interface,
        type: 10,
        interface_type: 10,
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
      
      try {
        interfaceData.id = interfaceId = await Interface.insertInterface(this.req.dbCon, interfaceData);
        const fwcTreeNode: any = await Tree.getNodeUnderFirewall(this.req.dbCon,this.req.body.fwcloud,this.req.body.firewall,'FDI');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, 'IFF', interfaceData);
      } catch(err) { throw new Error(`Error creating firewall interface: ${JSON.stringify(err)}`); }

      this.stats.interfaces++;
    }

    // Add the interface to the rule position.
    const rulePosition = PositionMap.get(`${this.table}:${this.chain}:${dir}`);
    if (!rulePosition)
      throw new Error(`Rule position not found for: ${this.table}:${this.chain}:${dir}`);

    let policy_r__interfaceData = {
      rule: this.ruleId,
      interface: interfaceId,
      position: rulePosition,
      position_order: 0
    };

    try {
      if (!(await PolicyRuleToInterface.interfaceAlreadyInRulePosition(this.req.dbCon, this.req.body.fwcloud, this.req.body.firewall, this.ruleId, rulePosition, interfaceId)))
        await PolicyRuleToInterface.insertPolicy_r__interface(this.req.body.firewall, policy_r__interfaceData);
    } catch(err) { throw new Error(`Error inserting interface in policy rule: ${JSON.stringify(err)}`); }
  }


  private async eatAddr(dir: string, addr: string): Promise<void> {
    // IMPORTANT: Validate data before process it.
    await Joi.validate(addr, Joi.string().ip({ version: [`ipv${this.req.body.ip_version}`], cidr: 'required' }));

    const fullMask = this.req.body.ip_version === 4 ? '32' : '128';
    const addrData = addr.split('/');
    const ip: string = addrData[0];
    const mask: string = addrData[1];

    // Search to find out if it already exists.
    let addrId: any;

    if (mask === '32' || mask === '128')
      addrId = await IPObj.searchAddr(this.req.dbCon,this.req.body.fwcloud,ip);
    else
      addrId = await IPObj.searchAddrWithMask(this.req.dbCon,this.req.body.fwcloud,ip,mask);
    
    // If not found create it.
    if (!addrId) {
      let ipobjData = {
        id: null,
        fwcloud: this.req.body.fwcloud,
        name: mask === fullMask ? ip :addr,
        type: mask === fullMask ? 5 : 7, // 5: ADDRESS, 7: NETWORK
        address: ip,
        netmask: `/${mask}`,
        ip_version: this.req.body.ip_version,
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
  
      try {
        ipobjData.id = addrId = await IPObj.insertIpobj(this.req.dbCon, ipobjData);
        const fwcTreeNode: any = mask === fullMask ? await Tree.getNodeByNameAndType(this.req.body.fwcloud,'Addresses','OIA') : await Tree.getNodeByNameAndType(this.req.body.fwcloud,'Networks','OIN');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, mask===fullMask ? 'OIA' : 'OIN' , ipobjData);
      } catch(err) { throw new Error(`Error creating IP object: ${JSON.stringify(err)}`); }

      this.stats.ipObjs++;

      // Add the addr object to the rule position.
      await this.addIPObjToRulePosition(dir,addrId);
    } else {
      // Search if the address object is part of an OpenVPN ifconfig-push configuration option.
      const result: any = await IPObj.addrInIfconfigPushOpenVPN(addrId, this.req.body.fwcloud); 

      // If it is, then add the OpenVPN config to the rule position instead of the address object.
      if (result.length && result.length>0) { 
        this.req.body.rule = this.ruleId;
        this.req.body.openvpn = result[0].id;
        this.req.body.position = PositionMap.get(`${this.table}:${this.chain}:${dir}`);
        this.req.body.position_order = 999999;
        if (!await PolicyRuleToOpenVPN.checkExistsInPosition(this.req.dbCon,this.ruleId,result[0].id,this.req.body.position))
          await PolicyRuleToOpenVPN.insertInRule(this.req);
      }
      else // Add the addr object to the rule position.
        await this.addIPObjToRulePosition(dir,addrId);
    }
  }


  private async eatIPRange(dir: string, data: string): Promise<void> {
    const ips = data.split('-');

    // IMPORTANT: Validate data before process it.
    await Joi.validate(ips[0], Joi.string().ip({ version: [`ipv${this.req.body.ip_version}`], cidr: 'forbidden' }));
    await Joi.validate(ips[1], Joi.string().ip({ version: [`ipv${this.req.body.ip_version}`], cidr: 'forbidden' }));

    // Search to find out if it already exists.
    let iprangeId: any = await IPObj.searchIPRange(this.req.dbCon,this.req.body.fwcloud,ips[0],ips[1]);
    
    // If not found create it.
    if (!iprangeId) {
      let ipobjData = {
        id: null,
        fwcloud: this.req.body.fwcloud,
        name: data,
        type: 6, // 5: ADDRESS RANGE
        range_start: ips[0],
        range_end: ips[1],
        ip_version: this.req.body.ip_version,
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
  
      try {
        ipobjData.id = iprangeId = await IPObj.insertIpobj(this.req.dbCon, ipobjData);
        const fwcTreeNode: any = await Tree.getNodeByNameAndType(this.req.body.fwcloud,'Address Ranges','OIR');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, 'OIR', ipobjData);
      } catch(err) { throw new Error(`Error creating address range object: ${JSON.stringify(err)}`); }

      this.stats.ipObjs++;
    }

    // Add the addr object to the rule position.
    await this.addIPObjToRulePosition(dir,iprangeId);
  }


  private async eatProtocol(protocol: string): Promise<void> {
    // IMPORTANT: Validate data before process it.
    if (protocol==='tcp' || protocol==='udp' || protocol==='icmp') {
      this.ipProtocol = protocol;
      return;
    }
    
    let protocolId: string;

    if (parseInt(protocol)) { // IP protocol by number.
      await Joi.validate(protocol, sharedSch.u8bits);
      protocolId = await IPObj.searchIPProtocolByNumber(this.req.dbCon,this.req.body.fwcloud,protocol);
    }
    else { // IP protocol by name.
      await Joi.validate(protocol, sharedSch.name);
      protocolId = await IPObj.searchIPProtocolByName(this.req.dbCon,this.req.body.fwcloud,protocol);
    }

    if (protocolId === '')
      throw new Error(`IP protocol not found: ${protocol}`);

    // Add the protocol object to the rule position.
    await this.addIPObjToRulePosition('-p',protocolId);
  }


  private async eatPort(sports: string, dports: string, tcpFlags: number, tcpFlagsSet: number, pos?: string): Promise<void> {
    const srcPorts = sports.split(/:|-/);
    const dstPorts = dports.split(/:|-/);

    // IMPORTANT: Validate data before process it.
    for (let port of srcPorts)
      await Joi.validate(port, Joi.number().port());
    for (let port of dstPorts)
      await Joi.validate(port, Joi.number().port());

    if (srcPorts.length < 2) srcPorts.push(srcPorts[0]);
    if (dstPorts.length < 2) dstPorts.push(dstPorts[0]);

    if (parseInt(srcPorts[1])<parseInt(srcPorts[0]) || parseInt(dstPorts[1])<parseInt(dstPorts[0]))
      throw new Error('End port must be equal or greater than start port');

    // Search to find out if it already exists.
    let portId: any = await IPObj.searchPort(this.req.dbCon,this.req.body.fwcloud,this.ipProtocol,srcPorts,dstPorts,tcpFlags,tcpFlagsSet);

    // If not found create it.
    if (!portId) {
      let ipobjData = {
        id: null,
        fwcloud: this.req.body.fwcloud,
        name: dports,
        type: this.ipProtocol === 'tcp' ? 2 : 4, // 2: TCP, 4: UDP
        protocol: this.ipProtocol === 'tcp' ? 6 : 17,
        source_port_start: srcPorts[0],
        source_port_end: srcPorts[1], 
        destination_port_start: dstPorts[0],
        destination_port_end: dstPorts[1],
        tcp_flags_mask: tcpFlags,
        tcp_flags_settings: tcpFlagsSet,
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
  
      try {
        ipobjData.id = portId = await IPObj.insertIpobj(this.req.dbCon, ipobjData);
        const fwcTreeNode: any = this.ipProtocol === 'tcp' ? await Tree.getNodeByNameAndType(this.req.body.fwcloud,'TCP','SOT') : await Tree.getNodeByNameAndType(this.req.body.fwcloud,'UDP','SOU');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, this.ipProtocol==='TCP' ? 'SOT' : 'SOU', ipobjData);
      } catch(err) { throw new Error(`Error creating service object: ${JSON.stringify(err)}`); }

      this.stats.ipObjs++;
    }

    // Add the addr object to the rule position.
    await this.addIPObjToRulePosition(pos ? pos : 'srvc',portId);
  }

  
  private async eatICMP(data: string): Promise<void> {
    // IMPORTANT: Validate data before process it.
    let icmp: string[];
    
    if (data === 'any')
      icmp = ['-1', '-1'];
    else {
      icmp = data.split('/');
      for (let val of icmp)
        await Joi.validate(val, Joi.number().integer().min(-1).max(255));

      if (icmp.length < 2) icmp.push('-1');
    }

    // Search to find out if it already exists.   
    let icmpId: any = await IPObj.searchICMP(this.req.dbCon,this.req.body.fwcloud,icmp[0],icmp[1]);
    
    // If not found create it.
    if (!icmpId) {
      let ipobjData = {
        id: null,
        fwcloud: this.req.body.fwcloud,
        name: data,
        type: 3,
        protocol: 1,
        icmp_type: icmp[0],
        icmp_code: icmp[1],
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
  
      try {
        ipobjData.id = icmpId = await IPObj.insertIpobj(this.req.dbCon, ipobjData);
        const fwcTreeNode: any = await Tree.getNodeByNameAndType(this.req.body.fwcloud,'ICMP','SOM');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, 'SOM', ipobjData);
      } catch(err) { throw new Error(`Error creating ICMP object: ${JSON.stringify(err)}`); }

      this.stats.ipObjs++;
    }

    // Add the addr object to the rule position.
    await this.addIPObjToRulePosition('srvc',icmpId);
  }


  private async addIPObjToRulePosition(item: string, id: string): Promise<void> {
    const rulePosition = PositionMap.get(`${this.table}:${this.chain}:${item}`);
    if (!rulePosition)
      throw new Error(`Rule position not found for: ${this.table}:${this.chain}:${item}`);

    let policy_r__ipobjData = {
      rule: this.ruleId,
      ipobj: id,
      ipobj_g: -1,
      interface: -1,
      position: rulePosition,
      position_order: 1
    };

    try {
      if (!(await PolicyRuleToIPObj.checkExistsInPosition(policy_r__ipobjData)))
        await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
    } catch(err) { throw new Error(`Error inserting IP object in policy rule: ${JSON.stringify(err)}`); }
  }


  private async addIPObjGroupToRulePosition(position: number, group: number): Promise<void> {
    let policy_r__ipobjData = {
      rule: this.ruleId,
      ipobj: -1,
      ipobj_g: group,
      interface: -1,
      position: position,
      position_order: 1
    };

    try {
      await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
    } catch(err) { throw new Error(`Error inserting IP objects group in policy rule: ${JSON.stringify(err)}`); }
  }


  public async groupRulePositionItems(): Promise<void> {
    let i: number;
    const groupsData: any = await IPObjGroup.getIpobjGroups(this.req.dbCon, this.req.body.fwcloud);
    const ipobjGroups = groupsData.map( ({ id }) => { return id } );
    const positionsList = GroupablePositionMap.get(`${this.table}:${this.chain}`);

    // For all positions for which it is possible to group objects.
    for (let position of positionsList) {
      const ipobjsData: any = await PolicyRuleToIPObj.getRuleIPObjsByPosition(this.ruleId, position);
      if (ipobjsData.length < 2) continue;
      let ipobjsInRule = ipobjsData.map( ({ ipobj }) => { return ipobj } );

      // For all existing IP objects groups.
      for(let group of ipobjGroups) {
        const groupData: any = await IPObjGroup.getIpobj_g_Full(this.req.dbCon, this.req.body.fwcloud, group);
        if (!groupData || !groupData[0] || !groupData[0].ipobjs || groupData[0].ipobjs.length < 2) continue;
        const ipobjsInGroup = groupData[0].ipobjs.map( ({ id }) => { return id } );;

        // Check if all group objects exists in the rule position.
        for (i=0; i < ipobjsInGroup.length; i++) {
          if (ipobjsInRule.indexOf(ipobjsInGroup[i]) === -1)
            break;
        }

        if (i === ipobjsInGroup.length) { // All objects in group have been found in rule position.
          // Add group to rule position.
          await this.addIPObjGroupToRulePosition(position, group);

          for(let ipobjInGroup of ipobjsInGroup) {
            // Remove from rule position all the objects that are part of the group.
            await	PolicyRuleToIPObj.deletePolicy_r__ipobj(this.req.dbCon, this.ruleId, ipobjInGroup, -1, -1, position, 0);

            // Remove too from ipobjsInRule array.
            ipobjsInRule.splice(ipobjsInRule.indexOf(ipobjInGroup),1);
          }
        }
      }
    }
  }


  public async mergeWithPreviousRule(): Promise<void> {
    if (!this.previousRuleId) { 
      this.previousRuleId = this.ruleId;
      return;
    }

    let data: any = await PolicyRule.getPolicyDataDetailed(this.req.body.fwcloud, this.req.body.firewall, this.policyType, this.previousRuleId);
    this.previousRuleId = this.ruleId; // Important, do it here before check the data result of the previous method call.
    if (!data || !data.length || data.length!=1) return;
    const previousRule = data[0];

    data = await PolicyRule.getPolicyDataDetailed(this.req.body.fwcloud, this.req.body.firewall, this.policyType, this.ruleId);
    if (!data || !data.length || data.length!=1) return;
    const currentRule = data[0];

    // Compare rules.
    if (previousRule.action !== currentRule.action) return;
    if (previousRule.active !== currentRule.active) return;
    if (previousRule.options !== currentRule.options) return;
    if (previousRule.special !== currentRule.special) return;
    if (previousRule.mark !== currentRule.mark) return;
    if (previousRule.mark_code !== currentRule.mark_code) return;
    if (previousRule.positions.length !== currentRule.positions.length) return;

    // Compare rule positions.
    let posDiffer: number[] = [];
    for (let i=0; i<previousRule.positions.length; i++) {
      if (previousRule.positions[i].id != currentRule.positions[i].id) return;

      const prevPosObjs = JSON.stringify(previousRule.positions[i].position_objs);
      const currPosObjs = JSON.stringify(currentRule.positions[i].position_objs);

      // Check position negation!!!!
      const currPosNegated = RuleCompiler.isPositionNegated(currentRule.negate,currentRule.positions[i].id);
      const prevPosNegated = RuleCompiler.isPositionNegated(previousRule.negate,previousRule.positions[i].id);
      if (currPosNegated !== prevPosNegated) return; // Rules with different negation status in the same position can not be merged.

      if (prevPosObjs !== currPosObjs) {
        // Rules differ in more than one position.
        if (posDiffer.length === 1) return; // Only can merge if rules differ in one position.

        // It is not possible to merge rules with no objects (value any) in the differing position.
        if (previousRule.positions[i].position_objs.length===0 || currentRule.positions[i].position_objs.length===0) return;

        posDiffer.push(i);
      }
    }

    // If only differ in one position then current rule can be merged with the previous one.
    if (posDiffer.length === 1) {
      // Move items in the differing position from the new rule to the same position of the previous one.
      const currPosObjs = currentRule.positions[posDiffer[0]].position_objs;
      const position =  currentRule.positions[posDiffer[0]].id;
      let allMoved = true;

      for(let obj of currPosObjs) {
        let policy_r__ipobjData = {
          rule: previousRule.id,
          ipobj: obj.id,
          ipobj_g: -1,
          interface: -1,
          position: position,
          position_order: 1
        };
    
        /* 
          +-----+-----------------------+-----------------+
          | id  | type                  | protocol_number |
          +-----+-----------------------+-----------------+
          |   1 | IP                    |            NULL |
          |   2 | TCP                   |               6 |
          |   3 | ICMP                  |               1 |
          |   4 | UDP                   |              17 |
          |   5 | ADDRESS               |            NULL |
          |   6 | ADDRESS RANGE         |            NULL |
          |   7 | NETWORK               |            NULL |
          ...
          |  10 | INTERFACE FIREWALL    |            NULL |
          ...
          +-----+-----------------------+-----------------+
        */
        if (obj.type>=1 && obj.type<=7) {
          // Verify that object doesn't already exists in position.
          if (!(await PolicyRuleToIPObj.checkExistsInPosition(policy_r__ipobjData)))  
            await PolicyRuleToIPObj.updatePolicy_r__ipobj_position(this.req.dbCon, currentRule.id, obj.id, -1, -1, position, 99999, previousRule.id, position, 99999);
        }
        else if (obj.type === 10) { // INTERFACE FIREWALL
          // Verify that object doesn't already exists in position.
          if (!(await PolicyRuleToInterface.interfaceAlreadyInRulePosition(this.req.dbCon, this.req.body.fwcloud, this.req.body.firewall, previousRule.id, position, obj.id)))
            await PolicyRuleToInterface.updatePolicy_r__interface_position(this.req.dbCon, this.req.body.firewall, currentRule.id, obj.id, position, 99999, previousRule.id, position, 99999);
        }
        else {
          allMoved = false;
          break;
        }
      }
      
      if (allMoved) {
        // Delete the new rule because it has been merged with the previous one.
        await PolicyRule.deletePolicy_r(this.req.body.firewall, this.ruleId);

        // Update data.
        this.ruleId = this.previousRuleId = previousRule.id;
        this.stats.rules--;
      }
    }
  }
}
