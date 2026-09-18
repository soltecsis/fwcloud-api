/** Undo only resources created by this application, including partially initialized resources. */
export class ProfileVpnRollback {
  private actions: Array<{ resource: string; undo: () => Promise<unknown> }> = [];

  public add(resource: string, undo: () => Promise<unknown>): void {
    this.actions.push({ resource, undo });
  }

  public async rollback(errors: string[]): Promise<void> {
    while (this.actions.length) {
      const { resource, undo } = this.actions.pop()!;
      try {
        await undo();
      } catch (error) {
        errors.push(
          `VPN rollback (${resource}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
