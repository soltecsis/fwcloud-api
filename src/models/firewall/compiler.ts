import { Firewall } from "./Firewall";
import { PolicyScript } from "../../compiler/PolicyScript";
import * as fs from "fs";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { ProgressDebugPayload } from "../../sockets/messages/socket-message";

export class Compiler {
    protected _firewall: Firewall;

    constructor(firewall: Firewall) {
        this._firewall = firewall;
    }

    public async compile(headerPath: string, footerPath: string, eventEmitter: EventEmitter): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const outputPath: string = this._firewall.getPolicyFilePath();
            var stream = fs.createWriteStream(outputPath);
            
            stream.on('open', async () => {
                /* Generate the policy script. */
                let data: any = await PolicyScript.append(headerPath);

                data = await PolicyScript.dumpFirewallOptions(this._firewall.fwCloudId, this._firewall.id ,data);
                stream.write(data.cs + "greeting_msg() {\n" +
                    "log \"FWCloud.net - Loading firewall policy generated: " + Date() + "\"\n}\n\n" +
                    "policy_load() {\n");
                
                if (data.options & 0x0001) {
                    // Statefull firewall
                    eventEmitter.emit('message', new ProgressDebugPayload("<strong>--- STATEFUL FIREWALL ---</strong>\n\n"));
                } else {
                    eventEmitter.emit('message', new ProgressDebugPayload("<strong>--- STATELESS FIREWALL ---</strong>\n\n"));
                }

                // Generate default rules for mangle table
                if (await this._firewall.hasMarkedRules()) {
                    eventEmitter.emit('message', new ProgressDebugPayload("<strong>MANGLE TABLE:</strong>\n"));
                    eventEmitter.emit('message', new ProgressDebugPayload("Automatic rules.\n\n"));
                    stream.write("\n\necho\n");
                    stream.write("echo \"****************\"\n");
                    stream.write("echo \"* MANGLE TABLE *\"\n");
                    stream.write("echo \"****************\"\n");
                    stream.write("#Automatic rules for mangle table.\n");
                    stream.write("$IPTABLES -t mangle -A PREROUTING -j CONNMARK --restore-mark\n");
                    stream.write("$IPTABLES -t mangle -A PREROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
                    stream.write("$IPTABLES -t mangle -A OUTPUT -j CONNMARK --restore-mark\n");
                    stream.write("$IPTABLES -t mangle -A OUTPUT -m mark ! --mark 0 -j ACCEPT\n\n");
                    stream.write("$IPTABLES -t mangle -A POSTROUTING -j CONNMARK --restore-mark\n");
                    stream.write("$IPTABLES -t mangle -A POSTROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
                }
                
                stream.write("\n\necho\n");
                stream.write("echo \"***********************\"\n");
                stream.write("echo \"* FILTER TABLE (IPv4) *\"\n");
                stream.write("echo \"***********************\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>FILTER TABLE (IPv4):</strong>\n"));
                stream.write("\n\necho \"INPUT CHAIN\"\n");
                stream.write("echo \"-----------\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>INPUT CHAIN:</strong>\n"));
                let cs = await PolicyScript.dump(this._firewall, 1, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"OUTPUT CHAIN\"\n");
                stream.write("echo \"------------\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>OUTPUT CHAIN:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 2, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"FORWARD CHAIN\"\n");
                stream.write("echo \"-------------\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>FORWARD CHAIN:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 3, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"********************\"\n");
                stream.write("echo \"* NAT TABLE (IPv4) *\"\n");
                stream.write("echo \"********************\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>NAT TABLE (IPv4):</strong>\n"));
                stream.write("\n\necho \"SNAT\"\n");
                stream.write("echo \"----\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>SNAT:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 4, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"DNAT\"\n");
                stream.write("echo \"----\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>DNAT:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 5, eventEmitter);

                stream.write(cs+"\n\n");


                stream.write("\n\necho\n");
                stream.write("echo\n");
                stream.write("echo \"***********************\"\n");
                stream.write("echo \"* FILTER TABLE (IPv6) *\"\n");
                stream.write("echo \"***********************\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("\n\n"));
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>FILTER TABLE (IPv6):</strong>\n"));
                stream.write("\n\necho \"INPUT CHAIN\"\n");
                stream.write("echo \"-----------\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>INPUT CHAIN:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 61, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"OUTPUT CHAIN\"\n");
                stream.write("echo \"------------\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>OUTPUT CHAIN:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 62, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"FORWARD CHAIN\"\n");
                stream.write("echo \"-------------\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>FORWARD CHAIN:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 63, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"********************\"\n");
                stream.write("echo \"* NAT TABLE (IPv6) *\"\n");
                stream.write("echo \"********************\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>NAT TABLE (IPv6):</strong>\n"));
                stream.write("\n\necho \"SNAT\"\n");
                stream.write("echo \"----\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>SNAT:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 64, eventEmitter);

                stream.write(cs + "\n\necho\n");
                stream.write("echo \"DNAT\"\n");
                stream.write("echo \"----\"\n");
                eventEmitter.emit('message', new ProgressDebugPayload("<strong>DNAT:</strong>\n"));
                cs = await PolicyScript.dump(this._firewall, 65, eventEmitter);

                stream.write(cs+"\n}\n\n");
                

                data = await PolicyScript.append(footerPath);
                stream.write(data.cs);
                
                /* Close stream. */
                stream.end();
                
                // Update firewall status flags.
                await Firewall.updateFirewallStatus(this._firewall.fwCloudId, this._firewall.id,"&~1");
                // Update firewall compile date.
                await Firewall.updateFirewallCompileDate(this._firewall.fwCloudId, this._firewall.id);

                return resolve();
            })
            .on('error', error => {
                return reject(error);
            });
        });
    }
}