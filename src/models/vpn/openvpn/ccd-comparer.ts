import { CCDHash } from '../../../communications/communication';

export type CCDComparation = {
  onlyLocal: string[];
  onlyRemote: string[];
  synced: string[];
  unsynced: string[];
};

export class CCDComparer {
  static compare(locals: CCDHash[], remotes: CCDHash[]): CCDComparation {
    const comparation: CCDComparation = {
      onlyLocal: [],
      onlyRemote: [],
      synced: [],
      unsynced: [],
    };

    locals.forEach((ccdhash) => {
      const matchIndex: number = remotes.findIndex((item) => item.filename === ccdhash.filename);
      if (matchIndex < 0) {
        comparation.onlyLocal.push(ccdhash.filename);
        return;
      }

      const match: CCDHash = remotes[matchIndex];
      match.hash === ccdhash.hash
        ? comparation.synced.push(ccdhash.filename)
        : comparation.unsynced.push(ccdhash.filename);
    });

    remotes.forEach((ccdhash) => {
      const matchIndex: number = locals.findIndex((item) => item.filename === ccdhash.filename);
      if (matchIndex < 0) {
        comparation.onlyRemote.push(ccdhash.filename);
      }
    });

    return comparation;
  }
}
