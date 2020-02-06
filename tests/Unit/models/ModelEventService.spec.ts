import { Firewall } from '../../../src/models/firewall/Firewall';
import { Application } from '../../../src/Application';
import { runApplication, getDatabaseConnection } from '../../utils/utils';
import modelEventService from '../../../src/models/ModelEventService'
import { getRepository } from 'typeorm';
import { FirewallTest } from './fixtures/FirewallTest';


let application: Application;

beforeEach(async() => {
    application = await runApplication();
});

describe('ModelEventService tests', () => {
    it('emit model event with a callback should run the callback', async() => {
        const id = await Firewall.insertFirewall({
            name: 'test'
        });

        await modelEventService.emit('create', Firewall, id, async () => {
            return await getRepository(Firewall).update(id, {name: 'test2'});
        });

        expect((await getRepository(Firewall).findOne(id)).name).toBe('test2');
    });

    it('emit model event over a model should run a model method if exists', async() => {
        let firewall = getRepository(FirewallTest).create({name: 'test'});
        firewall = await getRepository(FirewallTest).save(firewall);

        await modelEventService.emit('create', FirewallTest, firewall.id);

        expect((await getRepository(Firewall).findOne(firewall.id)).name).toBe('onCreate called');
    });
});