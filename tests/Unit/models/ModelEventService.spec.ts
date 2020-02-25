import { Firewall } from '../../../src/models/firewall/Firewall';
import { Application } from '../../../src/Application';
import { runApplication, randomString, getDatabaseConnection } from '../../utils/utils';
import modelEventService from '../../../src/models/ModelEventService'
import { getRepository } from 'typeorm';
import { FirewallTest } from './fixtures/FirewallTest';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import db from '../../../src/database/database-manager';


let application: Application;

beforeEach(async () => {
    application = await runApplication();
});

describe('ModelEventService tests', () => {
    it('emit model event with a callback should run the callback', async () => {
        const name = randomString();
        const fwcloud = await FwCloud.insertFwcloud({
            body: {
                name: name
            },
            dbCon: db.getQuery()
        });
        
        const id = await Firewall.insertFirewall({
            name: name,
            fwcloud: fwcloud
        });

        const newName = randomString();
        await modelEventService.emit('create', Firewall, id, async () => {
            return await getRepository(Firewall).update(id, { name: newName });
        });

        expect((await getRepository(Firewall).findOne(id)).name).toBe(newName);
    });

    it('emit model event over a model should run a model method if exists', async () => {
        const name = randomString();
        let firewall = getRepository(FirewallTest).create({ name: name });
        firewall = await getRepository(FirewallTest).save(firewall);

        await modelEventService.emit('create', FirewallTest, firewall.id);

        expect((await getRepository(Firewall).findOne(firewall.id)).name).toBe('onCreate called');
    });

    it('emit model event using where arguments should update the models with that where-clausules', async () => {
        const name = randomString();
        let firewall = getRepository(FirewallTest).create({ name: name });
        firewall = await getRepository(FirewallTest).save(firewall);

        await modelEventService.emit('create', FirewallTest, { name: name });

        expect((await getRepository(Firewall).findOne(firewall.id)).name).toBe('onCreate called');
    });

    it('emit model event using a model instance should update the instanced model', async() => {
        const name = randomString();
        let firewall = getRepository(FirewallTest).create({ name: name });
        firewall = await getRepository(FirewallTest).save(firewall);

        await modelEventService.emit('create', FirewallTest, firewall);

        expect((await getRepository(Firewall).findOne(firewall.id)).name).toBe('onCreate called');
    });

    it('emit model event using an empty criteria should not throw an exception', async () => {
        await modelEventService.emit('create', FirewallTest, null);
    });

    it('emit model event using an array of model instance should update all model instances', async() => {
        let firewall = getRepository(FirewallTest).create({ name: randomString() });
        let firewall2 = getRepository(FirewallTest).create({ name: randomString() });
        
        firewall = await getRepository(FirewallTest).save(firewall);
        firewall2 = await getRepository(FirewallTest).save(firewall2);

        const firewalls = await getRepository(FirewallTest).find({});

        await modelEventService.emit('create', FirewallTest, firewalls);

        expect((await getRepository(Firewall).findOne(firewall.id)).name).toBe('onCreate called');
        expect((await getRepository(Firewall).findOne(firewall2.id)).name).toBe('onCreate called');
    });
});