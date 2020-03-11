import { describeName, testSuite, expect } from "../../../mocha/global-setup"
import { Application } from "../../../../src/Application";
import { RepositoryService } from "../../../../src/database/repository.service";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { FwCloudExporter } from "../../../../src/snapshots/exporters/fwcloud-exporter";
import { Ca } from "../../../../src/models/vpn/pki/Ca";
import { CaExporter } from "../../../../src/snapshots/exporters/ca-exporter";
import { Cluster } from "../../../../src/models/firewall/Cluster";
import { ClusterExporter } from "../../../../src/snapshots/exporters/cluster-exporter";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { FirewallExporter } from "../../../../src/snapshots/exporters/firewall-exporter";

let app: Application;
let repositoryService: RepositoryService;

describe(describeName('FwCloud exporter tests'), () => {
    let fwcloud: FwCloud;

    beforeEach(async() => {
        app = testSuite.app;

        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        const fwcloudRepository = repositoryService.for(FwCloud);

        fwcloud = fwcloudRepository.create({
            name: 'testCloud'
        });

        fwcloud = await fwcloudRepository.save(fwcloud);
        fwcloud = await fwcloudRepository.findOne(fwcloud.id);
    });

    it('export should export the fwcloud', async() => {
        expect((await new FwCloudExporter(fwcloud).export()).data.FwCloud[0]).to.be.deep.equal(new FwCloudExporter(fwcloud).exportedEntity())
    });

    it('export should include the ca referenced elements', async () => {
        let ca: Ca = repositoryService.for(Ca).create({
            cn: 'ca_test',
            days: 100,
            fwcloud: fwcloud
        });
        ca = await repositoryService.for(Ca).save(ca);
        ca = await repositoryService.for(Ca).findOne(ca.id);

        expect((await new FwCloudExporter(fwcloud).export()).data.Ca[0]).to.be.deep.equal(new CaExporter(ca).exportedEntity())
    });

    it('export should include the cluster referenced elements', async () => {
        let cluster: Cluster = repositoryService.for(Cluster).create({
            name: 'cluster_test',
            fwcloud: fwcloud
        });

        cluster = await repositoryService.for(Cluster).save(cluster);
        cluster = await repositoryService.for(Cluster).findOne(cluster.id);

        expect((await new FwCloudExporter(fwcloud).export()).data.Cluster[0])
            .to.be.deep.equal(new ClusterExporter(cluster).exportedEntity())
    });

    it('export should include the firewall referenced elements', async () => {
        let firewall: Firewall = repositoryService.for(Firewall).create({
            name: 'firewall_test',
            fwcloud: fwcloud
        });

        firewall = await repositoryService.for(Firewall).save(firewall);
        firewall = await repositoryService.for(Firewall).findOne(firewall.id);

        expect((await new FwCloudExporter(fwcloud).export()).data.Firewall[0])
            .to.be.deep.equal(new FirewallExporter(firewall).exportedEntity())
    });
})